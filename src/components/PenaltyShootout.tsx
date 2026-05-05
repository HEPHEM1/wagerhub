"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, XCircle, Coins, Loader2, Footprints, Target } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";

const TREASURY_ACCOUNT_ID = AccountId.fromString((process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim());
const WAGER_TOKEN_ID = TokenId.fromString((process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim());

type GameState = "setup" | "kicking" | "goal" | "saved";

const ZONES = [
  { id: 0, label: "Top Left", grid: "row-start-1 col-start-1" },
  { id: 1, label: "Top Center", grid: "row-start-1 col-start-2" },
  { id: 2, label: "Top Right", grid: "row-start-1 col-start-3" },
  { id: 3, label: "Bottom Left", grid: "row-start-2 col-start-1" },
  { id: 4, label: "Bottom Center", grid: "row-start-2 col-start-2" },
  { id: 5, label: "Bottom Right", grid: "row-start-2 col-start-3" },
];

export default function PenaltyShootout({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [wager, setWager] = useState<string>("50");
  const [isProcessing, setIsProcessing] = useState(false);
  const [playerChoice, setPlayerChoice] = useState<number | null>(null);
  const [keeperDives, setKeeperDives] = useState<number[]>([]);
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

  const takeShot = async (zoneId: number) => {
    if (!wager || parseFloat(wager) <= 0) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    setIsProcessing(true);
    setPlayerChoice(zoneId);
    setGameState("kicking");

    try {
      // 1. Randomly select 2 dive zones
      const zones = [0, 1, 2, 3, 4, 5];
      const dives: number[] = [];
      while (dives.length < 2) {
        const rand = zones[Math.floor(Math.random() * zones.length)];
        if (!dives.includes(rand)) dives.push(rand);
      }
      setKeeperDives(dives);

      const isLoss = dives.includes(zoneId);
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);

      // 2. Execution Logic
      if (isLoss) {
        // Player Lost -> Transfer to Treasury
        const tx = new TransferTransaction()
          .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
          .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
          .setTransactionMemo("Penalty Shootout Loss");

        const res = await executeTransaction(tx);
        if (!res) throw new Error("Transaction rejected");
        
        setGameState("saved");
      } else {
        // Player Won -> Get payout (1.5x Multiplier for 4/6 odds)
        // Note: For 2 keeper dives out of 6 zones, odds are 4/6 = 66.6% win rate.
        // We'll use a 1.4x multiplier for a house edge.
        const winAmount = (parseFloat(wager) * 1.4).toFixed(2);
        setLastWinAmount(winAmount);

        // We execute a transfer of the wager first (standard for all games to prevent front-running)
        const tx = new TransferTransaction()
          .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
          .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
          .setTransactionMemo("Penalty Shootout Win - Verifying...");

        const res = await executeTransaction(tx);
        if (!res) throw new Error("Transaction rejected");

        // Hit payout API
        const payoutRes = await fetch("/api/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            accountId, 
            winAmount,
            wagerAmount: wager,
            direction: 'GAME_WIN' // Using a flag to denote game win
          })
        });

        if (!payoutRes.ok) throw new Error("Payout failed");
        
        setGameState("goal");
      }
      
      refreshBalances();
    } catch (err: any) {
      console.error("[PenaltyShootout] Error:", err);
      setGameState("setup");
      setPlayerChoice(null);
      setKeeperDives([]);
      alert(err.message || "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-6xl h-[85vh] flex bg-wager-charcoal/90 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.6)] border border-white/10"
    >
      {/* Left Pane: Controls */}
      <div className="w-80 bg-wager-black/60 border-r border-white/5 p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-wager-lime rounded-xl">
              <Footprints className="text-black" size={24} />
            </div>
            <h3 className="text-xl font-black text-white tracking-widest uppercase italic">The Penalty</h3>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-wager-black/40 border border-white/5 rounded-2xl">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Payout Odds</span>
              <div className="flex justify-between items-end">
                <span className="text-2xl font-black text-white">1.40<span className="text-wager-lime text-lg">x</span></span>
                <span className="text-[10px] text-zinc-600 font-mono">4/6 WIN PROB.</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Wager ($WAGER)</label>
              <div className="w-full bg-wager-black border border-white/10 rounded-2xl p-4 flex items-center focus-within:border-wager-lime transition-colors">
                <Coins className="text-wager-lime mr-3" size={20} />
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
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">BAL:</span>
                  <span className="text-[10px] font-mono text-wager-lime font-bold">{balances.wager}</span>
                </div>
                <div className="flex gap-1">
                  {["25", "50", "75", "MAX"].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleQuickSelect(p)}
                      disabled={gameState !== "setup"}
                      className="px-2 py-0.5 bg-wager-black border border-white/5 rounded text-[9px] font-bold text-zinc-500 hover:text-wager-lime transition-colors"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[10px] text-zinc-400 leading-relaxed italic">
              Choose one of the 6 zones to shoot. If the keeper dives to your zone, your shot is saved!
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-4 text-xs font-black text-zinc-500 hover:text-white tracking-widest transition-colors border border-transparent hover:border-white/10 rounded-2xl"
          >
            QUIT ARCADE
          </button>
        </div>
      </div>

      {/* Right Pane: Goal & Pitch */}
      <div className="flex-1 relative p-12 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_bottom,_#1a1a1a_0%,_#0a0a0a_100%)]">
        {/* Stadium Lights Effect */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-wager-lime/5 to-transparent pointer-events-none" />

        <div className="mb-12 text-center z-10">
          <AnimatePresence mode="wait">
            {gameState === "setup" && (
              <motion.h2 
                key="setup"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-4xl font-black text-white uppercase tracking-[0.2em] italic"
              >
                Choose Your Zone
              </motion.h2>
            )}
            {gameState === "kicking" && (
              <motion.h2 
                key="kicking"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="text-4xl font-black text-wager-cyan uppercase tracking-widest animate-pulse"
              >
                Kicking...
              </motion.h2>
            )}
            {gameState === "goal" && (
              <motion.h2 
                key="goal"
                initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }}
                className="text-6xl font-black text-wager-lime uppercase tracking-widest drop-shadow-[0_0_20px_rgba(204,255,0,0.5)]"
              >
                GOAL!
              </motion.h2>
            )}
            {gameState === "saved" && (
              <motion.h2 
                key="saved"
                initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }}
                className="text-6xl font-black text-wager-red uppercase tracking-widest drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]"
              >
                SAVED!
              </motion.h2>
            )}
          </AnimatePresence>
        </div>

        {/* The Goal Interface */}
        <div className="relative w-full max-w-4xl aspect-[2.5/1] bg-black/40 border-[6px] border-white/90 rounded-t-lg shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden">
          {/* Net Pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          
          <div className="grid grid-cols-3 grid-rows-2 h-full gap-2 p-2 relative z-20">
            {ZONES.map((zone) => {
              const isSelected = playerChoice === zone.id;
              const isKeeperDive = keeperDives.includes(zone.id);
              const isWin = gameState === "goal" && isSelected;
              const isSaved = gameState === "saved" && isSelected && isKeeperDive;

              return (
                <button
                  key={zone.id}
                  onClick={() => gameState === "setup" && takeShot(zone.id)}
                  disabled={gameState !== "setup"}
                  className={`relative group flex items-center justify-center rounded-lg transition-all duration-300 border-2
                    ${gameState === "setup" 
                      ? "bg-transparent border-white/5 hover:bg-white/5 hover:border-wager-lime/40" 
                      : "border-transparent"}
                    ${isSelected ? "z-30" : ""}
                  `}
                >
                  {/* Highlight for player choice */}
                  {isSelected && (
                    <motion.div 
                      layoutId="choice"
                      className={`absolute inset-0 rounded-lg border-4 shadow-2xl ${gameState === "goal" ? "border-wager-lime" : "border-wager-red"}`}
                      initial={false}
                    />
                  )}

                  {/* Highlight for keeper dives */}
                  {isKeeperDive && (gameState === "goal" || gameState === "saved") && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-red-500/20 flex items-center justify-center"
                    >
                      <XCircle size={48} className="text-wager-red/40" />
                    </motion.div>
                  )}

                  {/* Icon Feedback */}
                  <div className="relative z-40">
                    {isSelected && !isProcessing && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        {gameState === "goal" ? <Trophy size={48} className="text-wager-lime" /> : <XCircle size={48} className="text-wager-red" />}
                      </motion.div>
                    )}
                    {gameState === "setup" && (
                      <Target className="text-white/10 group-hover:text-wager-lime/40 transition-colors" size={32} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Keeper Animation (Simplified as a shadow/glow for now) */}
          <AnimatePresence>
            {gameState === "kicking" && (
              <motion.div 
                initial={{ x: 0, scale: 0.5, opacity: 0 }}
                animate={{ x: [0, -100, 100, 0], scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-32 h-32 bg-wager-cyan/20 blur-3xl rounded-full animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Ball */}
        <div className="mt-16 relative">
          <motion.div
            animate={
              gameState === "setup" ? { y: [0, -5, 0] } :
              gameState === "kicking" ? { scale: [1, 0.5, 0.2], y: -200, opacity: [1, 1, 0] } :
              { opacity: 0 }
            }
            transition={{ duration: 1, repeat: gameState === "setup" ? Infinity : 0 }}
            className="w-16 h-16 bg-white rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-center justify-center border-4 border-zinc-200"
          >
            <div className="w-full h-full opacity-20" style={{ backgroundImage: "radial-gradient(#000 2px, transparent 0)", backgroundSize: "10px 10px" }} />
          </motion.div>
          {gameState === "setup" && (
            <div className="absolute -bottom-2 inset-x-0 h-2 bg-black/40 blur-md rounded-full mx-auto w-12" />
          )}
        </div>

        {/* Play Again Button */}
        <AnimatePresence>
          {(gameState === "goal" || gameState === "saved") && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="mt-12 z-20"
            >
              <button
                onClick={() => {
                  setGameState("setup");
                  setPlayerChoice(null);
                  setKeeperDives([]);
                }}
                className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-2xl hover:bg-zinc-200 transition-all text-xl"
              >
                Another Shot
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
