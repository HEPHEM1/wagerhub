"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Swords, Dices } from "lucide-react";
import BlindLootMaster from "./BlindLootMaster";
import PenaltyShootoutPro from "./PenaltyShootoutPro";
import MysteryField from "./MysteryField";

export default function ArcadeFloor() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const games = [
    {
      id: "blind-loot",
      title: "Blind Loot",
      description: "Minesweeper but brutally unfair.",
      icon: <Target size={48} className="text-wager-lime" />,
      color: "bg-wager-lime/10 border-wager-lime/30",
      backgroundImage: "bg-[url('/blind-loot-bg.jpg')]",
      overlayClass: "from-black/95 via-black/40 to-transparent",
    },
    {
      id: "penalty-shootout",
      title: "The Penalty",
      description: "Shoot for glory. Don't hit the keeper.",
      icon: <Swords size={48} className="text-wager-cyan" />,
      color: "bg-wager-cyan/10 border-wager-cyan/30",
      backgroundImage: "bg-[url('/PENALTY.jpg')]",
      overlayClass: "from-black/95 via-black/50 to-transparent",
    },
    {
      id: "mystery-field",
      title: "Mystery Field",
      description: "Hazard grid. Compound multipliers.",
      icon: <Target size={48} className="text-wager-cyan" />,
      color: "bg-wager-cyan/10 border-wager-cyan/30",
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
              className={`w-full aspect-[4/3] text-left p-8 glass-card flex flex-col justify-end gap-6 relative overflow-hidden transition-all duration-300 ${
                game.disabled ? "opacity-50 cursor-not-allowed grayscale" : `cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${game.color.replace('/10', '/5').replace('border-', 'hover:border-')}`
              } ${game.backgroundImage ? `${game.backgroundImage} bg-cover bg-center border-none` : ""}`}
            >
              {game.backgroundImage && (
                <div className={`absolute inset-0 bg-gradient-to-t ${game.overlayClass || 'from-black/95 via-black/40 to-transparent'} z-0`} />
              )}
              {game.disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <span className="font-black tracking-widest uppercase text-xl text-white/80">Coming Soon</span>
                </div>
              )}
              <div className="p-6 bg-wager-black rounded-2xl border border-white/5 shadow-inner self-start relative z-10">
                {game.icon}
              </div>
              <div className="flex flex-col mt-auto relative z-10">
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
              <BlindLootMaster onClose={() => setActiveGame(null)} />
            )}
            {activeGame === "penalty-shootout" && (
              <PenaltyShootoutPro onClose={() => setActiveGame(null)} />
            )}
            {activeGame === "mystery-field" && (
              <MysteryField onClose={() => setActiveGame(null)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
