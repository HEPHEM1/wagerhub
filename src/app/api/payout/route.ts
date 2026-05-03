import { NextResponse } from "next/server";
import { Client, PrivateKey, TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";

export async function POST(req: Request) {
  try {
    const { accountId, winAmount } = await req.json();

    if (!accountId || !winAmount) {
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

    // WAGER token has 8 decimals
    const amountInTokens = Math.floor(parseFloat(winAmount) * 1e8);

    console.log(`[Payout API] Sending ${winAmount} WAGER from Treasury to ${accountId}...`);

    // Create the payout transfer transaction
    const tx = new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(treasuryId), -amountInTokens)
      .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(accountId), amountInTokens)
      .setTransactionMemo("WagerHub Blind Loot Payout");

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
      { error: "Failed to process payout." },
      { status: 500 }
    );
  }
}
