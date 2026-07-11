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

    while (url) {
      const res = await fetch(url);
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

    // 3. Aggregate points per accountId
    const scores: Record<string, number> = {};

    for (const m of messages) {
      try {
        const rawStr = atob(m.message);
        const parsed = JSON.parse(rawStr);

        const rawAccountId = parsed.accountId;
        // Support both old "creditsEarned" and new "pointsEarned" keys for smooth transition
        const earned = parsed.pointsEarned || parsed.creditsEarned || 0;

        if (rawAccountId && typeof earned === 'number') {
          const accountId = rawAccountId.startsWith('0x') ? rawAccountId.toLowerCase() : rawAccountId;
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

    // Generate a simple response structure
    return NextResponse.json({
      success: true,
      month: startOfMonth.toISOString(),
      data: rankedLeaderboard
    });

  } catch (error: any) {
    console.error("[Leaderboard API] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
