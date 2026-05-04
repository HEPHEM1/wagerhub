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
    const { accountId, hbarAmount, winAmount, wagerAmount, direction } = await req.json();

    if (!accountId || (!hbarAmount && !winAmount && !wagerAmount)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const operatorId = (process.env.HEDERA_OPERATOR_ID || "").trim();
    const operatorKey = (process.env.HEDERA_OPERATOR_KEY || "").trim();
    const treasuryId = (process.env.NEXT_PUBLIC_TREASURY_ID || operatorId).trim();
    
    const WAGER_TOKEN_ID = "0.0.8818191";

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

    let tx: TransferTransaction;
    let memo = "WagerHub Payout";

    // ─── Case 1: Reverse Swap (WAGER -> HBAR) ──────────────────────────────
    if (direction === 'WAGER_TO_HBAR') {
      console.log(`[Payout API] Verifying WAGER -> HBAR Swap for ${accountId}...`);

      if (!wagerAmount) throw new Error("Wager amount missing for reverse swap");

      // Verify the Treasury received the $WAGER from the user via Mirror Node
      const verifyUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=${accountId}&type=cryptotransfer&result=success&limit=1`;
      const verifyRes = await fetch(verifyUrl);
      const verifyData = await verifyRes.json();

      const latestTx = verifyData.transactions?.[0];
      if (!latestTx) throw new Error("No successful transaction found for verification.");

      // $WAGER has 8 decimals
      const expectedTinyTokens = Math.floor(parseFloat(wagerAmount.toString()) * 1e8);
      
      const confirmedTransfer = latestTx.token_transfers?.find((t: any) => 
        t.token_id === WAGER_TOKEN_ID && 
        t.account === treasuryId && 
        t.amount === expectedTinyTokens
      );

      if (!confirmedTransfer) {
        console.error("[Payout API] Verification FAILED. Token transfer not found in latest tx.");
        return NextResponse.json({ error: "Verification failed: $WAGER not received by Treasury." }, { status: 403 });
      }

      // Calculate HBAR payout (100:1)
      const hbarToPayout = parseFloat(wagerAmount.toString()) / 100;
      memo = `WagerHub Reverse Swap: ${wagerAmount} $WAGER -> ${hbarToPayout} HBAR`;

      tx = new TransferTransaction()
        .addHbarTransfer(AccountId.fromString(treasuryId), new Hbar(hbarToPayout).negated())
        .addHbarTransfer(AccountId.fromString(accountId), new Hbar(hbarToPayout))
        .setTransactionMemo(memo);
    } 
    // ─── Case 2: Standard Swap (HBAR -> WAGER) or Game Win ─────────────────
    else {
      // Enforce 1 HBAR = 100 $WAGER exchange rate (Secure Backend Logic)
      const calculatedWagerAmount = hbarAmount 
        ? parseFloat(hbarAmount.toString()) 
        : parseFloat(winAmount.toString());

      const finalWagerAmount = hbarAmount ? calculatedWagerAmount * 100 : calculatedWagerAmount;

      // WAGER token has 8 decimals
      const amountInTokens = Math.floor(finalWagerAmount * 1e8);
      memo = hbarAmount ? "WagerHub Swap Payout" : "WagerHub Game Payout";

      tx = new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(treasuryId), -amountInTokens)
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(accountId), amountInTokens)
        .setTransactionMemo(memo);
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
