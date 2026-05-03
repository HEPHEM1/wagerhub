"use client";

import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { Lock, ArrowRightLeft, TrendingUp, Crosshair } from "lucide-react";

const bentoContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const bentoCardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: [0, -3, 0],
    transition: {
      opacity: { duration: 0.8 },
      y: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
};

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  return (
    <div className="w-full h-full relative overflow-y-auto overflow-x-hidden custom-scrollbar bg-black">
      
      {/* Background Particles */}
      {init && (
        <Particles
          id="tsparticles"
          className="fixed inset-0 pointer-events-none z-0 blur-[1.5px]"
          options={{
            background: {
              color: { value: "transparent" },
            },
            fpsLimit: 60,
            interactivity: {
              events: {
                onClick: { enable: false },
                onHover: { enable: true, mode: "bubble" },
              },
              modes: {
                bubble: { distance: 200, size: 20, duration: 2, opacity: 0.8 },
              },
            },
            particles: {
              color: { value: ["#ccff00", "#00ffff", "#333333"] },
              shape: {
                type: "char",
                options: {
                  char: [
                    { value: "ℏ", font: "sans-serif", weight: "bold" },
                    { value: "$", font: "sans-serif", weight: "bold" },
                    { value: "W", font: "sans-serif", weight: "bold" },
                    { value: "₮", font: "sans-serif", weight: "bold" }
                  ]
                }
              },
              opacity: {
                value: { min: 0.1, max: 0.25 },
              },
              size: {
                value: { min: 8, max: 40 },
              },
              move: {
                direction: "bottom",
                enable: true,
                speed: { min: 1, max: 2.5 },
                straight: false,
                outModes: { default: "out" },
              },
              number: {
                density: { enable: true, width: 800, height: 800 },
                value: 150,
              },
            },
            detectRetina: true,
          }}
        />
      )}

      {/* Hero Section */}
      <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-center p-8 z-10 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-center max-w-5xl flex flex-col items-center w-full"
        >
          <div className="mb-6 inline-block">
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-white uppercase italic">
              Wager<span className="text-wager-lime">Hub</span>
            </h1>
          </div>
          
          <motion.h2 
            animate={{
              textShadow: [
                "0px 0px 10px rgba(255,255,255,0.1)",
                "0px 0px 30px rgba(255,255,255,0.5)",
                "0px 0px 10px rgba(255,255,255,0.1)",
              ]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-4xl md:text-6xl font-black text-white uppercase tracking-wider mb-8"
          >
            Provably Fair. <br/>
            <span className="text-wager-red">Brutally Fun.</span>
          </motion.h2>

          <p className="text-xl md:text-2xl font-mono text-zinc-400 mb-16 leading-relaxed max-w-3xl mx-auto">
            The ultimate Hedera risk protocol. Swap any asset. Survive the grid. Climb the leaderboard.
          </p>

          {/* Fluid Pulse CTA */}
          <div className="relative inline-block mb-20">
            {/* The expanding liquid ring */}
            <motion.div
              animate={{
                scale: [1, 1.4],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute inset-0 border-2 border-wager-cyan rounded-full"
            />
            
            {/* The actual button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnter}
              className="relative z-10 px-12 py-6 font-black uppercase tracking-widest text-black bg-wager-cyan rounded-full text-2xl transition-all shadow-[0_0_40px_rgba(0,255,255,0.4)] hover:shadow-[0_0_60px_rgba(0,255,255,0.6)]"
            >
              Enter The Arcade
            </motion.button>
          </div>

          {/* Protocol Stats Ticker */}
          <div className="w-full max-w-4xl bg-wager-charcoal/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row justify-around items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase font-bold tracking-widest text-zinc-500 mb-2">Total Volume</span>
              <span className="font-mono text-2xl text-wager-lime font-bold tracking-wider drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">$0.00</span>
            </div>
            
            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase font-bold tracking-widest text-zinc-500 mb-2">Total Wagers Placed</span>
              <span className="font-mono text-2xl text-wager-lime font-bold tracking-wider drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">0</span>
            </div>
            
            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase font-bold tracking-widest text-zinc-500 mb-2">House Treasury</span>
              <span className="font-mono text-2xl text-wager-lime font-bold tracking-wider drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">0.00 HBAR</span>
            </div>
          </div>

        </motion.div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-50 animate-bounce mt-10">
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">Scroll for Ecosystem Data</span>
          <div className="w-px h-8 bg-gradient-to-b from-zinc-500 to-transparent"></div>
        </div>
      </section>

      {/* Bento Box Section with Backlight */}
      <section className="relative w-full z-10 py-32 px-8 border-t border-white/5 bg-black/40">
        {/* Massive blurred radial gradient backlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] bg-[radial-gradient(circle,_#00ffff_0%,_transparent_50%)] opacity-10 blur-3xl pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div 
            variants={bentoContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            
            {/* Card 1: The Math */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-lime/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-lime/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <Lock size={48} className="text-wager-lime mb-6 drop-shadow-[0_0_15px_rgba(204,255,0,0.6)]" />
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Hedera PRNG System</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                True on-chain randomness via 0.0.169. Zero black boxes. Pure code.
              </p>
            </motion.div>

            {/* Card 2: The Liquidity */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-cyan/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <ArrowRightLeft size={48} className="text-wager-cyan mb-6 drop-shadow-[0_0_15px_rgba(0,255,255,0.6)]" />
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Universal Routing</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Powered by SaucerSwap. Swap HBAR, USDC, or USDT instantly to enter the arena.
              </p>
            </motion.div>

            {/* Card 3: The Soft-Loss Engine */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-amber-400/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <TrendingUp size={48} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">The Wager Guarantee</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Win or lose, every wager mines $WAGER Arcade Points. Climb the global leaderboard.
              </p>
            </motion.div>

            {/* Card 4: The House */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-red/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <Crosshair size={48} className="text-wager-red mb-6 drop-shadow-[0_0_15px_rgba(255,0,0,0.6)]" />
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">The Dynamic Edge</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Dictate your own risk-to-reward ratio. Survive the grid, multiply your stake up to 10x.
              </p>
            </motion.div>

          </motion.div>
        </div>
      </section>
      
    </div>
  );
}
