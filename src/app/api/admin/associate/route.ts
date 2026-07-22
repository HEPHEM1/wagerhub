import { NextResponse } from "next/server";
import { Client, PrivateKey, TokenAssociateTransaction, TokenId, AccountId } from "@hashgraph/sdk";

/**
 * GET /api/admin/associate
 * 
 * One-time setup endpoint to associate the Treasury account with the $WAGER token.
 * This is required before the Treasury can receive tokens from users.
 */
export async function GET(req: Request) {
  try {
    // ── Shared-secret auth header — fail closed if not configured ────────────────
    // Dedicated to this admin route; never exposed to the client bundle.
    const adminSecret = (process.env.ADMIN_SECRET || "").trim();
    if (!adminSecret) {
      console.error("[Admin Associate] ADMIN_SECRET is not configured — refusing request.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const requestSecret = req.headers.get("x-admin-secret") || "";
    if (requestSecret !== adminSecret) {
      console.warn("[Admin Associate] ❌ Unauthorized request — invalid secret.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const operatorId = (process.env.HEDERA_OPERATOR_ID || "").trim();
    const operatorKey = (process.env.HEDERA_OPERATOR_KEY || "").trim();
    const treasuryId = (process.env.NEXT_PUBLIC_TREASURY_ID || operatorId).trim();
    const wagerTokenId = (process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim();

    if (!operatorId || !operatorKey) {
      console.error("[Admin Associate] Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY.");
      return NextResponse.json({ error: "Server misconfiguration: Missing credentials" }, { status: 500 });
    }

    // Parse the private key (supports both ED25519 and ECDSA/Hex)
    const key = operatorKey.startsWith('0x') 
      ? PrivateKey.fromStringECDSA(operatorKey) 
      : PrivateKey.fromString(operatorKey);

    // Initialize the Hedera client
    const client = Client.forTestnet().setOperator(operatorId, key);

    console.log(`[Admin Associate] Attempting to associate Treasury (${treasuryId}) with Token (${wagerTokenId})...`);

    // Create and execute the association transaction
    const transaction = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(treasuryId))
      .setTokenIds([TokenId.fromString(wagerTokenId)]);

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(`[Admin Associate] Status: ${receipt.status.toString()}`);

    return NextResponse.json({
      success: true,
      message: `Treasury account ${treasuryId} successfully associated with token ${wagerTokenId}.`,
      status: receipt.status.toString(),
      transactionId: response.transactionId.toString()
    });

  } catch (error: any) {
    console.error("[Admin Associate] Error:", error);
    
    // Check if already associated to provide a more helpful message
    if (error.message && error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
      return NextResponse.json({
        success: true,
        message: "Treasury account is already associated with this token.",
        code: "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT"
      });
    }

    return NextResponse.json({ 
      error: "Failed to associate token.",
      message: error.message || "Unknown error",
      details: error.toString()
    }, { status: 500 });
  }
}
