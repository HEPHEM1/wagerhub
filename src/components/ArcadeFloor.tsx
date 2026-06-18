"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Swords, Dices, Lock, Grid3x3, TrendingUp, Disc3 } from "lucide-react";
import BlindLootMaster from "./BlindLootMaster";
import PenaltyShootoutPro from "./PenaltyShootoutPro";
import MysteryField from "./MysteryField";
import RpsZeroTrust from "./RpsZeroTrust";
import GravityDrop from "./GravityDrop";
import TrendRider from "./TrendRider";

// ── Coming Soon Game Definitions ─────────────────────────────────────────────
const COMING_SOON_GAMES = [
  {
    id: "degen-dice",
    title: "Degen Dice",
    tagline: "Pure Probability. Instant Payouts.",
    description: "Roll the on-chain dice. Pure probability, instant payouts, ultimate degen action.",
    icon: <Dices size={36} className="text-yellow-400" />,
    accentColor: "yellow",
    glowColor: "rgba(250,204,21,0.4)",
    borderGlow: "hover:shadow-[0_0_30px_rgba(250,204,21,0.25)] hover:border-yellow-500/60",
    bgImage: "/degen_dice.png",
  },
  {
    id: "naughts-nodes",
    title: "Naughts & Nodes",
    tagline: "1v1 Logic Battle",
    description: "The ultimate 1v1 logic battle. Stake your $WAGER and outsmart your opponent on the chain.",
    icon: <Grid3x3 size={36} className="text-cyan-400" />,
    accentColor: "cyan",
    glowColor: "rgba(0,255,255,0.4)",
    borderGlow: "hover:shadow-[0_0_30px_rgba(0,255,255,0.25)] hover:border-cyan-500/60",
    bgImage: "/naughts_nodes.png",
  },
  {
    id: "bulls-bears",
    title: "Bulls & Bears",
    tagline: "Market Momentum",
    description: "The classic trading showdown. Pick your side, place your bet, and ride the market momentum.",
    icon: <TrendingUp size={36} className="text-emerald-400" />,
    accentColor: "emerald",
    glowColor: "rgba(52,211,153,0.4)",
    borderGlow: "hover:shadow-[0_0_30px_rgba(52,211,153,0.25)] hover:border-emerald-500/60",
    bgImage: "/bulls_bears.png",
  },
  {
    id: "whale-spin",
    title: "Whale Spin",
    tagline: "High-Stakes Fortune",
    description: "High-stakes wheel of fortune. Will you land the massive Whale jackpot?",
    icon: <Disc3 size={36} className="text-purple-400" />,
    accentColor: "purple",
    glowColor: "rgba(168,85,247,0.4)",
    borderGlow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] hover:border-purple-500/60",
    bgImage: "/whale_spin.png",
  },
];

export default function ArcadeFloor() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const games = [
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
      backgroundImage: "bg-[url('/mystery%20field.jpg')]",
      overlayClass: "from-black/95 via-black/50 to-transparent",
    },
    {
      id: "rps-zero-trust",
      title: "RPS: ZERO TRUST",
      description: "Provably fair. Cryptographically secured.",
      icon: <Swords size={48} className="text-wager-purple" />,
      color: "bg-purple-500/10 border-purple-500/30",
      backgroundImage: "bg-[url('/rps.png')]",
      overlayClass: "from-black/95 via-black/50 to-transparent",
    },
    {
      id: "gravity-drop",
      title: "GRAVITY DROP",
      description: "Drop the ball. Defy the odds.",
      icon: <Target size={48} className="text-orange-500" />,
      color: "bg-orange-500/10 border-orange-500/30",
      backgroundImage: "bg-[url('/GD.jpg')]",
      overlayClass: "from-black/95 via-black/50 to-transparent",
    },
    {
      id: "trend-rider",
      title: "Trend Rider",
      description: "Live market prediction. Fast-paced trading.",
      icon: <Target size={48} className="text-wager-cyan" />,
      color: "bg-wager-cyan/10 border-wager-cyan/30",
      backgroundImage: "bg-[url('/Trend%20rider.jpg')]",
      overlayClass: "from-black/95 via-black/50 to-transparent",
    },
    {
      id: "blind-loot",
      title: "Blind Loot",
      description: "Minesweeper but brutally unfair.",
      icon: <Target size={48} className="text-wager-lime" />,
      color: "bg-wager-lime/10 border-wager-lime/30",
      backgroundImage: "bg-[url('/blind%20loot.jpg')]",
      overlayClass: "from-black/95 via-black/40 to-transparent",
    },
  ];

  return (
    <>
      {/* ── Active Games Grid ─────────────────────────────────────────────── */}
      <div className="w-full">
        <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-wager-lime animate-pulse shadow-[0_0_8px_rgba(204,255,0,0.8)]"></span>
          Arcade Floor
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
          {games.map((game) => (
            <motion.button
              key={game.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveGame(game.id)}
              className={`w-full aspect-[4/3] text-left p-8 glass-card flex flex-col justify-end gap-6 relative overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${game.color.replace('/10', '/5').replace('border-', 'hover:border-')} ${game.backgroundImage ? `${game.backgroundImage} bg-cover bg-center border-none` : ""}`}
            >
              {game.backgroundImage && (
                <div className={`absolute inset-0 bg-gradient-to-t ${game.overlayClass || 'from-black/95 via-black/40 to-transparent'} z-0`} />
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

      {/* ── Coming Soon Section ───────────────────────────────────────────── */}
      <div className="w-full mt-16">
        {/* Section Header */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
            <Lock size={14} className="text-zinc-500" />
            Coming Soon
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 rounded-full px-3 py-1">
            In Development
          </span>
        </div>

        {/* Coming Soon Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {COMING_SOON_GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              className={`
                group relative overflow-hidden rounded-3xl border border-white/10
                bg-cover bg-center aspect-[4/3] cursor-default
                transition-all duration-500
                ${game.borderGlow}
              `}
              style={{
                backgroundImage: game.bgImage ? `url('${game.bgImage}')` : undefined,
              }}
            >
              {/* Frosted glass overlay — dims the card to signal non-playable */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] group-hover:bg-black/50 transition-all duration-500 z-0" />

              {/* Gradient vignette bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent z-0" />

              {/* Subtle animated grid scanline */}
              <div
                className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500 z-0"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
                  backgroundSize: "100% 6px",
                }}
              />

              {/* COMING SOON Badge — top right */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full
                    border backdrop-blur-md
                    ${game.accentColor === 'cyan'    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' :
                      game.accentColor === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' :
                      game.accentColor === 'yellow'  ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300' :
                                                        'bg-purple-500/10 border-purple-500/40 text-purple-300'}
                  `}
                >
                  <Lock size={9} className="flex-shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Coming Soon</span>
                </motion.div>
              </div>

              {/* Card Content */}
              <div className="absolute inset-0 z-10 p-6 flex flex-col justify-end">
                {/* Icon badge */}
                <div
                  className={`
                    w-14 h-14 rounded-2xl mb-4 flex items-center justify-center
                    border backdrop-blur-md shadow-lg
                    ${game.accentColor === 'cyan'    ? 'bg-cyan-500/10 border-cyan-500/30' :
                      game.accentColor === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30' :
                      game.accentColor === 'yellow'  ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                        'bg-purple-500/10 border-purple-500/30'}
                  `}
                >
                  {game.icon}
                </div>

                {/* Tagline */}
                <p className={`
                  text-[10px] font-black uppercase tracking-widest mb-1
                  ${game.accentColor === 'cyan'    ? 'text-cyan-400' :
                    game.accentColor === 'emerald' ? 'text-emerald-400' :
                    game.accentColor === 'yellow'  ? 'text-yellow-400' :
                                                      'text-purple-400'}
                `}>
                  {game.tagline}
                </p>

                {/* Title */}
                <h3 className="text-2xl font-black text-white uppercase tracking-wide leading-tight mb-2">
                  {game.title}
                </h3>

                {/* Description */}
                <p className="text-xs font-mono text-zinc-400 leading-relaxed line-clamp-2">
                  {game.description}
                </p>

                {/* No-click indicator */}
                <div className="mt-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  <div className="w-4 h-px bg-zinc-700" />
                  <span>Not available yet</span>
                  <div className="flex-1 h-px bg-zinc-700" />
                </div>
              </div>

              {/* Hover neon border glow effect */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                style={{ boxShadow: `inset 0 0 40px ${game.glowColor}` }}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Focus Mode Overlay ────────────────────────────────────────────── */}
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
            {activeGame === "rps-zero-trust" && (
              <RpsZeroTrust onClose={() => setActiveGame(null)} />
            )}
            {activeGame === "gravity-drop" && (
              <GravityDrop onClose={() => setActiveGame(null)} />
            )}
            {activeGame === "trend-rider" && (
              <TrendRider onBack={() => setActiveGame(null)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
