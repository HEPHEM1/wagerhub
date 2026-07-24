"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, UserCircle, Loader2, MapPin } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";

interface LeaderboardEntry {
  rank: number;
  accountId: string;
  points: number;
}

export default function Leaderboard() {
  const { isConnected, accountId, wagerPoints } = useWagerWallet();
  const shortAccountId = accountId ? `${accountId.slice(0, 6)}...${accountId.slice(-4)}` : "";
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
        <div className="flex justify-center items-end gap-4 md:gap-8 min-h-[400px] pt-10">
          {/* Rank 2 */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-4 order-1">
              <div className={`relative w-20 h-20 rounded-full bg-zinc-800 border-4 flex items-center justify-center shadow-[0_0_30px_rgba(161,161,170,0.2)] ${isYou(2) ? "border-wager-cyan" : "border-zinc-400"}`}>
                <Medal size={40} className="text-zinc-400" />
                {isYou(2) && (
                  <span className="absolute -top-2 -right-2 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-32 md:w-48 bg-zinc-400/10 border-x border-t rounded-t-2xl h-48 flex flex-col items-center justify-center p-4 text-center ${isYou(2) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-zinc-400/30"}`}>
                <span className="text-3xl font-black text-zinc-400 mb-1">#2</span>
                <span className="text-xs font-mono text-white truncate w-full mb-2">{top3[1].accountId}</span>
                <span className="text-xl font-black text-zinc-300">{top3[1].points.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Rank 1 */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-4 order-2 -translate-y-12">
              <Trophy size={48} className="text-amber-400 animate-bounce mb-2" />
              <div className={`relative w-24 h-24 rounded-full bg-zinc-800 border-4 flex items-center justify-center shadow-[0_0_50px_rgba(251,191,36,0.4)] ${isYou(1) ? "border-wager-cyan" : "border-amber-400"}`}>
                <Medal size={48} className="text-amber-400" />
                {isYou(1) && (
                  <span className="absolute -top-2 -right-2 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-40 md:w-64 bg-amber-400/10 border-x border-t rounded-t-3xl h-64 flex flex-col items-center justify-center p-6 text-center ${isYou(1) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-amber-400/50"}`}>
                <span className="text-5xl font-black text-amber-400 mb-2">#1</span>
                <span className="text-sm font-mono text-white truncate w-full mb-3">{top3[0].accountId}</span>
                <span className="text-2xl font-black text-amber-300 tracking-wider">{top3[0].points.toLocaleString()}</span>
                <div className="mt-4 px-3 py-1 bg-amber-400/20 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-tighter">King Degen</div>
              </div>
            </div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <div className="flex flex-col items-center gap-4 order-3">
              <div className={`relative w-20 h-20 rounded-full bg-zinc-800 border-4 flex items-center justify-center shadow-[0_0_30px_rgba(180,83,9,0.2)] ${isYou(3) ? "border-wager-cyan" : "border-amber-700"}`}>
                <Medal size={40} className="text-amber-700" />
                {isYou(3) && (
                  <span className="absolute -top-2 -right-2 bg-wager-cyan text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]">YOU</span>
                )}
              </div>
              <div className={`w-32 md:w-48 bg-amber-700/10 border-x border-t rounded-t-2xl h-32 flex flex-col items-center justify-center p-4 text-center ${isYou(3) ? "border-wager-cyan/60 ring-1 ring-wager-cyan/40" : "border-amber-700/30"}`}>
                <span className="text-3xl font-black text-amber-700 mb-1">#3</span>
                <span className="text-xs font-mono text-white truncate w-full mb-2">{top3[2].accountId}</span>
                <span className="text-xl font-black text-amber-600">{top3[2].points.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The Rest of the List */}
      <div className="w-full flex flex-col gap-6">
        {/* Pinned "Your Rank" card — only when the user has a score and isn't already on the podium above */}
        {isConnected && currentUserEntry && (currentUserRank === undefined || currentUserRank > 3) && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-wager-cyan/10 border border-wager-cyan/40 shadow-[0_0_25px_rgba(0,255,255,0.12)]">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-wager-cyan/20 border border-wager-cyan/50 shrink-0">
              <MapPin size={16} className="text-wager-cyan" />
            </div>
            <div className="flex items-center justify-center w-12 shrink-0 font-black text-wager-cyan text-lg">
              {currentUserRank ? `#${currentUserRank}` : "-"}
            </div>
            <div className="flex-1 flex items-center gap-2 font-mono text-sm text-white min-w-0">
              <UserCircle size={16} className="text-wager-cyan shrink-0" />
              <span className="truncate">{shortAccountId}</span>
              <span className="text-[10px] font-black text-wager-cyan bg-wager-cyan/20 px-2 py-0.5 rounded-full shrink-0">YOU</span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-black text-wager-cyan">{currentUserMonthlyPoints.toLocaleString()}</span>
              <span className="text-[10px] text-wager-cyan/60 ml-1 font-bold">PTS</span>
            </div>
          </div>
        )}

        <div className="w-full glass-card overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            <div className="w-9 shrink-0 text-center">Rank</div>
            <div className="flex-1">Degen Wallet</div>
            <div className="shrink-0">WagerPoints</div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {theRest.map((user) => {
              const you = isConnected && currentUserRank === user.rank;
              return (
                <div
                  key={user.accountId}
                  className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${
                    you ? "bg-wager-cyan/10 border border-wager-cyan/30" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-xs font-black text-zinc-500 shrink-0">
                    {user.rank}
                  </div>
                  <div className="flex-1 flex items-center gap-2 font-mono text-sm text-zinc-300 min-w-0">
                    <span className="truncate">{user.accountId}</span>
                    {you && <span className="text-[10px] font-black text-wager-cyan bg-wager-cyan/20 px-2 py-0.5 rounded-full shrink-0">YOU</span>}
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
    </div>
  );
}
