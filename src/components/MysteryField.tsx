"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bomb, Gift, Coins, Grid3X3, Loader2 } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import confetti from "canvas-confetti";

const TREASURY_ACCOUNT_ID = AccountId.fromString((process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim());
const WAGER_TOKEN_ID = TokenId.fromString("0.0.8818191");

type GameState = "setup" | "playing" | "cashout" | "bust";

interface Box {
  id: number;
  isBomb: boolean;
  isRevealed: boolean;
}

export default function MysteryField({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [bombs, setBombs] = useState(3);
  const [wager, setWager] = useState<string>("10");
  const [boxes, setBoxes] = useState<Box[]>(Array.from({ length: 30 }).map((_, i) => ({ id: i, isBomb: false, isRevealed: false })));
  const [multiplier, setMultiplier] = useState(1.0);
  const [safeClicks, setSafeClicks] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);

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

  const startGame = async () => {
    if (!wager || parseFloat(wager) <= 0) return;
    if (!isConnected || !accountId) {
      alert("Please connect your wallet to play!");
      return;
    }

    setIsProcessing(true);
    let hasResolved = false;

    // ── 6-Second Safety Net ──
    const fallbackTimeout = setTimeout(() => {
      if (!hasResolved) {
        console.warn("[MysteryField] 6-second timeout reached! Forcing UI transition.");
        hasResolved = true;
        setIsProcessing(false);
        
        const newBoxes = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          isBomb: false,
          isRevealed: false,
        }));
        let bombsPlaced = 0;
        while (bombsPlaced < bombs) {
          const idx = Math.floor(Math.random() * 30);
          if (!newBoxes[idx].isBomb) {
            newBoxes[idx].isBomb = true;
            bombsPlaced++;
          }
        }
        setBoxes(newBoxes);
        setMultiplier(1.0);
        setSafeClicks(0);
        setGameState("playing");
      }
    }, 6000);

    try {
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);
      
      const tx = new TransferTransaction()
        .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
        .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
        .setTransactionMemo("Mystery Field Wager");

      const res = await executeTransaction(tx);

      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(fallbackTimeout);

      if (!res) {
        console.warn("[MysteryField] Transaction execution returned null.");
        alert("Transaction was rejected or failed to parse. Please check your wallet.");
        return;
      }

      const { txId, status } = res;

      if (status === "SUCCESS" || txId) {
        console.log("[MysteryField] ✅ Wager successful! Status:", status, "Tx ID:", txId);

        const newBoxes = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          isBomb: false,
          isRevealed: false,
        }));

        let bombsPlaced = 0;
        while (bombsPlaced < bombs) {
          const idx = Math.floor(Math.random() * 30);
          if (!newBoxes[idx].isBomb) {
            newBoxes[idx].isBomb = true;
            bombsPlaced++;
          }
        }

        setBoxes(newBoxes);
        setMultiplier(1.0);
        setSafeClicks(0);
        setGameState("playing");
        
        // Poll to catch Hedera Mirror Node indexing delays
        [2000, 4000, 6000].forEach(delay => setTimeout(() => refreshBalances(), delay));
      } else {
        console.error("[MysteryField] Transaction failed with status:", status);
        alert("Transaction failed on the network. Please try again.");
      }
    } catch (err: any) {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(fallbackTimeout);
      console.error("[MysteryField] Start game error:", err);
      alert(err.message || "Transaction failed. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBoxClick = (idx: number) => {
    if (gameState !== "playing" || boxes[idx].isRevealed) return;

    const newBoxes = [...boxes];
    newBoxes[idx].isRevealed = true;
    setBoxes(newBoxes);

    if (newBoxes[idx].isBomb) {
      setGameState("bust");
    } else {
      const newSafeClicks = safeClicks + 1;
      setSafeClicks(newSafeClicks);
      
      const baseIncrease = 1 + (bombs * 0.05);
      const newMult = Math.pow(baseIncrease, newSafeClicks);
      setMultiplier(newMult);
      
      // Auto cashout if all safe boxes are found
      if (newSafeClicks === (30 - bombs)) {
        cashOut(newMult);
      }
    }
  };

  const currentWin = wager ? (parseFloat(wager) * multiplier).toFixed(2) : "0.00";

  const cashOut = async (finalMult?: number) => {
    if (!accountId || !wager) return;

    const winAmountToPayout = wager ? (parseFloat(wager) * (finalMult || multiplier)).toFixed(2) : "0.00";
    setIsCashingOut(true);

    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accountId, 
          winAmount: winAmountToPayout,
          wagerAmount: wager,
          direction: 'GAME_WIN'
        })
      });

      if (!res.ok) {
        throw new Error("Payout API failed");
      }

      setGameState("cashout");
      
      // Hurray Celebration!
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#00ffff', '#ccff00', '#ffffff', '#ffd700']
      });

      // Poll to catch Hedera Mirror Node indexing delays
      [2000, 4000, 6000].forEach(delay => setTimeout(() => refreshBalances(), delay));
    } catch (err) {
      console.error("[MysteryField] Cash out error:", err);
      alert("Failed to process payout. Please contact support.");
    } finally {
      setIsCashingOut(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", bounce: 0.2 }}
      className={`relative w-full max-w-6xl h-[80vh] flex glass-card overflow-hidden transition-colors duration-500 ${
        gameState === "bust" ? "border-wager-red/50 shadow-[0_0_50px_rgba(255,0,0,0.2)]" : "border-wager-cyan/20"
      }`}
    >
      <AnimatePresence>
        {gameState === "bust" && (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 bg-wager-red/40 z-50 pointer-events-none"
          />
        )}
        {gameState === "cashout" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
             <h1 className="text-8xl font-black text-wager-lime uppercase italic tracking-widest drop-shadow-[0_0_30px_rgba(204,255,0,0.8)]">LOOT SECURED</h1>
             <p className="text-3xl font-mono text-white mt-4">+ {currentWin} WAGER</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Pane: Control Desk */}
      <div className="w-1/3 bg-slate-950/80 border-r border-white/10 p-8 flex flex-col justify-between relative z-50">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="p-3 bg-wager-cyan/20 rounded-full border border-wager-cyan/40">
              <Grid3X3 className="text-wager-cyan" size={28} />
            </div>
            <h3 className="text-2xl font-black text-white tracking-widest uppercase">Mystery Field</h3>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider flex justify-between">
                <span>Hazard Risk (Bombs)</span>
                <span className="text-wager-red font-black">{bombs} BOMBS</span>
              </label>
              <input
                type="range"
                min="1"
                max="29"
                value={bombs}
                onChange={(e) => setBombs(parseInt(e.target.value))}
                disabled={gameState === "playing"}
                className={`w-full accent-wager-red h-3 bg-zinc-800 rounded-lg appearance-none ${gameState === "playing" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>1 (Safe)</span>
                <span>29 (Insane)</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                Wager Amount ($WAGER)
              </label>
              <div className="flex flex-col gap-3">
                <div className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 flex flex-col focus-within:border-wager-cyan transition-colors">
                  <div className="flex items-center w-full">
                    <Coins className="text-wager-cyan mr-3" size={24} />
                    <input
                      type="number"
                      placeholder="0.00"
                      value={wager}
                      onChange={(e) => setWager(e.target.value)}
                      disabled={gameState === "playing"}
                      className="bg-transparent text-3xl font-mono text-white outline-none w-full placeholder:text-zinc-700 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 ml-9">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Balance:</span>
                    <span className="text-[11px] font-mono text-wager-cyan font-bold">{balances.wager} $WAGER</span>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-1 px-1">
                  <div className="flex gap-1.5">
                    {["25", "50", "75", "MAX"].map((percent) => (
                      <button
                         key={percent}
                         onClick={() => handleQuickSelect(percent)}
                         disabled={gameState === "playing" || !isConnected}
                         className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-md text-[10px] font-bold text-zinc-400 hover:text-wager-cyan hover:border-wager-cyan/50 transition-all disabled:opacity-50"
                       >
                         {percent === "MAX" ? "MAX" : `${percent}%`}
                       </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {gameState === "setup" ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={!isConnected ? connect : startGame}
              disabled={isProcessing || (isConnected && (!wager || parseFloat(wager) <= 0))}
              className="w-full bg-wager-cyan text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : !isConnected ? "Connect Wallet" : "Start Game"}
            </motion.button>
          ) : gameState === "playing" && safeClicks > 0 ? (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => cashOut()}
              disabled={isCashingOut}
              className="w-full bg-wager-lime text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_30px_rgba(204,255,0,0.5)] hover:shadow-[0_0_50px_rgba(204,255,0,0.7)] animate-pulse transition-all disabled:opacity-50 disabled:animate-none"
            >
              {isCashingOut ? <><Loader2 className="animate-spin inline mr-2" size={24} /> Cashing Out...</> : `Cash Out ${currentWin}`}
            </motion.button>
          ) : (gameState === "bust" || gameState === "cashout") ? (
            <button
              onClick={() => setGameState("setup")}
              className="w-full bg-white text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl hover:bg-zinc-200 transition-colors z-50 relative"
            >
              {gameState === "bust" ? "Try Again (Rekt)" : "Play Again"}
            </button>
          ) : (
            <button disabled className="w-full bg-zinc-900 border border-white/5 text-zinc-600 font-black text-xl uppercase tracking-widest py-5 rounded-2xl cursor-not-allowed">
              Playing...
            </button>
          )}
          
          <button onClick={onClose} className="w-full py-3 text-sm font-bold text-zinc-500 hover:text-white transition-colors relative z-50">
            EXIT GAME
          </button>
        </div>
      </div>

      {/* Right Pane: Center Stage (Grid & HUD) */}
      <div className="w-2/3 p-12 flex flex-col items-center justify-center relative overflow-hidden bg-slate-950">
        {/* Massive Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-wager-cyan/10 via-transparent to-transparent pointer-events-none" />

        {/* Progressive HUD */}
        <div className="w-full max-w-2xl flex justify-between items-end mb-10 z-10">
          <div>
            <span className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-2 block">
              Potential Win
            </span>
            <div className="text-3xl font-mono text-wager-lime font-bold">
              {currentWin} WAGER
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-2 block">
              Current Multiplier
            </span>
            <div className="text-7xl font-black text-white tracking-tighter">
              {multiplier.toFixed(2)}<span className="text-wager-cyan text-5xl">x</span>
            </div>
          </div>
        </div>

        {/* 30-Box Grid */}
        <div className="w-full max-w-3xl grid grid-cols-6 gap-3 z-10">
          {boxes.map((box, idx) => {
            const isRevealed = box.isRevealed || gameState === "bust" || gameState === "cashout";
            const isSafe = isRevealed && !box.isBomb;

            return (
              <motion.button
                key={box.id}
                whileHover={gameState === "playing" && !isRevealed ? { scale: 1.05 } : {}}
                whileTap={gameState === "playing" && !isRevealed ? { scale: 0.95 } : {}}
                onClick={() => handleBoxClick(idx)}
                disabled={gameState !== "playing" || isRevealed}
                className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-300 border-2 overflow-hidden ${
                  !isRevealed
                    ? "bg-zinc-900 border-zinc-700/50 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] hover:border-wager-cyan hover:bg-zinc-800"
                    : isSafe
                    ? "bg-wager-lime/20 border-wager-lime text-wager-lime shadow-[0_0_15px_rgba(204,255,0,0.3)]"
                    : "bg-wager-red/20 border-wager-red text-wager-red shadow-[0_0_15px_rgba(255,0,0,0.4)]"
                }`}
              >
                <AnimatePresence>
                  {isRevealed && (
                    <motion.div
                      initial={{ scale: 0, rotate: -45, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      {isSafe ? <Gift size={32} className="drop-shadow-lg" /> : <Bomb size={32} className="animate-pulse drop-shadow-xl" />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
