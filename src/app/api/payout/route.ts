import { NextResponse } from "next/server";
import { 
  Client, 
  PrivateKey, 
  TransferTransaction, 
  TokenId, 
  AccountId, 
  Hbar 
} from "@hashgraph/sdk";

export async function POST(req: Request) {
  try {
    const { accountId, hbarAmount, winAmount, wagerAmount, direction, transactionId, receiveTokenId, receiveAmountStr } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const operatorId = (process.env.HEDERA_OPERATOR_ID || "").trim();
    const operatorKey = (process.env.HEDERA_OPERATOR_KEY || "").trim();
    const treasuryId = (process.env.NEXT_PUBLIC_TREASURY_ID || operatorId).trim();
    
    const WAGER_TOKEN_ID = (process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim();

    if (!operatorId || !operatorKey || !treasuryId) {
      console.error("[Payout API] Server missing operator or treasury credentials.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Parse the private key properly based on its format (ECDSA vs ED25519)
    const key = operatorKey.startsWith('0x') 
      ? PrivateKey.fromStringECDSA(operatorKey) 
      : PrivateKey.fromString(operatorKey);

    // Initialize the Hedera client with the Treasury credentials
    const client = Client.forTestnet().setOperator(operatorId, key);

    // CRITICAL FIX: AppKit/MetaMask sends EVM 0x addresses, not Hedera account IDs.
    // Resolve the EVM address to Hedera format (0.0.XXXXX) via Mirror Node.
    let resolvedAccountId = accountId;
    if (accountId && accountId.startsWith("0x")) {
      try {
        const mirrorRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
        if (mirrorRes.ok) {
          const mirrorData = await mirrorRes.json();
          resolvedAccountId = mirrorData?.account || accountId;
          console.log(`[Payout API] Resolved EVM ${accountId} → Hedera ${resolvedAccountId}`);
        }
      } catch (e) {
        console.warn(`[Payout API] Could not resolve Hedera account ID for ${accountId}:`, e);
      }
    }

    // Also resolve receiveTokenId if it came in as a 0x EVM address
    let resolvedReceiveTokenId = receiveTokenId;
    if (receiveTokenId && receiveTokenId.startsWith("0x") && receiveTokenId !== "HBAR") {
      try {
        const num = BigInt(receiveTokenId);
        const shard = 0, realm = 0, entity = num;
        resolvedReceiveTokenId = `${shard}.${realm}.${entity}`;
        console.log(`[Payout API] Resolved EVM token ${receiveTokenId} → ${resolvedReceiveTokenId}`);
      } catch {
        // Keep original if conversion fails
      }
    }

    let tx: TransferTransaction;
    let memo = "WagerHub Payout";

    // ─── Universal Swap Logic ─────────────────────────────────────────────
    if (receiveTokenId && receiveAmountStr) {
      // Dynamic route requested by frontend
      const amt = parseFloat(receiveAmountStr);
      let isNative = false;
      let memoStr = `WagerHub Swap Payout`;
      let decimals = 8;
      
      if (receiveTokenId === "HBAR") {
        isNative = true;
      } else if (receiveTokenId === WAGER_TOKEN_ID) {
        decimals = 8;
      } else {
        // USDT / USDC both use 6 decimals
        decimals = 6;
      }

      tx = new TransferTransaction();
      
      if (isNative) {
        tx.addHbarTransfer(AccountId.fromString(treasuryId), new Hbar(amt).negated());
        tx.addHbarTransfer(AccountId.fromString(resolvedAccountId), new Hbar(amt));
      } else {
        const amountInTiny = Math.floor(amt * Math.pow(10, decimals));
        tx.addTokenTransfer(TokenId.fromString(resolvedReceiveTokenId), AccountId.fromString(treasuryId), -amountInTiny);
        tx.addTokenTransfer(TokenId.fromString(resolvedReceiveTokenId), AccountId.fromString(resolvedAccountId), amountInTiny);
      }
      tx.setTransactionMemo(memoStr);
    } 
    // ─── Legacy Game Payouts (HBAR -> WAGER / Win Amount) ─────────────────
    else if (winAmount || hbarAmount) {
      const calculatedWagerAmount = hbarAmount 
        ? parseFloat(hbarAmount.toString()) 
        : parseFloat(winAmount.toString());

      const finalWagerAmount = hbarAmount ? calculatedWagerAmount * 10 : calculatedWagerAmount;
      const amountInTokens = Math.floor(finalWagerAmount * 1e8);
      memo = hbarAmount ? "WagerHub Swap Payout" : "WagerHub Game Payout";

      tx = new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(treasuryId), -amountInTokens)
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(resolvedAccountId), amountInTokens)
        .setTransactionMemo(memo);
    }
    // ─── Legacy Reverse Swap (WAGER -> HBAR) ──────────────────────────────
    else if (direction === 'WAGER_TO_HBAR') {
      const hbarToPayout = parseFloat(wagerAmount.toString()) / 10;
      memo = `WagerHub Reverse Swap: ${wagerAmount} $WAGER -> ${hbarToPayout} HBAR`;

      tx = new TransferTransaction()
        .addHbarTransfer(AccountId.fromString(treasuryId), new Hbar(hbarToPayout).negated())
        .addHbarTransfer(AccountId.fromString(resolvedAccountId), new Hbar(hbarToPayout))
        .setTransactionMemo(memo);
    } else {
      return NextResponse.json({ error: "Invalid payout parameters" }, { status: 400 });
    }

    console.log(`[Payout API] Executing: ${memo}`);

    // Execute the transaction using the Treasury's operator client
    const submitTx = await tx.execute(client);
    const receipt = await submitTx.getReceipt(client);

    console.log(`[Payout API] Payout Status: ${receipt.status.toString()}`);

    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
    }

    return NextResponse.json({ 
      success: true, 
      txId: submitTx.transactionId.toString() 
    });

  } catch (error) {
    console.error("[Payout API] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
