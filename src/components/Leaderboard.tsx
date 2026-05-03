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
  return (
    <aside className="w-80 h-full bg-wager-charcoal/30 border-l border-wager-charcoal flex flex-col flex-shrink-0">
      <div className="p-4 bg-wager-black border-b border-wager-charcoal flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-wager-lime" size={20} />
          <h3 className="font-black text-white tracking-widest uppercase">Top Degens</h3>
        </div>
        <span className="text-[10px] text-wager-cyan uppercase font-bold px-2 py-1 bg-wager-cyan/10 rounded">Season 1</span>
      </div>
      
      <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {LEADERBOARD_DATA.map((user) => (
          <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl bg-wager-black/50 border ${user.border}`}>
            <div className="flex items-center gap-3">
              <span className={`font-black w-6 text-center ${user.color}`}>
                {user.rank <= 3 ? <Medal size={20} className="mx-auto" /> : `#${user.rank}`}
              </span>
              <span className="font-mono text-sm text-zinc-300">{user.wallet}</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-wager-lime">{user.points}</div>
              <div className="text-[10px] text-zinc-500 uppercase">Pts</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
