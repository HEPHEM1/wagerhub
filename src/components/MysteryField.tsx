"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Coins, Loader2, Bomb, Shield, Info } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import confetti from "canvas-confetti";

const TREASURY_ACCOUNT_ID = AccountId.fromString((process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim());
const WAGER_TOKEN_ID = TokenId.fromString((process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim());

type GameState = "setup" | "sweeping" | "win" | "loss";

export default function MysteryField({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [wager, setWager] = useState<string>("50");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([]);
  const [hazardBlocks, setHazardBlocks] = useState<number[]>([]);
  const [lastWinAmount, setLastWinAmount] = useState<string | null>(null);

  const { isConnected, accountId, balances, executeTransaction, refreshBalances, connect } = useWagerWallet();

  const handleQuickSelect = (percent: string) => {
    if (!balances.wager || balances.wager === "0.00") return;
    const total = parseFloat(balances.wager);
    if (percent === "MAX") {
      setWager(total.toString());
    } else {
      const p = parseInt(percent) / 100;
      setWager((total * p).toFixed(2));
    }
  };

  const toggleBlock = (id: number) => {
    if (gameState !== "setup") return;
    if (selectedBlocks.includes(id)) {
      setSelectedBlocks(selectedBlocks.filter(b => b !== id));
    } else {
      if (selectedBlocks.length >= 10) return; // Capped at 10 as requested
      setSelectedBlocks([...selectedBlocks, id]);
    }
  };

  const getMultiplier = (numPicks: number) => {
    switch (numPicks) {
      case 1: return 5.0;
      case 2: return 35.0;
      case 3: return 300.0;
      case 4: return 4000.0;
      case 5: return 100000.0;
      default: return 0.0; // Impossible to win if > 5 picks, or 0 picks
    }
  };

  const currentMultiplier = getMultiplier(selectedBlocks.length);
  const potentialPayout = wager && parseFloat(wager) > 0 ? (parseFloat(wager) * currentMultiplier).toFixed(2) : "0.00";

  const initiateSweep = async () => {
    if (!wager || parseFloat(wager) <= 0 || selectedBlocks.length < 1) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    setIsProcessing(true);
    setGameState("sweeping");

    try {
      // 1. Generate Hazards (25 hazards out of 30 blocks)
      const allBlocks = Array.from({ length: 30 }, (_, i) => i);
      const hazards: number[] = [];
      while (hazards.length < 25) {
        const rand = allBlocks[Math.floor(Math.random() * allBlocks.length)];
        if (!hazards.includes(rand)) hazards.push(rand);
      }
      setHazardBlocks(hazards);

      // Evaluate Win/Loss
      const isLoss = selectedBlocks.some(b => hazards.includes(b));
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);

      if (isLoss) {
        // Player Lost
        const tx = new TransferTransaction()
          .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
          .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
          .setTransactionMemo("Mystery Field Loss");

        const res = await executeTransaction(tx);
        if (!res) throw new Error("Transaction rejected");
        
        setGameState("loss");
      } else {
        // Player Won
        setLastWinAmount(potentialPayout);

        // Pre-game transfer
        const tx = new TransferTransaction()
          .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
          .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
          .setTransactionMemo("Mystery Field Win - Verifying...");

        const res = await executeTransaction(tx);
        if (!res) throw new Error("Transaction rejected");

        // Payout
        const payoutRes = await fetch("/api/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            accountId, 
            winAmount: potentialPayout,
            wagerAmount: wager,
            direction: 'GAME_WIN'
          })
        });

        if (!payoutRes.ok) throw new Error("Payout failed");
        
        setGameState("win");
        confetti({
          particleCount: 250,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#00ffff', '#00ffcc', '#ffffff']
        });
      }
      
      refreshBalances();
    } catch (err: any) {
      console.error("[MysteryField] Error:", err);
      setGameState("setup");
      setSelectedBlocks([]);
      setHazardBlocks([]);
      alert(err.message || "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetGame = () => {
    setGameState("setup");
    setSelectedBlocks([]);
    setHazardBlocks([]);
    setLastWinAmount(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-6xl h-[85vh] flex bg-wager-charcoal/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10"
    >
      {/* Left Pane: Controls */}
      <div className="w-[350px] bg-slate-950/80 border-r border-white/5 p-8 flex flex-col justify-between relative z-50 shadow-2xl">
        <div>
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-wager-cyan/20 border border-wager-cyan/50 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.2)]">
              <Target className="text-wager-cyan" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">Mystery</h3>
              <span className="text-[10px] text-wager-cyan font-bold uppercase tracking-widest">Field Sweep</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 bg-gradient-to-br from-slate-900 to-black border border-wager-cyan/20 rounded-2xl shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-wager-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 block relative z-10">Potential Payout</span>
              <div className="flex justify-between items-end relative z-10">
                <span className="text-3xl font-black text-white leading-none tracking-tighter">
                  {currentMultiplier.toFixed(1)}<span className="text-wager-cyan text-lg ml-1">x</span>
                </span>
                <span className="text-[9px] text-wager-cyan font-mono bg-wager-cyan/10 px-2 py-0.5 rounded border border-wager-cyan/20">
                  {selectedBlocks.length} / 10 PICKS
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
                 <span className="text-[10px] text-zinc-600 font-bold uppercase">WINNINGS</span>
                 <span className="text-sm font-mono text-wager-cyan font-bold">{potentialPayout} $WAGER</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1">
                $WAGER Stake
              </label>
              <div className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center focus-within:border-wager-cyan focus-within:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all shadow-lg">
                <Coins className="text-wager-cyan mr-3" size={20} />
                <input
                  type="number"
                  placeholder="0.00"
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                  disabled={gameState !== "setup"}
                  className="bg-transparent text-2xl font-mono text-white outline-none w-full placeholder:text-zinc-800"
                />
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-zinc-600 font-black uppercase">Bal:</span>
                  <span className="text-[10px] font-mono text-wager-cyan font-bold">{balances.wager}</span>
                </div>
                <div className="flex gap-1">
                  {["25", "50", "75", "MAX"].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleQuickSelect(p)}
                      disabled={gameState !== "setup"}
                      className="px-2 py-1 bg-slate-900 border border-white/5 rounded-md text-[9px] font-bold text-zinc-500 hover:text-wager-cyan hover:border-wager-cyan/30 hover:bg-wager-cyan/5 transition-all"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <button
                onClick={initiateSweep}
                disabled={gameState !== "setup" || selectedBlocks.length < 1 || !wager || parseFloat(wager) <= 0 || isProcessing}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all shadow-xl flex items-center justify-center gap-3 relative overflow-hidden group
                  ${(selectedBlocks.length < 1 || !wager || isProcessing || gameState !== "setup")
                    ? "bg-slate-900 text-zinc-600 cursor-not-allowed border border-white/5"
                    : "bg-wager-cyan text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(0,255,255,0.4)]"
                  }`}
              >
                {isProcessing && <Loader2 className="animate-spin relative z-10" size={24} />}
                <span className="relative z-10">{isProcessing ? "Sweeping..." : "Initiate Sweep"}</span>
                {!isProcessing && selectedBlocks.length >= 1 && (
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                )}
              </button>
              {selectedBlocks.length > 5 && gameState === "setup" && (
                <p className="text-[10px] text-center text-wager-red uppercase font-bold mt-3 animate-pulse">WARNING: 100% LOSS GUARANTEED</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex gap-3">
            <Info size={16} className="text-wager-cyan shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
              30 squares. 25 hidden hazards. 5 safe zones. Survive the sweep to win big.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-4 text-xs font-black text-zinc-600 hover:text-white tracking-widest transition-colors border border-transparent hover:border-white/10 rounded-2xl"
          >
            ABORT MISSION
          </button>
        </div>
      </div>

      {/* Right Pane: The Grid Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)] p-12">
        {/* Background Grids */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        
        {/* Central UI (Win/Loss Overlays) */}
        <div className="absolute top-10 w-full text-center z-40 pointer-events-none">
          <AnimatePresence mode="wait">
            {gameState === "win" && (
              <motion.div key="win" initial={{ scale: 0.5, y: -50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} className="flex flex-col items-center drop-shadow-[0_0_50px_rgba(0,255,255,0.8)]">
                <h2 className="text-7xl font-black text-wager-cyan uppercase tracking-widest italic">SWEEP CLEAR</h2>
                <div className="bg-black/50 backdrop-blur-md px-8 py-2 rounded-full border border-wager-cyan/50 mt-4 flex items-center gap-3">
                   <Coins size={24} className="text-wager-cyan" />
                   <span className="text-2xl font-mono text-white font-bold">+{lastWinAmount} WAGER</span>
                </div>
              </motion.div>
            )}
            {gameState === "loss" && (
              <motion.div key="loss" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="drop-shadow-[0_0_50px_rgba(255,0,0,0.8)]">
                <h2 className="text-7xl font-black text-wager-red uppercase tracking-widest italic">HAZARD TRIGGERED</h2>
                <span className="text-sm text-zinc-400 font-mono font-bold tracking-widest uppercase mt-4 block">Stake Annihilated</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5x6 Grid */}
        <div className="relative z-20 w-full max-w-4xl aspect-[6/5] grid grid-cols-6 grid-rows-5 gap-3">
          {Array.from({ length: 30 }).map((_, idx) => {
            const isSelected = selectedBlocks.includes(idx);
            const isHazard = hazardBlocks.includes(idx);
            
            // Post-game Reveal States
            const isRevealed = gameState === "win" || gameState === "loss";
            const showHazard = isRevealed && isHazard;
            const showSafe = isRevealed && !isHazard;
            const isExploded = gameState === "loss" && isSelected && isHazard;

            return (
              <button
                key={idx}
                onClick={() => toggleBlock(idx)}
                disabled={gameState !== "setup"}
                className={`relative group rounded-lg transition-all duration-300 border-2 overflow-hidden flex items-center justify-center
                  ${gameState === "setup" 
                    ? isSelected 
                      ? "bg-wager-cyan/20 border-wager-cyan shadow-[0_0_20px_rgba(0,255,255,0.3)] scale-[1.03] z-10" 
                      : "bg-slate-900 border-slate-700 hover:bg-slate-800 hover:border-wager-cyan/50 hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]" 
                    : "border-transparent bg-slate-900"}
                  ${isExploded ? "bg-wager-red border-wager-red shadow-[0_0_40px_rgba(255,0,0,0.6)] z-20 scale-110" : ""}
                  ${showHazard && !isExploded ? "bg-wager-red/20 border-wager-red/40" : ""}
                  ${showSafe && isSelected && gameState === "win" ? "bg-wager-lime/40 border-wager-lime shadow-[0_0_30px_rgba(204,255,0,0.5)] z-20 scale-110" : ""}
                  ${showSafe && !isSelected ? "bg-wager-lime/10 border-wager-lime/20" : ""}
                `}
              >
                {/* Number Indicator (Setup only) */}
                {gameState === "setup" && !isSelected && (
                  <span className="text-[10px] font-mono text-slate-600 opacity-50">{idx + 1}</span>
                )}

                <AnimatePresence>
                  {/* Selected Indicator */}
                  {isSelected && !isRevealed && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Target size={24} className="text-wager-cyan drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
                    </motion.div>
                  )}

                  {/* Reveal Icons */}
                  {isExploded && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5 }}>
                      <Bomb size={36} className="text-white drop-shadow-md" />
                    </motion.div>
                  )}
                  {showHazard && !isExploded && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}>
                      <Bomb size={24} className="text-wager-red" />
                    </motion.div>
                  )}
                  {showSafe && isSelected && gameState === "win" && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Shield size={36} className="text-white drop-shadow-md" />
                    </motion.div>
                  )}
                  {showSafe && !isSelected && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }}>
                      <Shield size={24} className="text-wager-lime" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Glitch Overlay Effect on Explode */}
                {isExploded && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 0.8, 0] }} transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-white mix-blend-overlay pointer-events-none"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Play Again Button */}
        <AnimatePresence>
          {(gameState === "win" || gameState === "loss") && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-12 z-[60]"
            >
              <button
                onClick={resetGame}
                className="bg-white text-black font-black uppercase tracking-[0.2em] px-16 py-5 rounded-2xl hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all text-xl shadow-2xl border-4 border-black"
              >
                Reset Field
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
