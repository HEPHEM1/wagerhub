"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Loader2, MapPin } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";

interface LeaderboardEntry {
  rank: number;
  accountId: string;
  points: number;
}

// Deterministic hue from an account ID so each wallet gets a stable,
// distinguishable avatar color instead of one flat generic icon everywhere.
function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function WalletAvatar({ accountId, size = 32 }: { accountId: string; size?: number }) {
  const hue = hashHue(accountId);
  return (
    <div
      className="rounded-full shrink-0 border border-white/10"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${(hue + 50) % 360}, 65%, 38%))`,
      }}
    />
  );
}

export default function Leaderboard() {
  const { isConnected, accountId, hederaAccountId, wagerPoints } = useWagerWallet();
  const shortAccountId = hederaAccountId || (accountId ? `${accountId.slice(0, 6)}...${accountId.slice(-4)}` : "");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setLeaderboardData(json.data);
          setFetchError(null);
        } else {
          setFetchError(json?.error || "Failed to load leaderboard.");
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard", e);
        setFetchError("Failed to load leaderboard.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // Live poll every 30s
    return () => clearInterval(interval);
  }, []);

  const top3 = leaderboardData.slice(0, 3);
  const theRest = leaderboardData.slice(3);
  const currentUserEntry = leaderboardData.find(u => {
    // The API resolves EVM addresses to Hedera format (0.0.X) when it can, but
    // falls back to the raw EVM address if Mirror Node resolution failed —
    // so match against whichever format the entry actually ended up in.
    if (hederaAccountId && u.accountId === hederaAccountId) return true;
    const norm1 = u.accountId.startsWith('0x') ? u.accountId.toLowerCase() : u.accountId;
    const norm2 = accountId?.startsWith('0x') ? accountId.toLowerCase() : accountId;
    return norm1 === norm2;
  });
  const currentUserRank = currentUserEntry?.rank;
  const currentUserMonthlyPoints = currentUserEntry?.points || 0;
  const isYou = (rank: number) => isConnected && currentUserRank === rank;

  return (
    <div className="w-full max-w-6xl mx-auto p-8 flex flex-col gap-12">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] italic">Leaderboard</h2>
        <span className="text-xs text-wager-cyan font-bold tracking-widest px-4 py-1 bg-wager-cyan/10 rounded-full border border-wager-cyan/20">SEASON 1: THE GENESIS</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-wager-cyan w-12 h-12 mb-4" />
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Syncing HCS Ledger...</span>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
          <span className="text-wager-red font-bold uppercase tracking-widest text-sm">Couldn't load the leaderboard right now.</span>
          <span className="text-zinc-600 text-xs font-mono">{fetchError}</span>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No activity yet this season. Start swapping to appear here!</span>
        </div>
      ) : (
        <div className="flex justify-center items-end gap-4 md:gap-8 min-h-[420px] pt-10">
          {/* Rank 2 */}
          {top3[1] && (
            <div className="flex flex-col items-center order-1">
              <div className="relative mb-3">
                <div className={`w-20 h-20 rounded-full p-[3px] bg-gradient-to-br shadow-[0_0_25px_rgba(161,161,170,0.25)] ${isYou(2) ? "from-wager-cyan to-cyan-700" : "from-zinc-300 to-zinc-600"}`}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <Medal size={36} className="text-zinc-300" />
                  </div>
                </div>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-zinc-700 border-2 border-slate-950 flex items-center justify-center text-xs font-black text-white">2</span>
                {isYou(2) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-32 md:w-48 rounded-t-2xl h-48 flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-b from-zinc-400/15 to-transparent border-t border-x backdrop-blur-sm ${isYou(2) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-zinc-400/25"}`}>
                <span className="font-mono text-[10px] text-zinc-300 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full truncate max-w-full">{top3[1].accountId}</span>
                <span className="text-2xl font-black bg-gradient-to-b from-zinc-100 to-zinc-400 bg-clip-text text-transparent">{top3[1].points.toLocaleString()}</span>
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em]">WagerPoints</span>
              </div>
            </div>
          )}

          {/* Rank 1 */}
          {top3[0] && (
            <div className="flex flex-col items-center order-2 -translate-y-10">
              <Trophy size={40} className="text-amber-400 animate-bounce mb-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
              <div className="relative mb-3">
                <div className={`w-24 h-24 rounded-full p-[3px] bg-gradient-to-br shadow-[0_0_45px_rgba(251,191,36,0.45)] ${isYou(1) ? "from-wager-cyan to-cyan-700" : "from-amber-300 to-amber-600"}`}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <Medal size={42} className="text-amber-400" />
                  </div>
                </div>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-950 flex items-center justify-center text-sm font-black text-black">1</span>
                {isYou(1) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-40 md:w-64 rounded-t-3xl h-64 flex flex-col items-center justify-center gap-2.5 p-6 text-center bg-gradient-to-b from-amber-400/15 to-transparent border-t border-x backdrop-blur-sm ${isYou(1) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-amber-400/40"}`}>
                <div className="px-3 py-1 bg-amber-400/20 border border-amber-400/30 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-widest">King Degen</div>
                <span className="font-mono text-xs text-white bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full truncate max-w-full">{top3[0].accountId}</span>
                <span className="text-3xl font-black bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent tracking-wide">{top3[0].points.toLocaleString()}</span>
                <span className="text-[9px] text-amber-400/70 font-black uppercase tracking-[0.2em]">WagerPoints</span>
              </div>
            </div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <div className="flex flex-col items-center order-3">
              <div className="relative mb-3">
                <div className={`w-20 h-20 rounded-full p-[3px] bg-gradient-to-br shadow-[0_0_25px_rgba(180,83,9,0.25)] ${isYou(3) ? "from-wager-cyan to-cyan-700" : "from-amber-600 to-amber-900"}`}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <Medal size={36} className="text-amber-700" />
                  </div>
                </div>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-800 border-2 border-slate-950 flex items-center justify-center text-xs font-black text-white">3</span>
                {isYou(3) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-32 md:w-48 rounded-t-2xl h-32 flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-b from-amber-700/15 to-transparent border-t border-x backdrop-blur-sm ${isYou(3) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-amber-700/25"}`}>
                <span className="font-mono text-[10px] text-zinc-300 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full truncate max-w-full">{top3[2].accountId}</span>
                <span className="text-xl font-black bg-gradient-to-b from-amber-500 to-amber-700 bg-clip-text text-transparent">{top3[2].points.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The Rest of the List — a real ranked table */}
      <div className="w-full rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/10 bg-white/[0.03] text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
          <div className="w-8 shrink-0 text-center">Rank</div>
          <div className="w-8 shrink-0" />
          <div className="flex-1">Wallet</div>
          <div className="shrink-0 text-right">WagerPoints</div>
        </div>

        <div className="divide-y divide-white/5">
          {/* Pinned "Your Rank" row — only when the user has a score and isn't already on the podium above */}
          {isConnected && currentUserEntry && (currentUserRank === undefined || currentUserRank > 3) && (
            <div className="flex items-center gap-4 px-5 py-3.5 bg-wager-cyan/[0.08] border-l-2 border-wager-cyan">
              <div className="w-8 shrink-0 text-center font-black text-wager-cyan text-sm">
                {currentUserRank ? `#${currentUserRank}` : <MapPin size={14} className="mx-auto text-wager-cyan" />}
              </div>
              <WalletAvatar accountId={accountId || "you"} size={28} />
              <div className="flex-1 flex items-center gap-2 font-mono text-sm text-white min-w-0">
                <span className="truncate">{shortAccountId}</span>
                <span className="text-[9px] font-black text-wager-cyan bg-wager-cyan/20 px-2 py-0.5 rounded-full shrink-0">YOU</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-black text-wager-cyan">{currentUserMonthlyPoints.toLocaleString()}</span>
                <span className="text-[10px] text-wager-cyan/60 ml-1 font-bold">PTS</span>
              </div>
            </div>
          )}

          {theRest.map((user) => {
            const you = isConnected && currentUserRank === user.rank;
            return (
              <div
                key={user.accountId}
                className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                  you ? "bg-wager-cyan/[0.08] border-l-2 border-wager-cyan" : "hover:bg-white/[0.03] border-l-2 border-transparent"
                }`}
              >
                <div className="w-8 shrink-0 text-center text-sm font-black text-zinc-500">{user.rank}</div>
                <WalletAvatar accountId={user.accountId} size={28} />
                <div className="flex-1 flex items-center gap-2 font-mono text-sm text-zinc-300 min-w-0">
                  <span className="truncate">{user.accountId}</span>
                  {you && <span className="text-[9px] font-black text-wager-cyan bg-wager-cyan/20 px-2 py-0.5 rounded-full shrink-0">YOU</span>}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-wager-lime">{user.points.toLocaleString()}</span>
                  <span className="text-[10px] text-zinc-600 ml-1 font-bold">PTS</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
