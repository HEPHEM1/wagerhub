"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArcadeFloor from "@/components/ArcadeFloor";
import Leaderboard from "@/components/Leaderboard";
import Wagerswap from "@/components/Wagerswap";
import Header from "@/components/Header";
import LandingPage from "@/components/LandingPage";
import { Gamepad2, ArrowRightLeft } from "lucide-react";

type ViewState = "arcade" | "swap";

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false);
  const [activeView, setActiveView] = useState<ViewState>("swap");

  if (!hasEntered) {
    return <LandingPage onEnter={() => setHasEntered(true)} />;
  }

  return (
    <>
      <Header />
      <div className="flex flex-col flex-1 w-full h-full relative">
        
        {/* Massive Tab Navigation */}
        <div className="w-full bg-wager-black border-b border-wager-charcoal flex p-2 gap-2 flex-shrink-0 z-40 relative shadow-2xl">
          <button
            onClick={() => setActiveView("swap")}
            className={`flex-1 py-4 flex justify-center items-center gap-3 rounded-xl transition-all relative overflow-hidden ${
              activeView === "swap" ? "text-wager-cyan" : "text-zinc-500 hover:bg-wager-charcoal/30 hover:text-white"
            }`}
          >
            {activeView === "swap" && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-wager-cyan/10 border border-wager-cyan/30 rounded-xl" />
            )}
            <ArrowRightLeft size={24} className="relative z-10" />
            <span className="font-black tracking-widest text-lg relative z-10">WAGER SWAP</span>
          </button>

          <button
            onClick={() => setActiveView("arcade")}
            className={`flex-1 py-4 flex justify-center items-center gap-3 rounded-xl transition-all relative overflow-hidden ${
              activeView === "arcade" ? "text-wager-lime" : "text-zinc-500 hover:bg-wager-charcoal/30 hover:text-white"
            }`}
          >
            {activeView === "arcade" && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-wager-lime/10 border border-wager-lime/30 rounded-xl" />
            )}
            <Gamepad2 size={24} className="relative z-10" />
            <span className="font-black tracking-widest text-lg relative z-10">WAGER ARCADE</span>
          </button>
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

                {/* Right Sidebar (Leaderboard) */}
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
                className="flex-1 w-full h-full flex items-center justify-center p-8 absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-wager-cyan/5 via-wager-black to-wager-black"
              >
                <div className="w-full max-w-4xl relative">
                  <Wagerswap />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </>
  );
}

