"use client";

import { Trophy, Medal } from "lucide-react";

const LEADERBOARD_DATA = [
  { id: 1, rank: 1, wallet: "0x7F...3a9B", points: "245,000", color: "text-yellow-400", border: "border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.1)]" },
  { id: 2, rank: 2, wallet: "0x1A...8f2C", points: "182,500", color: "text-zinc-300", border: "border-zinc-300/50 shadow-[0_0_15px_rgba(212,212,216,0.1)]" },
  { id: 3, rank: 3, wallet: "0x9E...4d5F", points: "140,200", color: "text-amber-600", border: "border-amber-600/50 shadow-[0_0_15px_rgba(217,119,6,0.1)]" },
  { id: 4, rank: 4, wallet: "0x3B...1e7A", points: "95,000", color: "text-zinc-500", border: "border-white/5" },
  { id: 5, rank: 5, wallet: "0x5C...2b8D", points: "88,400", color: "text-zinc-500", border: "border-white/5" },
  { id: 6, rank: 6, wallet: "0x8D...9c1E", points: "76,100", color: "text-zinc-500", border: "border-white/5" },
  { id: 7, rank: 7, wallet: "0x2F...6a4B", points: "65,900", color: "text-zinc-500", border: "border-white/5" },
  { id: 8, rank: 8, wallet: "0x4A...2e1D", points: "54,300", color: "text-zinc-500", border: "border-white/5" },
  { id: 9, rank: 9, wallet: "0x1B...7c4F", points: "49,100", color: "text-zinc-500", border: "border-white/5" },
  { id: 10, rank: 10, wallet: "0x9C...3b8A", points: "42,000", color: "text-zinc-500", border: "border-white/5" },
];

export default function Leaderboard() {
  const top3 = LEADERBOARD_DATA.slice(0, 3);
  const theRest = LEADERBOARD_DATA.slice(3);

  return (
    <div className="w-full max-w-6xl mx-auto p-8 flex flex-col gap-12">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] italic">Leaderboard</h2>
        <span className="text-xs text-wager-cyan font-bold tracking-widest px-4 py-1 bg-wager-cyan/10 rounded-full border border-wager-cyan/20">SEASON 1: THE GENESIS</span>
      </div>

      {/* The Podium */}
      <div className="flex justify-center items-end gap-4 md:gap-8 min-h-[400px] pt-10">
        {/* Rank 2 */}
        <div className="flex flex-col items-center gap-4 order-1">
          <div className="w-20 h-20 rounded-full bg-zinc-800 border-4 border-zinc-400 flex items-center justify-center shadow-[0_0_30px_rgba(161,161,170,0.2)]">
            <Medal size={40} className="text-zinc-400" />
          </div>
          <div className="w-32 md:w-48 bg-zinc-400/10 border-x border-t border-zinc-400/30 rounded-t-2xl h-48 flex flex-col items-center justify-center p-4 text-center">
            <span className="text-3xl font-black text-zinc-400 mb-1">#2</span>
            <span className="text-xs font-mono text-white truncate w-full mb-2">{top3[1].wallet}</span>
            <span className="text-xl font-black text-zinc-300">{top3[1].points}</span>
          </div>
        </div>

        {/* Rank 1 */}
        <div className="flex flex-col items-center gap-4 order-2 -translate-y-12">
          <Trophy size={48} className="text-amber-400 animate-bounce mb-2" />
          <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-amber-400 flex items-center justify-center shadow-[0_0_50px_rgba(251,191,36,0.4)]">
            <Medal size={48} className="text-amber-400" />
          </div>
          <div className="w-40 md:w-64 bg-amber-400/10 border-x border-t border-amber-400/50 rounded-t-3xl h-64 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-5xl font-black text-amber-400 mb-2">#1</span>
            <span className="text-sm font-mono text-white truncate w-full mb-3">{top3[0].wallet}</span>
            <span className="text-2xl font-black text-amber-300 tracking-wider">{top3[0].points}</span>
            <div className="mt-4 px-3 py-1 bg-amber-400/20 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-tighter">King Degen</div>
          </div>
        </div>

        {/* Rank 3 */}
        <div className="flex flex-col items-center gap-4 order-3">
          <div className="w-20 h-20 rounded-full bg-zinc-800 border-4 border-amber-700 flex items-center justify-center shadow-[0_0_30px_rgba(180,83,9,0.2)]">
            <Medal size={40} className="text-amber-700" />
          </div>
          <div className="w-32 md:w-48 bg-amber-700/10 border-x border-t border-amber-700/30 rounded-t-2xl h-32 flex flex-col items-center justify-center p-4 text-center">
            <span className="text-3xl font-black text-amber-700 mb-1">#3</span>
            <span className="text-xs font-mono text-white truncate w-full mb-2">{top3[2].wallet}</span>
            <span className="text-xl font-black text-amber-600">{top3[2].points}</span>
          </div>
        </div>
      </div>

      {/* The Rest of the List */}
      <div className="w-full glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-8">Degen Wallet</div>
          <div className="col-span-3 text-right">Arcade Points</div>
        </div>
        <div className="divide-y divide-white/5">
          {theRest.map((user, idx) => (
            <div key={user.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-white/5 ${idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"}`}>
              <div className="col-span-1 text-center font-black text-zinc-500">#{user.rank}</div>
              <div className="col-span-8 font-mono text-sm text-zinc-300">{user.wallet}</div>
              <div className="col-span-3 text-right">
                <span className="font-black text-wager-lime">{user.points}</span>
                <span className="text-[10px] text-zinc-600 ml-1 font-bold">PTS</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
