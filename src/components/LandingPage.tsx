"use client";

import { useEffect, useState } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { 
  Lock, ArrowRightLeft, TrendingUp, Crosshair, 
  ChevronDown, Gamepad2, HelpCircle, Globe, Mail, Link as LinkIcon 
} from "lucide-react";

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

const faqs = [
  {
    q: "What wallet do I need to play on WagerHub?",
    a: "You need a HashPack wallet connected to the Hedera network. It's fast, secure, and allows for seamless transactions directly from your browser."
  },
  {
    q: "Are the games provably fair?",
    a: "Absolutely. WagerHub utilizes Hedera's on-chain PRNG (Pseudo-Random Number Generator) via Smart Contracts, ensuring every outcome is transparent, verifiable, and immune to tampering."
  },
  {
    q: "What is the $WAGER token?",
    a: "$WAGER is the native utility token of our platform. You can swap your HBAR for $WAGER seamlessly in our Wager Swap terminal to access premium games and climb the leaderboard."
  },
  {
    q: "Are there any hidden fees?",
    a: "No. WagerHub prides itself on transparency. The only fees you pay are the microscopic network fees inherently required by the Hedera hashgraph to process your transactions."
  }
];

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [init, setInit] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRoute = (hash: string) => {
    window.location.hash = hash;
    onEnter();
  };

  return (
    <div className="w-full h-full relative overflow-y-auto overflow-x-hidden custom-scrollbar bg-black scroll-smooth">
      
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
            <h1 className="text-7xl md:text-9xl font-black tracking-[0.3em] text-white uppercase italic">
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
              onClick={() => scrollToSection("why-wagerhub")}
              className="relative z-10 px-16 py-8 font-black uppercase tracking-[0.3em] text-black bg-wager-cyan rounded-full text-2xl transition-all shadow-[0_0_60px_rgba(0,255,255,0.4)] hover:shadow-[0_0_100px_rgba(0,255,255,0.7)]"
            >
              Get Started
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
      </section>

      {/* Bento Box Section with Backlight */}
      <section id="why-wagerhub" className="relative w-full z-10 py-32 px-8 border-t border-white/5 bg-black/40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] bg-[radial-gradient(circle,_#00ffff_0%,_transparent_50%)] opacity-10 blur-3xl pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Why Choose WagerHub</h2>
            <div className="w-24 h-1 bg-wager-lime mx-auto rounded-full shadow-[0_0_15px_#ccff00]"></div>
          </div>

          <motion.div 
            variants={bentoContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Card 1: Low Fees */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-cyan/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                <ArrowRightLeft size={48} className="text-wager-cyan mb-6 drop-shadow-[0_0_20px_rgba(0,255,255,0.8)]" />
              </motion.div>
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Low Fees</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Powered by Hedera, WagerHub guarantees microscopic transaction fees, leaving more capital in your hands.
              </p>
            </motion.div>

            {/* Card 2: Transparent Mechanics */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-lime/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-lime/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <Lock size={48} className="text-wager-lime mb-6 drop-shadow-[0_0_20px_rgba(204,255,0,0.8)]" />
              </motion.div>
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Transparent Mechanics</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Every game utilizes smart contract-based PRNG logic. Complete transparency, zero black boxes.
              </p>
            </motion.div>

            {/* Card 3: Frictionless Swaps */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-amber-400/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <TrendingUp size={48} className="text-amber-400 mb-6 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
              </motion.div>
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Frictionless Swaps</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                Instantly convert assets with our native SaucerSwap routing. From HBAR to WAGER in one click.
              </p>
            </motion.div>

            {/* Card 4: Premium Gameplay */}
            <motion.div variants={bentoCardVariants} className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 hover:border-wager-red/40 transition-colors shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-wager-red/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                <Crosshair size={48} className="text-wager-red mb-6 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]" />
              </motion.div>
              <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-4">Premium Gameplay</h3>
              <p className="text-zinc-400 font-mono text-lg leading-relaxed relative z-10">
                High-frequency visual simulations, dynamic risk/reward payouts, and pure Web3 gaming.
              </p>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* Explore the Hub Section */}
      <section className="relative w-full z-10 py-32 px-8 border-t border-white/5 bg-slate-950">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Explore the Hub</h2>
            <div className="w-24 h-1 bg-wager-cyan mx-auto rounded-full shadow-[0_0_15px_#00ffff]"></div>
            <p className="text-zinc-400 font-mono mt-6">Select your destination and enter the arena.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Wager Swap Route */}
            <motion.div 
              whileHover={{ y: -10 }}
              onClick={() => handleRoute("")}
              className="cursor-pointer group relative bg-black/60 border border-white/10 rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-wager-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="p-8 h-full flex flex-col items-center justify-center text-center">
                <ArrowRightLeft size={56} className="text-wager-cyan mb-6 transition-transform group-hover:scale-110 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]" />
                <h3 className="text-2xl font-black uppercase text-white mb-2">Wager Swap</h3>
                <p className="text-sm font-mono text-zinc-500">Decentralized Token Exchange</p>
              </div>
            </motion.div>

            {/* Wager Arcade Route */}
            <motion.div 
              whileHover={{ y: -10 }}
              onClick={() => handleRoute("#arcade")} // Assuming #arcade triggers something, actually we just need to set active view. 
              // Wait, page.tsx doesn't have an "#arcade" hash listener to set activeView("arcade").
              // I will update page.tsx to support hash routing for main tabs too if we want, or just call handleRoute("arcade") and pass target to onEnter!
              // For now, let's pass the string to onEnter.
              className="cursor-pointer group relative bg-black/60 border border-white/10 rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-wager-lime/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="p-8 h-full flex flex-col items-center justify-center text-center">
                <Gamepad2 size={56} className="text-wager-lime mb-6 transition-transform group-hover:scale-110 drop-shadow-[0_0_15px_rgba(204,255,0,0.5)]" />
                <h3 className="text-2xl font-black uppercase text-white mb-2">Wager Arcade</h3>
                <p className="text-sm font-mono text-zinc-500">High-Stakes Games</p>
              </div>
            </motion.div>

            {/* Leaderboard Route */}
            <motion.div 
              whileHover={{ y: -10 }}
              onClick={() => handleRoute("#leaderboard")}
              className="cursor-pointer group relative bg-black/60 border border-white/10 rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-amber-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="p-8 h-full flex flex-col items-center justify-center text-center">
                <TrendingUp size={56} className="text-amber-400 mb-6 transition-transform group-hover:scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                <h3 className="text-2xl font-black uppercase text-white mb-2">Leaderboard</h3>
                <p className="text-sm font-mono text-zinc-500">Global Rankings & Points</p>
              </div>
            </motion.div>

            {/* About Route */}
            <motion.div 
              whileHover={{ y: -10 }}
              onClick={() => handleRoute("#about")}
              className="cursor-pointer group relative bg-black/60 border border-white/10 rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="p-8 h-full flex flex-col items-center justify-center text-center">
                <HelpCircle size={56} className="text-white mb-6 transition-transform group-hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                <h3 className="text-2xl font-black uppercase text-white mb-2">About Hub</h3>
                <p className="text-sm font-mono text-zinc-500">Knowledge Base & FAQ</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative w-full z-10 py-32 px-8 border-t border-white/5 bg-black/60">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Frequently Asked Questions</h2>
            <div className="w-24 h-1 bg-wager-red mx-auto rounded-full shadow-[0_0_15px_#ff0000]"></div>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-wager-charcoal/80 border border-white/10 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex justify-between items-center p-6 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-bold text-lg text-white tracking-wide">{faq.q}</span>
                  <motion.div animate={{ rotate: openFaq === index ? 180 : 0 }}>
                    <ChevronDown size={24} className="text-wager-cyan" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 pt-0 text-zinc-400 font-mono leading-relaxed border-t border-white/5 mt-2">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="relative w-full z-10 bg-slate-950 border-t border-white/10 pt-20 pb-10 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-4xl font-black tracking-[0.2em] text-white uppercase italic mb-4">
              Wager<span className="text-wager-lime">Hub</span>
            </h1>
            <p className="text-zinc-500 font-mono text-sm max-w-xs">
              The premier Web3 arcade and decentralized exchange protocol on the Hedera network.
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="text-white font-black uppercase tracking-widest mb-6">Quick Links</h4>
            <div className="space-y-4 font-mono text-sm">
              <button onClick={() => scrollToSection("why-wagerhub")} className="block text-zinc-500 hover:text-wager-cyan transition-colors">Why WagerHub</button>
              <button onClick={() => handleRoute("#arcade")} className="block text-zinc-500 hover:text-wager-lime transition-colors">Arcade Floor</button>
              <button onClick={() => handleRoute("#leaderboard")} className="block text-zinc-500 hover:text-amber-400 transition-colors">Leaderboard</button>
              <button onClick={() => handleRoute("#about")} className="block text-zinc-500 hover:text-white transition-colors">Knowledge Base</button>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="text-white font-black uppercase tracking-widest mb-6">Community</h4>
            <div className="flex gap-4">
              <a href="#" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/20 hover:border-white hover:text-white transition-all text-zinc-400">
                <Globe size={24} />
              </a>
              <a href="#" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#0088cc]/20 hover:border-[#0088cc] hover:text-[#0088cc] transition-all text-zinc-400">
                <Mail size={24} />
              </a>
              <a href="#" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#5865F2]/20 hover:border-[#5865F2] hover:text-[#5865F2] transition-all text-zinc-400">
                <LinkIcon size={24} />
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-600">
          <p>© {new Date().getFullYear()} WagerHub Protocol. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
