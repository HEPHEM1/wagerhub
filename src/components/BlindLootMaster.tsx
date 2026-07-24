"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Ghost, Zap, Loader2, Footprints, Sparkles, HelpCircle, Coins, Flame } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import confetti from "canvas-confetti";
import { EVM_WAGER_TOKEN_ADDRESS, EVM_TREASURY_ADDRESS } from "../evm";

type Choice = "shadow" | "blessed" | null;

// Shadow pays more but wins less often than Blessed, so the higher payout
// is a genuine risk/reward tradeoff rather than a strictly better choice.
const PATH_INFO: Record<"shadow" | "blessed", { winChance: number; multiplier: number }> = {
  shadow:  { winChance: 0.35, multiplier: 2.5 },
  blessed: { winChance: 0.50, multiplier: 1.8 },
};

const MAX_STREAK_STEPS = 5;
const STREAK_BONUS_PER_WIN = 0.02; // +2% payout per consecutive win, capped at +10%
const MIN_QUALIFYING_WAGER = 10;

export default function BlindLootMaster({ onClose }: { onClose: () => void }) {
  const [selectedPath, setSelectedPath] = useState<Choice>(null);
  const [wager, setWager] = useState<string>("50");
  const [isConfirming, setIsConfirming] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [resultType, setResultType] = useState<"win" | "loss" | null>(null);
  const [resultPath, setResultPath] = useState<Choice>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>("0");
  const [txError, setTxError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<("win" | "loss")[]>([]);

  const { isConnected, accountId, balances, executeEVMTransfer, refreshBalances, connect, addWagerPoints } = useWagerWallet();

  const streakBonus = Math.min(streak, MAX_STREAK_STEPS) * STREAK_BONUS_PER_WIN;

  const getEffectiveMultiplier = (path: Choice) => {
    if (!path) return 0;
    return PATH_INFO[path].multiplier * (1 + streakBonus);
  };

  const stakeNum = parseFloat(wager) || 0;
  const potentialWin = selectedPath && stakeNum > 0
    ? (stakeNum * getEffectiveMultiplier(selectedPath)).toFixed(2)
    : "0.00";

  const handleQuickSelect = (percent: string) => {
    if (!balances.wager || balances.wager === "0.00") return;
    const total = parseFloat(balances.wager);
    if (isNaN(total) || total <= 0) return;
    if (percent === "MAX") {
      setWager(total.toString());
    } else {
      const p = parseInt(percent) / 100;
      setWager((total * p).toFixed(2));
    }
  };

  const takeFate = async () => {
    if (!selectedPath || isConfirming) return;
    if (!wager || !(stakeNum > 0)) return;
    if (stakeNum > parseFloat(balances.wager || "0")) {
      setTxError("Insufficient $WAGER balance.");
      return;
    }
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    const path = selectedPath;
    const stake = stakeNum;

    setIsConfirming(true);
    setTxError(null);

    try {
      const amountInTokens = BigInt(Math.floor(stake * 1e8));
      const res = await executeEVMTransfer(
        EVM_WAGER_TOKEN_ADDRESS,
        EVM_TREASURY_ADDRESS,
        amountInTokens.toString()
      );
      if (!res || res.status !== "SUCCESS") throw new Error("Transaction rejected");

      // Suspenseful 5-second reveal countdown
      for (let s = 5; s >= 1; s--) {
        setRevealCountdown(s);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setRevealCountdown(null);

      const { winChance, multiplier } = PATH_INFO[path];
      const isWin = Math.random() < winChance;

      if (isWin) {
        const effectiveMult = multiplier * (1 + Math.min(streak, MAX_STREAK_STEPS) * STREAK_BONUS_PER_WIN);
        const winAmt = (stake * effectiveMult).toFixed(2);
        setPayoutAmount(winAmt);

        const payoutRes = await fetch("/api/payout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payout-Secret": process.env.NEXT_PUBLIC_PAYOUT_SECRET || ""
          },
          body: JSON.stringify({
            accountId,
            winAmount: winAmt,
            wagerAmount: wager,
            direction: 'GAME_WIN'
          })
        });

        if (!payoutRes.ok) {
          throw new Error("Your wager went through and you won, but the payout failed. Please contact support with your wallet address so we can pay you manually.");
        }

        setResultType("win");
        setStreak(prev => prev + 1);
        setHistory(prev => [...prev, "win"].slice(-8));
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: path === "blessed" ? ['#00ffff', '#ffffff', '#ffd700'] : ['#a855f7', '#3b82f6', '#000000']
        });
      } else {
        setResultType("loss");
        setStreak(0);
        setHistory(prev => [...prev, "loss"].slice(-8));
      }

      setResultPath(path);

      if (stake >= MIN_QUALIFYING_WAGER) {
        addWagerPoints(800);
        console.log("🎮 Valid Qualifying Wager: Awarded 800 WagerPoints.");
      } else {
        console.log("🎮 Micro-Bet Detected (< 10 $WAGER): Awarded 0 WagerPoints.");
      }

      setShowResult(true);
      refreshBalances();
    } catch (err: any) {
      console.error("[BlindLootMaster] Error:", err);
      setTxError(err.message || "The chest wouldn't open. Try again.");
      setRevealCountdown(null);
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
        {/* Left: Shadow Path */}
        <div className={`flex-1 relative transition-all duration-1000 ${selectedPath === "blessed" ? "opacity-20 grayscale" : "opacity-60"}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_#581c87_0%,_transparent_70%)]" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />
        </div>
        {/* Right: Blessed Path */}
        <div className={`flex-1 relative transition-all duration-1000 ${selectedPath === "shadow" ? "opacity-20 grayscale" : "opacity-60"}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_#0891b2_0%,_transparent_70%)]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/gold-dust.png')" }} />
        </div>
      </div>

      {/* Runic Glove (Foreground) */}
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotate: selectedPath === "shadow" ? -5 : selectedPath === "blessed" ? 5 : 0
        }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[800px] z-50 pointer-events-none opacity-90"
      >
        <div className="relative w-full h-full flex flex-col items-center">
           <div className="w-64 h-[500px] bg-zinc-900 rounded-t-full border-x-8 border-t-8 border-zinc-800 shadow-[0_-50px_100px_rgba(0,0,0,0.8)] relative">
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
           <div className="w-80 h-32 bg-zinc-800 rounded-2xl border-4 border-wager-cyan/30 mt-[-20px] shadow-2xl flex items-center justify-center">
              <div className="w-full h-1 bg-wager-cyan/50 blur-sm" />
           </div>
        </div>
      </motion.div>

      {/* Staking Console */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[90] w-full max-w-md px-4">
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Your Stake</span>
            <span className="text-[10px] font-mono text-zinc-500">Bal: <span className="text-wager-lime">{balances.wager}</span> $WAGER</span>
          </div>
          <div className="flex items-center bg-black/60 border border-white/10 rounded-xl px-4 py-3">
            <Coins className="text-wager-lime mr-3 shrink-0" size={20} />
            <input
              type="number"
              value={wager}
              onChange={(e) => setWager(e.target.value)}
              disabled={isConfirming}
              placeholder="0.00"
              className="bg-transparent w-full text-white font-mono text-xl font-bold outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-1.5">
              {["25", "50", "75", "MAX"].map((p) => (
                <button
                  key={p}
                  onClick={() => handleQuickSelect(p)}
                  disabled={isConfirming}
                  className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                >
                  {p === "MAX" ? "MAX" : `${p}%`}
                </button>
              ))}
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <Flame size={12} className="text-orange-400" />
                <span className="text-[10px] font-black text-orange-400">Streak x{streak} (+{Math.round(streakBonus * 100)}%)</span>
              </div>
            )}
          </div>
          {stakeNum > 0 && stakeNum < MIN_QUALIFYING_WAGER && (
            <div className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mt-2">
              Bet under {MIN_QUALIFYING_WAGER} $WAGER earns 0 WagerPoints.
            </div>
          )}
          {selectedPath && (
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Potential Win</span>
              <span className="text-lg font-black text-wager-lime font-mono">{potentialWin} $WAGER</span>
            </div>
          )}
        </div>
      </div>

      {/* Choice Panels */}
      <div className="relative z-[60] w-full max-w-7xl px-8 flex justify-between items-center h-full">
        {/* Shadow Loot Module */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: -1 }}
          onClick={() => !isConfirming && setSelectedPath("shadow")}
          className={`w-[450px] p-10 rounded-[3rem] border-4 transition-all cursor-pointer backdrop-blur-3xl
            ${selectedPath === "shadow"
              ? "bg-purple-950/40 border-purple-500 shadow-[0_0_80px_rgba(168,85,247,0.4)]"
              : "bg-black/40 border-white/5 opacity-60 hover:opacity-100"}
          `}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="p-5 bg-purple-500/20 rounded-full border-2 border-purple-500/50 shadow-inner">
              <Ghost size={48} className="text-purple-400" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-white uppercase tracking-widest italic">Shadow Loot</h3>
              <p className="text-purple-400 text-xs font-bold mt-2 tracking-tighter">High Risk · Big Multiplier</p>
            </div>
            <div className="w-full bg-black/60 rounded-2xl p-5 border border-purple-500/20 flex justify-between items-center">
              <div className="text-center flex-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Win Chance</span>
                <div className="text-2xl font-mono text-purple-400 font-bold">{Math.round(PATH_INFO.shadow.winChance * 100)}%</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center flex-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Payout</span>
                <div className="text-2xl font-mono text-purple-400 font-bold">{PATH_INFO.shadow.multiplier}x</div>
              </div>
            </div>
            <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all
              ${selectedPath === "shadow" ? "bg-purple-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.5)]" : "bg-white/5 text-zinc-500"}
            `}>
              OPEN SHADOW CHEST ({stakeNum > 0 ? stakeNum.toFixed(0) : "0"})
            </button>
          </div>
        </motion.div>

        {/* Blessed Loot Module */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: 1 }}
          onClick={() => !isConfirming && setSelectedPath("blessed")}
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
            <div className="w-full bg-black/60 rounded-2xl p-5 border border-wager-cyan/20 flex justify-between items-center">
              <div className="text-center flex-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Win Chance</span>
                <div className="text-2xl font-mono text-wager-cyan font-bold">{Math.round(PATH_INFO.blessed.winChance * 100)}%</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center flex-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Payout</span>
                <div className="text-2xl font-mono text-wager-cyan font-bold">{PATH_INFO.blessed.multiplier}x</div>
              </div>
            </div>
            <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all
              ${selectedPath === "blessed" ? "bg-wager-cyan text-black shadow-[0_0_30px_rgba(0,255,255,0.5)]" : "bg-white/5 text-zinc-500"}
            `}>
              OPEN BLESSED CHEST ({stakeNum > 0 ? stakeNum.toFixed(0) : "0"})
            </button>
          </div>
        </motion.div>
      </div>

      {/* Confirm Button + Recent Rounds */}
      <div className="absolute bottom-24 z-[70] w-full flex flex-col items-center gap-4">
        <AnimatePresence>
          {selectedPath && !showResult && (
            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={takeFate}
              disabled={isConfirming || stakeNum <= 0}
              className="relative px-20 py-8 bg-white text-black font-black text-2xl uppercase tracking-[0.4em] italic rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
            >
              {revealCountdown !== null ? (
                `REVEALING IN ${revealCountdown}...`
              ) : isConfirming ? (
                <><Loader2 className="animate-spin" size={32} /> AWAITING WALLET...</>
              ) : (
                "OPEN THE VAULT"
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {history.length > 0 && (
          <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-full px-4 py-2">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mr-1">Recent</span>
            {history.map((h, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${h === "win" ? "bg-wager-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]" : "bg-zinc-700"}`}
              />
            ))}
          </div>
        )}

        {txError && (
          <div className="max-w-lg p-4 bg-red-950/80 border border-red-500/40 rounded-xl">
            <p className="text-xs text-red-400 font-mono text-center leading-snug">{txError}</p>
          </div>
        )}
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
                  <Sparkles size={120} className={resultPath === "blessed" ? "text-wager-cyan" : "text-purple-500"} />
                  <h1 className="text-9xl font-black text-white uppercase italic tracking-widest drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">JACKPOT!!!</h1>
                  <div className="bg-wager-lime text-black px-12 py-4 rounded-full font-black text-4xl shadow-2xl">
                    + {payoutAmount} $WAGER
                  </div>
                  {streak > 1 && (
                    <div className="flex items-center gap-2 text-orange-400 font-bold uppercase tracking-widest text-sm">
                      <Flame size={18} /> {streak}-Win Streak!
                    </div>
                  )}
                  <button onClick={() => setShowResult(false)} className="mt-8 text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-all underline underline-offset-8">Play Again</button>
               </motion.div>
             ) : (
               <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-6">
                  {resultPath === "blessed" ? (
                    <>
                      <Shield size={120} className="text-wager-cyan/40" />
                      <h1 className="text-8xl font-black text-wager-cyan/70 uppercase italic tracking-widest">UNLUCKY!</h1>
                      <p className="text-zinc-500 text-2xl font-mono">The blessing didn't land this time.</p>
                    </>
                  ) : (
                    <>
                      <Ghost size={120} className="text-purple-500" />
                      <h1 className="text-8xl font-black text-purple-500 uppercase italic tracking-widest drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">SHADOWED!</h1>
                      <p className="text-zinc-500 text-2xl font-mono">The vault stayed sealed. Try again.</p>
                    </>
                  )}
                  <button onClick={() => setShowResult(false)} className="mt-8 text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-all underline underline-offset-8">Play Again</button>
               </motion.div>
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cobblestone Terminal (Ambient Flavor Feed) */}
      <div className="absolute bottom-0 w-full h-24 bg-zinc-900 border-t border-white/10 z-50 p-6 flex items-center overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/pavement.png')" }} />
        <div className="relative w-full flex gap-12 items-center animate-marquee whitespace-nowrap">
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.123...</span> opened a <span className="text-purple-500 font-bold italic">SHADOW</span> chest and doubled up
              </span>
           </div>
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.456...</span> claimed a <span className="text-wager-lime font-bold italic">BLESSED</span> chest and secured the bag
              </span>
           </div>
           <div className="flex gap-4 items-center">
              <Zap size={14} className="text-wager-cyan" />
              <span className="font-mono text-sm text-zinc-400">
                <span className="text-wager-cyan font-bold">0.0.789...</span> risked it on the Shadow path and came up short
              </span>
           </div>
        </div>
      </div>

      {/* Header Buttons */}
      <div className="absolute top-12 left-12 z-[95] flex items-center gap-4">
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
