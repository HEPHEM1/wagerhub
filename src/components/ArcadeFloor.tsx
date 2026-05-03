"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Swords, Dices } from "lucide-react";
import BlindLootGame from "./BlindLootGame";

export default function ArcadeFloor() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const games = [
    {
      id: "blind-loot",
      title: "Blind Loot",
      description: "Minesweeper but brutally unfair.",
      icon: <Target size={48} className="text-wager-lime" />,
      color: "bg-wager-lime/10 border-wager-lime/30",
    },
    {
      id: "crash-test",
      title: "Crash Test",
      description: "Cash out before it rekt.",
      icon: <Swords size={48} className="text-wager-red" />,
      color: "bg-wager-red/10 border-wager-red/30",
      disabled: true,
    },
    {
      id: "degen-dice",
      title: "Degen Dice",
      description: "Roll under, win big.",
      icon: <Dices size={48} className="text-wager-cyan" />,
      color: "bg-wager-cyan/10 border-wager-cyan/30",
      disabled: true,
    },
  ];

  return (
    <>
      <div className="w-full">
        <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          Arcade Floor
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
          {games.map((game) => (
            <motion.button
              key={game.id}
              whileHover={!game.disabled ? { scale: 1.02 } : {}}
              whileTap={!game.disabled ? { scale: 0.98 } : {}}
              onClick={() => !game.disabled && setActiveGame(game.id)}
              disabled={game.disabled}
              className={`w-full aspect-[4/3] text-left p-8 rounded-3xl border bg-wager-charcoal/50 backdrop-blur-sm flex flex-col justify-end gap-6 relative overflow-hidden transition-colors shadow-xl ${
                game.disabled ? "opacity-50 cursor-not-allowed grayscale" : `cursor-pointer hover:bg-wager-charcoal ${game.color}`
              }`}
            >
              {game.disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <span className="font-black tracking-widest uppercase text-xl text-white/80">Coming Soon</span>
                </div>
              )}
              <div className="p-6 bg-wager-black rounded-2xl border border-white/5 shadow-inner self-start">
                {game.icon}
              </div>
              <div className="flex flex-col mt-auto">
                <h3 className="text-3xl font-black text-white uppercase tracking-wider">{game.title}</h3>
                <p className="text-lg font-mono text-zinc-400 mt-2">{game.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {activeGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md"
          >
            {activeGame === "blind-loot" && (
              <BlindLootGame onClose={() => setActiveGame(null)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
