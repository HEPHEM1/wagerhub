import { NextResponse } from "next/server";

// ── Safe static fallbacks (used if both APIs fail) ───────────────────────────
const FALLBACK: Record<string, number> = {
  HBAR: 0.07,
  USDC: 1.00,
  USDT: 1.00,
};

export async function GET() {
  // Start with fallbacks; we overwrite with live data below
  const prices: Record<string, number> = { ...FALLBACK };

  // ── PRIMARY: SaucerSwap public API ───────────────────────────────────────────
  let saucerOk = false;
  try {
    const res = await fetch("https://api.saucerswap.finance/tokens", {
      headers: { Accept: "application/json" },
      // next.js fetch cache: allow background revalidation
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const tokens = await res.json();
      if (Array.isArray(tokens)) {
        for (const t of tokens) {
          // Isolate each entry so one malformed token can't silently abort
          // processing of the rest (and falsely leave saucerOk stuck true).
          try {
            const sym = t?.symbol?.toUpperCase?.();
            const p = Number(t?.priceUsd);
            if (!p || !isFinite(p) || p <= 0) continue;

            if ((sym === "HBAR" || sym === "WHBAR") && p > 0.001) {
              prices.HBAR = p;
              saucerOk = true;
            } else if (sym === "USDC" && p > 0.9 && p < 1.1) {
              prices.USDC = p;
            } else if ((sym === "USDT" || sym?.includes("USDT")) && p > 0.9 && p < 1.1) {
              prices.USDT = p;
            }
          } catch (innerErr) {
            // Skip this malformed entry, keep processing the rest
          }
        }
      }
    }
  } catch (e) {
    console.warn("[/api/prices] SaucerSwap fetch failed:", e);
  }

  // ── FALLBACK: CoinGecko simple price (no API key needed) ─────────────────────
  if (!saucerOk) {
    try {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph,usd-coin,tether&vs_currencies=usd",
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
      );
      if (cgRes.ok) {
        const data: Record<string, { usd: number }> = await cgRes.json();
        if (data["hedera-hashgraph"]?.usd > 0.001) prices.HBAR = data["hedera-hashgraph"].usd;
        if (data["usd-coin"]?.usd > 0.9)           prices.USDC = data["usd-coin"].usd;
        if (data["tether"]?.usd > 0.9)             prices.USDT = data["tether"].usd;
      }
    } catch (e) {
      console.warn("[/api/prices] CoinGecko fetch also failed. Using static fallback:", e);
    }
  }

  // $WAGER RULE: ALWAYS derived from live HBAR price. Never from any API.
  prices["$WAGER"] = prices.HBAR / 10;

  const source = saucerOk ? "saucerswap" : prices.HBAR !== FALLBACK.HBAR ? "coingecko" : "fallback";
  console.log(`[/api/prices] OK via ${source}:`, prices);

  return NextResponse.json(
    { source, prices, updatedAt: Date.now() },
    {
      headers: {
        // Tell browser not to cache; Next.js server handles revalidation
        "Cache-Control": "no-store",
      },
    }
  );
}
