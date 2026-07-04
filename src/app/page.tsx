"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArcadeFloor from "@/components/ArcadeFloor";
import Leaderboard from "@/components/Leaderboard";
import Wagerswap from "@/components/Wagerswap";
import Header from "@/components/Header";
import About from "@/components/About";
import LandingPage from "@/components/LandingPage";
import { Gamepad2, ArrowRightLeft, TrendingUp, HelpCircle } from "lucide-react";

type ViewState = "arcade" | "swap" | "leaderboard" | "about";

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false);
  const [activeView, setActiveView] = useState<ViewState>("swap");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const gameIds = ["#wager-swap", "#trend-rider", "#mystery-field", "#gravity-drop", "#penalty-shootout", "#blind-loot", "#rps-zero-trust"];
      
      if (gameIds.includes(hash)) {
        setActiveView("about");
      } else if (hash === "#arcade") {
        setActiveView("arcade");
      } else if (hash === "#leaderboard") {
        setActiveView("leaderboard");
      } else if (hash === "#about") {
        setActiveView("about");
      } else if (hash === "#swap" || hash === "") {
        // Default or explicitly swap
        // Only set to swap if we already entered, or if the hash is explicitly swap
        if (hash === "#swap") setActiveView("swap");
      }
    };

    // Check on mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (!hasEntered) {
    return <LandingPage onEnter={() => setHasEntered(true)} />;
  }

  return (
    <div className="flex flex-col flex-1 w-full h-[100dvh] relative overflow-hidden bg-slate-950">
      <div className="fixed top-0 left-0 right-0 w-full flex-shrink-0 z-[200]">
        <Header />
      </div>
      <div className="flex flex-col flex-1 w-full relative overflow-hidden pt-[76px]">
        
        {/* Arcade Mode Overlays */}
        {activeView === "arcade" && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 neon-grid opacity-40 rotate-[15deg] scale-150" />
            <div className="absolute top-0 left-0 w-64 h-64 bg-[radial-gradient(circle_at_top_left,_#ccff00_0%,_transparent_70%)] opacity-20 blur-3xl" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_top_right,_#00ffff_0%,_transparent_70%)] opacity-20 blur-3xl" />
          </div>
        )}

        {/* 3-Pillar Premium Navigation */}
        <div className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5 flex md:hidden px-4 pt-4 gap-8 flex-shrink-0 z-40 relative">
          {[
            { id: "swap", label: "WAGER SWAP (V2)", icon: <ArrowRightLeft size={18} />, color: "text-wager-cyan" },
            { id: "arcade", label: "WAGER ARCADE", icon: <Gamepad2 size={18} />, color: "text-wager-lime" },
            { id: "leaderboard", label: "LEADERBOARD", icon: <TrendingUp size={18} />, color: "text-amber-400" },
            { id: "about", label: "ABOUT", icon: <HelpCircle size={18} />, color: "text-white" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as ViewState)}
              className={`pb-4 px-2 flex items-center gap-2.5 transition-all relative group ${
                activeView === tab.id ? tab.color : "text-zinc-500 hover:text-white"
              }`}
            >
              <div className="group-hover:scale-110 transition-transform">{tab.icon}</div>
              <span className="font-black tracking-[0.15em] text-sm uppercase">{tab.label}</span>
              
              {/* Animated Underline */}
              {activeView === tab.id ? (
                <motion.div 
                  layoutId="navUnderline" 
                  className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-full shadow-[0_-5px_15px_currentColor] ${tab.color.replace('text-', 'bg-')}`} 
                />
              ) : (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-white/20 group-hover:w-full transition-all rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 w-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeView === "arcade" && (
              <motion.div
                key="arcade"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-1 w-full h-full absolute inset-0"
              >
                {/* Center Stage (Games) */}
                <main className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar">
                  <ArcadeFloor />
                </main>
              </motion.div>
            )}

            {activeView === "leaderboard" && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-1 w-full h-full absolute inset-0 overflow-y-auto"
              >
                <Leaderboard />
              </motion.div>
            )}

            {activeView === "swap" && (
              <motion.div
                key="swap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 w-full h-full absolute inset-0 overflow-y-auto custom-scrollbar bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-wager-cyan/5 via-slate-950 to-slate-950"
              >
                <div className="min-h-full flex flex-col items-center justify-start p-4 md:p-8">
                  <div className="w-full max-w-4xl relative my-auto py-8 md:py-12">
                    <Wagerswap />
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === "about" && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-1 w-full h-full absolute inset-0 overflow-y-auto custom-scrollbar"
              >
                <About />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

