import { NextResponse } from "next/server";

export async function GET() {
  const topicId = (process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "").trim();

  if (!topicId) {
    return NextResponse.json({ error: "Missing HCS Topic ID" }, { status: 500 });
  }

  try {
    // 1. Calculate the start of the current month in UTC
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    // The Mirror Node API expects timestamps in seconds.nanoseconds format
    const startTimestamp = (startOfMonth.getTime() / 1000).toFixed(0) + ".000000000";

    // 2. Fetch all messages for the current month
    let messages: any[] = [];
    let url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?timestamp=gte:${startTimestamp}&limit=100`;
    let pageCount = 0;
    const MAX_PAGES = 500; // safety cap against a malformed/self-referential links.next

    while (url && pageCount < MAX_PAGES) {
      pageCount++;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        throw new Error(`Mirror node returned ${res.status}`);
      }
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        messages = messages.concat(data.messages);
      }

      // Handle pagination
      if (data.links && data.links.next) {
        url = `https://testnet.mirrornode.hedera.com${data.links.next}`;
      } else {
        url = "";
      }
    }

    // 3. Aggregate points per accountId, deduping repeated submissions by
    // (accountId, consensus_timestamp) so a retried/replayed log-score call
    // isn't double-counted.
    const scores: Record<string, number> = {};
    const seenMessageKeys = new Set<string>();
    const MAX_EARNED_PER_MESSAGE = 5000; // matches the server-side cap in /api/log-score

    for (const m of messages) {
      try {
        const rawStr = Buffer.from(m.message, "base64").toString("utf-8");
        const parsed = JSON.parse(rawStr);

        const rawAccountId = typeof parsed.accountId === "string" ? parsed.accountId.trim() : null;
        // Support both old "creditsEarned" and new "pointsEarned" keys for smooth transition
        const rawEarned = parsed.pointsEarned ?? parsed.creditsEarned ?? 0;

        if (rawAccountId && typeof rawEarned === 'number' && isFinite(rawEarned)) {
          // Normalize consistently regardless of address format (0x EVM vs 0.0.x native)
          const accountId = rawAccountId.toLowerCase();

          // Dedupe: the same message read twice via pagination overlap, or a
          // genuine client-side retry recorded as an identical event, should
          // only count once.
          const dedupeKey = `${accountId}:${m.consensus_timestamp}`;
          if (seenMessageKeys.has(dedupeKey)) continue;
          seenMessageKeys.add(dedupeKey);

          // Re-validate bounds when reading back — don't trust the topic
          // blindly even though the writer path already caps this.
          const earned = Math.max(0, Math.min(rawEarned, MAX_EARNED_PER_MESSAGE));

          if (!scores[accountId]) {
            scores[accountId] = 0;
          }
          scores[accountId] += earned;
        }
      } catch (e) {
        // Ignore invalid/unparseable messages
      }
    }

    // 4. Convert to array and sort descending
    const leaderboard = Object.entries(scores)
      .map(([accountId, points]) => ({ accountId, points }))
      .sort((a, b) => b.points - a.points);

    // 5. Assign ranks
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      accountId: entry.accountId,
      points: entry.points
    }));

    // Generate a simple response structure.
    // Short CDN-level cache so many simultaneous 30s client polls don't each
    // trigger a fresh full-month Mirror Node replay.
    return NextResponse.json(
      {
        success: true,
        month: startOfMonth.toISOString(),
        data: rankedLeaderboard
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );

  } catch (error: any) {
    console.error("[Leaderboard API] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
