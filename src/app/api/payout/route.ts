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
    const { accountId, hbarAmount, winAmount, wagerAmount, direction, transactionId } = await req.json();

    if (!accountId || (!hbarAmount && !winAmount && !wagerAmount)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    let tx: TransferTransaction;
    let memo = "WagerHub Payout";

    // ─── Case 1: Reverse Swap (WAGER -> HBAR) ──────────────────────────────
    if (direction === 'WAGER_TO_HBAR') {
      console.log(`[Payout API] Verifying WAGER -> HBAR Swap for ${accountId}...`);

      if (!wagerAmount) throw new Error("Wager amount missing for reverse swap");
      if (!transactionId) throw new Error("Transaction ID missing for verification");

      // Hedera Mirror Nodes require transaction IDs to be formatted as account-timestamp (e.g. 0.0.123-17123-456)
      // We must preserve the dots in the Account ID but replace the '@' and timestamp dot with hyphens
      const parts = transactionId.split('@');
      const accountIdPart = parts[0]; 
      const timestampPart = parts[1].replace('.', '-'); 
      const formattedTxId = `${accountIdPart}-${timestampPart}`;
      
      // Verify the Treasury received the $WAGER from the user via Mirror Node
      // We query the specific transaction ID to ensure we are verifying the correct swap
      const verifyUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${formattedTxId}`;
      console.log(`[Payout API] Querying Mirror Node: ${verifyUrl}`);

      const verifyRes = await fetch(verifyUrl);
      if (!verifyRes.ok) {
        throw new Error(`Mirror Node query failed for Tx ${formattedTxId}. Transaction might still be indexing.`);
      }

      const verifyData = await verifyRes.json();
      const latestTx = verifyData.transactions?.[0];
      
      if (!latestTx) throw new Error("No transaction details found on Mirror Node yet.");

      // $WAGER has 8 decimals
      const expectedTinyTokens = Math.floor(parseFloat(wagerAmount.toString()) * 1e8);
      
      // Look for the specific token transfer to our Treasury
      const confirmedTransfer = latestTx.token_transfers?.find((t: any) => 
        t.token_id === WAGER_TOKEN_ID && 
        t.account === treasuryId && 
        t.amount === expectedTinyTokens
      );

      if (!confirmedTransfer) {
        console.error("[Payout API] Verification FAILED. Token transfer not found in tx history.");
        console.log("[Payout API] Found transfers:", JSON.stringify(latestTx.token_transfers));
        return NextResponse.json({ 
          error: "Verification failed: Treasury did not receive the expected $WAGER amount.",
          foundTransfers: latestTx.token_transfers
        }, { status: 403 });
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
