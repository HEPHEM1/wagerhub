import { NextResponse } from "next/server";
import { Client, PrivateKey, TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";

export async function POST(req: Request) {
  try {
    const { accountId, winAmount } = await req.json();

    if (!accountId || !winAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    
    // Hardcoded Testnet Treasury Info (must match the .env Operator)
    const TREASURY_ACCOUNT_ID = "0.0.8800842";
    const WAGER_TOKEN_ID = "0.0.8818191";

    if (!operatorId || !operatorKey) {
      console.error("[Payout API] Server missing operator credentials.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (operatorId !== TREASURY_ACCOUNT_ID) {
      console.warn("[Payout API] Warning: Operator ID does not match Treasury Account ID.");
    }

    // Parse the private key properly based on its format (ECDSA vs ED25519)
    const key = operatorKey.length === 64 || operatorKey.startsWith('0x') 
      ? PrivateKey.fromStringECDSA(operatorKey) 
      : PrivateKey.fromString(operatorKey);

    // Initialize the Hedera client with the Treasury credentials
    const client = Client.forTestnet().setOperator(operatorId, key);

    // WAGER token has 8 decimals
    const amountInTokens = Math.floor(parseFloat(winAmount) * 1e8);

    console.log(`[Payout API] Sending ${winAmount} WAGER from Treasury to ${accountId}...`);

    // Create the payout transfer transaction
    const tx = new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(TREASURY_ACCOUNT_ID), -amountInTokens)
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
