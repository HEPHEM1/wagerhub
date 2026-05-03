import { NextResponse } from "next/server";
import { Client, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";

export async function POST(req: Request) {
  try {
    const { accountId, creditsEarned, totalCredits, event } = await req.json();

    if (!accountId || creditsEarned === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const operatorId = (process.env.HEDERA_OPERATOR_ID || "").trim();
    const operatorKey = (process.env.HEDERA_OPERATOR_KEY || "").trim();
    const topicId = (process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "").trim();

    if (!operatorId || !operatorKey || !topicId) {
      console.error("[HCS] Missing server environment variables for HCS.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Parse the private key properly based on its format (ECDSA vs ED25519)
    const key = operatorKey.startsWith('0x') 
      ? PrivateKey.fromStringECDSA(operatorKey) 
      : PrivateKey.fromString(operatorKey);

    // Initialize the Hedera client with the operator credentials
    // The operator will silently pay the tiny transaction fee for the HCS message
    const client = Client.forTestnet().setOperator(operatorId, key);

    const messagePayload = JSON.stringify({
      accountId,
      event: event || "swap",
      creditsEarned,
      totalCredits,
      timestamp: new Date().toISOString(),
    });

    console.log(`[HCS] Submitting leaderboard log: ${messagePayload}`);

    // Submit the message to the pre-created HCS Topic
    const transaction = new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: messagePayload,
    });

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);

    return NextResponse.json({
      success: true,
      status: receipt.status.toString(),
      topicSequenceNumber: receipt.topicSequenceNumber?.toString(),
    });

  } catch (error) {
    console.error("[HCS] Error submitting message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
