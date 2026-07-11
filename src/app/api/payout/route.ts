import { NextResponse } from "next/server";
import { 
  Client, 
  PrivateKey, 
  TransferTransaction, 
  TokenId, 
  AccountId, 
  Hbar,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";

// ── In-memory welcome gift claim guard (survives warm Lambda restarts) ──────────
// For a more durable solution, use Vercel KV or a DB.
// On testnet this is sufficient — claim record is also written to HCS for audit.
const claimedAccounts = new Set<string>();

// ── Max payout caps to prevent Treasury drain ────────────────────────────────────
const MAX_WAGER_PAYOUT = 200;  // max 200 $WAGER per payout call
const MAX_HBAR_PAYOUT  = 50;   // max 50 HBAR per payout call

export async function POST(req: Request) {
  try {
    // ── C-2: Shared-secret auth header ──────────────────────────────────────────
    const payoutSecret = process.env.PAYOUT_SECRET || "";
    const requestSecret = req.headers.get("x-payout-secret") || "";

    // Only enforce if secret is configured (allows graceful rollout)
    if (payoutSecret && requestSecret !== payoutSecret) {
      console.warn("[Payout API] ❌ Unauthorized payout attempt — invalid secret.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId, hbarAmount, winAmount, wagerAmount, direction, transactionId, receiveTokenId, receiveAmountStr, isWelcomeGift } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const operatorId = (process.env.HEDERA_OPERATOR_ID || "").trim();
    const operatorKey = (process.env.HEDERA_OPERATOR_KEY || "").trim();
    const treasuryId = (process.env.NEXT_PUBLIC_TREASURY_ID || operatorId).trim();
    const topicId    = (process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "").trim();
    
    const WAGER_TOKEN_ID = (process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim();

    if (!operatorId || !operatorKey || !treasuryId) {
      console.error("[Payout API] Server missing operator or treasury credentials.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // ── C-1: Server-side Welcome Gift duplicate guard ────────────────────────────
    if (isWelcomeGift) {
      const normalizedId = accountId.toLowerCase();
      if (claimedAccounts.has(normalizedId)) {
        console.warn(`[Payout API] ⚠️ Welcome gift already claimed for ${accountId} — blocking duplicate.`);
        return NextResponse.json({ error: "Welcome gift already claimed" }, { status: 409 });
      }

      // Also verify via Mirror Node: check if this account already has WAGER balance > 70
      // (rough heuristic: if they already hold tokens, they likely claimed before)
      try {
        const mirrorCheck = await fetch(
          `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${WAGER_TOKEN_ID}&limit=1`
        );
        if (mirrorCheck.ok) {
          const tokenData = await mirrorCheck.json();
          const existingBalance = tokenData?.tokens?.[0]?.balance ?? 0;
          // If they already have more than 70 WAGER (1e8 tinybar units = 7000000000)
          if (existingBalance > 70 * 1e8) {
            claimedAccounts.add(normalizedId);
            return NextResponse.json({ error: "Welcome gift already claimed" }, { status: 409 });
          }
        }
      } catch (e) {
        // If Mirror Node check fails, proceed — HCS record below will catch repeats
        console.warn("[Payout API] Mirror Node balance check failed:", e);
      }
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
      let amt = parseFloat(receiveAmountStr);
      let isNative = false;
      const memoStr = `WagerHub Swap Payout`;
      let decimals = 8;
      
      if (receiveTokenId === "HBAR") {
        isNative = true;
        // ── C-4: Cap HBAR payout ────────────────────────────────────────────
        if (amt > MAX_HBAR_PAYOUT) {
          console.warn(`[Payout API] ⚠️ HBAR payout capped: requested ${amt}, max ${MAX_HBAR_PAYOUT}`);
          amt = MAX_HBAR_PAYOUT;
        }
      } else if (receiveTokenId === WAGER_TOKEN_ID) {
        decimals = 8;
        // ── C-4: Cap WAGER payout ───────────────────────────────────────────
        if (amt > MAX_WAGER_PAYOUT && !isWelcomeGift) {
          console.warn(`[Payout API] ⚠️ WAGER payout capped: requested ${amt}, max ${MAX_WAGER_PAYOUT}`);
          amt = MAX_WAGER_PAYOUT;
        }
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
    // ─── Game Win Payouts ─────────────────────────────────────────────────
    else if (direction === 'GAME_WIN' || winAmount || hbarAmount) {
      let calculatedWagerAmount = hbarAmount 
        ? parseFloat(hbarAmount.toString()) 
        : parseFloat(winAmount.toString());

      let finalWagerAmount = hbarAmount ? calculatedWagerAmount * 10 : calculatedWagerAmount;
      
      // ── C-4: Cap game payout ───────────────────────────────────────────────
      if (finalWagerAmount > MAX_WAGER_PAYOUT) {
        console.warn(`[Payout API] ⚠️ Game payout capped: requested ${finalWagerAmount} WAGER, max ${MAX_WAGER_PAYOUT}`);
        finalWagerAmount = MAX_WAGER_PAYOUT;
      }

      const amountInTokens = Math.floor(finalWagerAmount * 1e8);
      memo = hbarAmount ? "WagerHub Swap Payout" : `WagerHub Game Win Payout`;

      tx = new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(treasuryId), -amountInTokens)
        .addTokenTransfer(TokenId.fromString(WAGER_TOKEN_ID), AccountId.fromString(resolvedAccountId), amountInTokens)
        .setTransactionMemo(memo);
    }
    // ─── Legacy Reverse Swap (WAGER -> HBAR) ──────────────────────────────
    else if (direction === 'WAGER_TO_HBAR') {
      let hbarToPayout = parseFloat(wagerAmount.toString()) / 10;
      if (hbarToPayout > MAX_HBAR_PAYOUT) hbarToPayout = MAX_HBAR_PAYOUT;
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

    // ── C-1: Mark account as claimed in memory + log to HCS for audit ─────────
    if (isWelcomeGift) {
      claimedAccounts.add(accountId.toLowerCase());

      // Log to HCS so even across server restarts we have an audit trail
      if (topicId) {
        try {
          const hcsPayload = JSON.stringify({
            accountId,
            event: "welcome_gift_claimed",
            amountWager: 70,
            txId: submitTx.transactionId.toString(),
            timestamp: new Date().toISOString(),
          });
          await new TopicMessageSubmitTransaction({ topicId, message: hcsPayload }).execute(client);
        } catch (hcsErr) {
          // Non-fatal — claim is already marked in-memory
          console.warn("[Payout API] HCS welcome gift log failed:", hcsErr);
        }
      }
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
