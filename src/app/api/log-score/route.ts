import { NextResponse } from "next/server";
import { Client, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";

// ── In-memory rate limiter: max 20 submissions per wallet per hour ────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

// ── Server-side point caps per event type ────────────────────────────────────
const MAX_POINTS: Record<string, number> = {
  swap:           5000,   // max 5000 pts per swap (daily bonus cap)
  game:           800,    // max 800 pts per game round
  daily_claim:    100,    // max 100 pts per 12h claim
  welcome_gift:   0,      // welcome gift doesn't earn points, block it
  default:        1000,   // fallback cap
};

export async function POST(req: Request) {
  try {
    const { accountId, pointsEarned, totalPoints, event } = await req.json();

    if (!accountId || pointsEarned === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Basic shape validation on attacker-controlled fields ──────────────────
    if (typeof accountId !== "string" || accountId.length === 0 || accountId.length > 80) {
      return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
    }
    if (event !== undefined && typeof event !== "string") {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    if (totalPoints !== undefined && (typeof totalPoints !== "number" || !isFinite(totalPoints))) {
      return NextResponse.json({ error: "Invalid totalPoints" }, { status: 400 });
    }

    // ── C-6: Validate pointsEarned is a positive number ───────────────────────
    const rawPoints = Number(pointsEarned);
    if (!isFinite(rawPoints) || rawPoints < 0) {
      return NextResponse.json({ error: "Invalid pointsEarned value" }, { status: 400 });
    }

    const eventKey = (event || "default").toLowerCase();
    const cap = MAX_POINTS[eventKey] ?? MAX_POINTS.default;
    const sanitizedPoints = Math.min(rawPoints, cap);
    // Bound the client-reported running total embedded in the HCS record —
    // it's informational only (the leaderboard re-derives real totals from
    // summed pointsEarned), but keep it sane rather than trusting it blindly.
    const sanitizedTotalPoints = typeof totalPoints === "number"
      ? Math.max(0, Math.min(totalPoints, 100_000_000))
      : totalPoints;

    if (sanitizedPoints === 0 && rawPoints > 0) {
      console.warn(`[HCS] ⚠️ Points for event "${eventKey}" are zero — blocked.`);
      return NextResponse.json({ error: "Event not eligible for points" }, { status: 400 });
    }

    // ── M-7: Rate limiting per wallet ─────────────────────────────────────────
    const walletKey = accountId.toLowerCase();
    const now = Date.now();

    // Bound the map's memory growth: sweep out expired entries once it gets large.
    if (rateLimitMap.size > 5000) {
      for (const [key, val] of rateLimitMap) {
        if (now - val.windowStart >= RATE_LIMIT_WINDOW) rateLimitMap.delete(key);
      }
    }

    const limiter = rateLimitMap.get(walletKey);

    if (limiter) {
      if (now - limiter.windowStart < RATE_LIMIT_WINDOW) {
        if (limiter.count >= RATE_LIMIT_MAX) {
          console.warn(`[HCS] ⚠️ Rate limit exceeded for ${accountId}`);
          return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
        }
        limiter.count++;
      } else {
        // Reset window
        rateLimitMap.set(walletKey, { count: 1, windowStart: now });
      }
    } else {
      rateLimitMap.set(walletKey, { count: 1, windowStart: now });
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
      event: eventKey,
      pointsEarned: sanitizedPoints,
      totalPoints: sanitizedTotalPoints,
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
      pointsRecorded: sanitizedPoints,
    });

  } catch (error) {
    console.error("[HCS] Error submitting message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
