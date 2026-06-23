"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Skull, Zap, Loader2, Footprints, Info, Sparkles, HelpCircle } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import confetti from "canvas-confetti";
import { EVM_WAGER_TOKEN_ADDRESS, EVM_TREASURY_ADDRESS } from "../evm";

type Choice = "cursed" | "blessed" | null;

export default function BlindLootMaster({ onClose }: { onClose: () => void }) {
  const [selectedPath, setSelectedPath] = useState<Choice>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultType, setResultType] = useState<"win" | "loss" | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>("0");

  const { isConnected, accountId, balances, executeEVMTransfer, refreshBalances, connect, addWagerPoints } = useWagerWallet();

  const takeFate = async () => {
    if (!selectedPath || isConfirming) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    setIsConfirming(true);
    
    try {
      const amountInTokens = BigInt(Math.floor(100 * 1e8)); // Fixed 100 WAGER
      const res = await executeEVMTransfer(
        EVM_WAGER_TOKEN_ADDRESS,
        EVM_TREASURY_ADDRESS,
        amountInTokens.toString()
      );
      if (!res || res.status !== "SUCCESS") throw new Error("Transaction rejected");

      // 5-second polling/reveal delay
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 50/50 Outcome for the demo
      const isWin = Math.random() > 0.5;
      
      if (isWin) {
        const winMult = selectedPath === "blessed" ? 1.8 : 2.5; // Cursed is riskier?
        const winAmt = (100 * winMult).toFixed(2);
        setPayoutAmount(winAmt);

        const payoutRes = await fetch("/api/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            accountId, 
            winAmount: winAmt,
            wagerAmount: "100",
            direction: 'GAME_WIN'
          })
        });

        if (!payoutRes.ok) throw new Error("Payout failed");
        
        setResultType("win");
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: selectedPath === "blessed" ? ['#00ffff', '#ffffff', '#ffd700'] : ['#a855f7', '#3b82f6', '#000000']
        });
      } else {
        setResultType("loss");
      }

      // Fixed wager is 100 $WAGER, which is >= 10. Award 800 WagerPoints per round.
      addWagerPoints(800);
      console.log("🎮 Valid Qualifying Wager (100 $WAGER): Awarded 800 WagerPoints.");

      setShowResult(true);
      refreshBalances();
    } catch (err: any) {
      console.error("[BlindLootMaster] Error:", err);
      alert(err.message || "Fate rejected. Try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-colors duration-1000 ${
      showResult 
        ? selectedPath === "blessed" ? "bg-cyan-950/90" : "bg-purple-950/90"
        : "bg-black"
    }`}>
      {/* Background Choice Scene */}
      <div className="absolute inset-0 flex pointer-events-none">
        {/* Left: Cursed Path */}
        <div className={`flex-1 relative transition-all duration-1000 ${selectedPath === "blessed" ? "opacity-20 grayscale" : "opacity-60"}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_#581c87_0%,_transparent_70%)]" />
          {/* Thorny silhouettes could be SVG patterns or gradients */}
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />
        </div>
        {/* Right: Blessed Path */}
        <div className={`flex-1 relative transition-all duration-1000 ${selectedPath === "cursed" ? "opacity-20 grayscale" : "opacity-60"}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_#0891b2_0%,_transparent_70%)]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/gold-dust.png')" }} />
        </div>
      </div>

      {/* Runic Glove (Foreground) */}
      <motion.div 
        animate={{ 
          y: [0, -10, 0],
          rotate: selectedPath === "cursed" ? -5 : selectedPath === "blessed" ? 5 : 0 
        }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[800px] z-50 pointer-events-none opacity-90"
      >
        <div className="relative w-full h-full flex flex-col items-center">
           {/* Stylized Glove Body */}
           <div className="w-64 h-[500px] bg-zinc-900 rounded-t-full border-x-8 border-t-8 border-zinc-800 shadow-[0_-50px_100px_rgba(0,0,0,0.8)] relative">
              {/* Glowing Runes */}
              <div className="absolute inset-0 p-12 flex flex-col gap-8 items-center">
                 {[1,2,3,4].map(i => (
                   <motion.div 
                     key={i}
                     animate={{ opacity: [0.3, 1, 0.3], textShadow: ["0 0 5px #00ffff", "0 0 20px #00ffff", "0 0 5px #00ffff"] }}
                     transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
                     className="text-wager-cyan text-4xl font-black italic tracking-[0.5em]"
                   >
                     ᚦᚱᛟ
                   </motion.div>
                 ))}
              </div>
           </div>
           {/* Runic Brace */}
           <div className="w-80 h-32 bg-zinc-800 rounded-2xl border-4 border-wager-cyan/30 mt-[-20px] shadow-2xl flex items-center justify-center">
              <div className="w-full h-1 bg-wager-cyan/50 blur-sm" />
           </div>
        </div>
      </motion.div>

      {/* Choice Panels */}
      <div className="relative z-[60] w-full max-w-7xl px-8 flex justify-between items-center h-full">
        {/* Cursed Loot Module */}
        <motion.div 
          whileHover={{ scale: 1.05, rotate: -1 }}
          onClick={() => setSelectedPath("cursed")}
          className={`w-[450px] p-10 rounded-[3rem] border-4 transition-all cursor-pointer backdrop-blur-3xl
            ${selectedPath === "cursed" 
              ? "bg-purple-950/40 border-purple-500 shadow-[0_0_80px_rgba(168,85,247,0.4)]" 
              : "bg-black/40 border-white/5 opacity-60 hover:opacity-100"}
          `}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="p-5 bg-purple-500/20 rounded-full border-2 border-purple-500/50 shadow-inner">
              <Skull size={48} className="text-purple-400" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-white uppercase tracking-widest italic">Cursed Loot</h3>
              <p className="text-purple-400 text-xs font-bold mt-2 tracking-tighter">High Risk · Cursed Multiplier</p>
            </div>
            <div className="w-full bg-black/60 rounded-2xl p-6 border border-purple-500/20">
               <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">C-WAGER Balance</span>
               <div className="text-3xl font-mono text-purple-400 font-bold tracking-widest">500 <span className="text-sm">C</span></div>
            </div>
            <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all
              ${selectedPath === "cursed" ? "bg-purple-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.5)]" : "bg-white/5 text-zinc-500"}
            `}>
              OPEN CURSED CHEST (100)
            </button>
          </div>
        </motion.div>

        {/* Blessed Loot Module */}
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 1 }}
          onClick={() => setSelectedPath("blessed")}
          className={`w-[450px] p-10 rounded-[3rem] border-4 transition-all cursor-pointer backdrop-blur-3xl
            ${selectedPath === "blessed" 
              ? "bg-cyan-950/40 border-wager-cyan shadow-[0_0_80px_rgba(0,255,255,0.4)]" 
              : "bg-black/40 border-white/5 opacity-60 hover:opacity-100"}
          `}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="p-5 bg-wager-cyan/20 rounded-full border-2 border-wager-cyan/50 shadow-inner">
              <Shield size={48} className="text-wager-cyan" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-white uppercase tracking-widest italic">Blessed Loot</h3>
              <p className="text-wager-cyan text-xs font-bold mt-2 tracking-tighter">Safe Choice · Golden Rewards</p>
            </div>
            <div className="w-full bg-black/60 rounded-2xl p-6 border border-wager-cyan/20">
               <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">B-WAGER Balance</span>
               <div className="text-3xl font-mono text-wager-cyan font-bold tracking-widest">500 <span className="text-sm">G</span></div>
            </div>
            <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all
              ${selectedPath === "blessed" ? "bg-wager-cyan text-black shadow-[0_0_30px_rgba(0,255,255,0.5)]" : "bg-white/5 text-zinc-500"}
            `}>
              OPEN BLESSED CHEST (100)
            </button>
          </div>
        </motion.div>
      </div>

      {/* Confirm Button */}
      <div className="absolute bottom-32 z-[70] w-full flex flex-col items-center">
        <AnimatePresence>
          {selectedPath && !showResult && (
            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={takeFate}
              disabled={isConfirming}
              className="relative px-20 py-8 bg-white text-black font-black text-2xl uppercase tracking-[0.4em] italic rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
            >
              {isConfirming ? <><Loader2 className="animate-spin" size={32} /> RETRYING...</> : "TAKE YOUR FATE"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Result Overlay */}
      <AnimatePresence>
        {showResult && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
             {resultType === "win" ? (
               <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-6">
                  <Sparkles size={120} className={selectedPath === "blessed" ? "text-wager-cyan" : "text-purple-500"} />
                  <h1 className="text-9xl font-black text-white uppercase italic tracking-widest drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">JACKPOT!!!</h1>
                  <div className="bg-wager-lime text-black px-12 py-4 rounded-full font-black text-4xl shadow-2xl">
                    + {payoutAmount} $WAGER
                  </div>
                  <button onClick={() => setShowResult(false)} className="mt-12 text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-all underline underline-offset-8">Return to the Void</button>
               </motion.div>
             ) : (
               <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-6">
                  <Skull size={120} className="text-wager-red" />
                  <h1 className="text-9xl font-black text-wager-red uppercase italic tracking-widest drop-shadow-[0_0_30px_rgba(255,0,0,0.5)]">CURSED!</h1>
                  <p className="text-zinc-500 text-2xl font-mono">Your soul is lost to the grid.</p>
                  <button onClick={() => setShowResult(false)} className="mt-12 text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-all underline underline-offset-8">Retry Fate</button>
               </motion.div>
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cobblestone Terminal (Live Loot Feed) */}
      <div className="absolute bottom-0 w-full h-24 bg-zinc-900 border-t border-white/10 z-50 p-6 flex items-center overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/pavement.png')" }} />
        <div className="relative w-full flex gap-12 items-center animate-marquee whitespace-nowrap">
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.123...</span> claimed a <span className="text-purple-500 font-bold italic">CURSED</span> chest and got 500 'C'
              </span>
           </div>
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.456...</span> claimed a <span className="text-wager-lime font-bold italic">BLESSED</span> chest and got a Golden Wager Token
              </span>
           </div>
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.789...</span> sacrificed 100 WAGER to the thorn-king.
              </span>
           </div>
        </div>
      </div>

      {/* Header Buttons */}
      <div className="absolute top-12 left-12 z-[90] flex items-center gap-4">
        <button 
          onClick={onClose}
          className="p-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group"
        >
          <Footprints className="text-zinc-500 group-hover:text-wager-cyan" size={24} />
        </button>
        <button
          onClick={() => { onClose(); window.location.hash = "blind-loot"; }}
          className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-zinc-500 hover:text-white text-sm font-bold uppercase tracking-wider"
        >
          <HelpCircle size={20} />
          How to Play
        </button>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
