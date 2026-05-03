"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bomb, Gem, Coins, Target, Loader2 } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";

const TREASURY_ACCOUNT_ID = AccountId.fromString(process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484");
const WAGER_TOKEN_ID = TokenId.fromString("0.0.8818191");

type GameState = "setup" | "playing" | "cashout" | "bust";

interface Box {
  id: number;
  isMine: boolean;
  isRevealed: boolean;
}

export default function BlindLootGame({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [mines, setMines] = useState(3);
  const [wager, setWager] = useState<string>("10");
  const [boxes, setBoxes] = useState<Box[]>(Array.from({ length: 30 }).map((_, i) => ({ id: i, isMine: false, isRevealed: false })));
  const [multiplier, setMultiplier] = useState(1.0);
  const [safeClicks, setSafeClicks] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);

  const { isConnected, accountId, executeTransaction, refreshBalances, connect } = useWagerWallet();

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
        console.warn("[BlindLootGame] 6-second timeout reached! Forcing UI transition.");
        hasResolved = true;
        setIsProcessing(false);
        
        const newBoxes = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          isMine: false,
          isRevealed: false,
        }));
        let minesPlaced = 0;
        while (minesPlaced < mines) {
          const idx = Math.floor(Math.random() * 30);
          if (!newBoxes[idx].isMine) {
            newBoxes[idx].isMine = true;
            minesPlaced++;
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
        .setTransactionMemo("Blind Loot Wager");

      const res = await executeTransaction(tx);

      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(fallbackTimeout);

      if (!res) {
        console.warn("[BlindLootGame] Transaction execution returned null.");
        alert("Transaction was rejected or failed to parse. Please check your wallet.");
        return;
      }

      const { txId, status } = res;

      if (status === "SUCCESS" || txId) {
        console.log("[BlindLootGame] ✅ Wager successful! Status:", status, "Tx ID:", txId);

        const newBoxes = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          isMine: false,
          isRevealed: false,
        }));

        let minesPlaced = 0;
        while (minesPlaced < mines) {
          const idx = Math.floor(Math.random() * 30);
          if (!newBoxes[idx].isMine) {
            newBoxes[idx].isMine = true;
            minesPlaced++;
          }
        }

        setBoxes(newBoxes);
        setMultiplier(1.0);
        setSafeClicks(0);
        setGameState("playing");
        
        setTimeout(() => refreshBalances(), 2000);
      } else {
        console.error("[BlindLootGame] Transaction failed with status:", status);
        alert("Transaction failed on the network. Please try again.");
      }
    } catch (err: any) {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(fallbackTimeout);
      console.error("[BlindLootGame] Start game error:", err);
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

    if (newBoxes[idx].isMine) {
      setGameState("bust");
    } else {
      const newSafeClicks = safeClicks + 1;
      setSafeClicks(newSafeClicks);
      
      const baseIncrease = 1 + (mines * 0.05);
      const newMult = Math.pow(baseIncrease, newSafeClicks);
      setMultiplier(newMult);
    }
  };

  const currentWin = wager ? (parseFloat(wager) * multiplier).toFixed(2) : "0.00";

  const cashOut = async () => {
    if (!accountId || !wager) return;

    setIsCashingOut(true);
    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, winAmount: currentWin })
      });

      if (!res.ok) {
        throw new Error("Payout API failed");
      }

      setGameState("cashout");
      setTimeout(() => refreshBalances(), 2000);
    } catch (err) {
      console.error("[BlindLootGame] Cash out error:", err);
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
      className={`relative w-full max-w-6xl h-[80vh] flex bg-wager-charcoal/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border ${
        gameState === "bust" ? "border-wager-red" : "border-wager-cyan/20"
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
      </AnimatePresence>

      {/* Left Pane: Control Desk */}
      <div className="w-1/3 bg-wager-black/60 border-r border-wager-charcoal p-8 flex flex-col justify-between relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Target className="text-wager-lime" size={32} />
            <h3 className="text-2xl font-black text-white tracking-widest uppercase">Blind Loot</h3>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider flex justify-between">
                <span>Number of Mines</span>
                <span className="text-wager-red font-black">{mines} MINES</span>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={mines}
                onChange={(e) => setMines(parseInt(e.target.value))}
                disabled={gameState === "playing"}
                className={`w-full accent-wager-red h-3 bg-wager-charcoal rounded-lg appearance-none ${gameState === "playing" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              />
              <div className="flex justify-between text-xs font-mono text-zinc-500">
                <span>2 (Low Risk)</span>
                <span>10 (Degen)</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                Wager Amount ($WAGER)
              </label>
              <div className="flex flex-col gap-3">
                <div className="w-full bg-wager-black border border-wager-charcoal rounded-2xl p-4 flex items-center focus-within:border-wager-cyan transition-colors">
                  <Coins className="text-wager-lime mr-3" size={24} />
                  <input
                    type="number"
                    placeholder="0.00"
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                    disabled={gameState === "playing"}
                    className="bg-transparent text-3xl font-mono text-white outline-none w-full placeholder:text-zinc-700 disabled:opacity-50"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWager("10")} disabled={gameState === "playing"} className="flex-1 bg-wager-black border border-wager-charcoal py-2 rounded-xl text-zinc-300 font-bold hover:text-wager-lime hover:border-wager-lime/50 disabled:opacity-50 transition-all">MIN</button>
                  <button onClick={() => setWager("500")} disabled={gameState === "playing"} className="flex-1 bg-wager-black border border-wager-charcoal py-2 rounded-xl text-zinc-300 font-bold hover:text-wager-lime hover:border-wager-lime/50 disabled:opacity-50 transition-all">HALF</button>
                  <button onClick={() => setWager("1000")} disabled={gameState === "playing"} className="flex-1 bg-wager-black border border-wager-charcoal py-2 rounded-xl text-zinc-300 font-bold hover:text-wager-lime hover:border-wager-lime/50 disabled:opacity-50 transition-all">MAX</button>
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
              className="w-full bg-wager-lime text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.5)] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : !isConnected ? "Connect Wallet" : "Start Game"}
            </motion.button>
          ) : gameState === "playing" && safeClicks > 0 ? (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={cashOut}
              disabled={isCashingOut}
              className="w-full bg-wager-lime text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_30px_rgba(204,255,0,0.5)] hover:shadow-[0_0_40px_rgba(204,255,0,0.7)] animate-pulse transition-all disabled:opacity-50 disabled:animate-none"
            >
              {isCashingOut ? <><Loader2 className="animate-spin inline mr-2" size={24} /> Cashing Out...</> : `Cash Out ${currentWin}`}
            </motion.button>
          ) : (gameState === "bust" || gameState === "cashout") ? (
            <button
              onClick={() => setGameState("setup")}
              className="w-full bg-white text-black font-black text-xl uppercase tracking-widest py-5 rounded-2xl hover:bg-zinc-200 transition-colors"
            >
              {gameState === "bust" ? "Try Again (Rekt)" : "Play Again"}
            </button>
          ) : (
            <button disabled className="w-full bg-wager-charcoal text-zinc-500 font-black text-xl uppercase tracking-widest py-5 rounded-2xl cursor-not-allowed">
              Playing...
            </button>
          )}
          
          <button onClick={onClose} className="w-full py-3 text-sm font-bold text-zinc-500 hover:text-white transition-colors">
            EXIT GAME
          </button>
        </div>
      </div>

      {/* Right Pane: Center Stage (Grid & HUD) */}
      <motion.div 
        animate={gameState === "bust" ? { x: [-15, 15, -15, 15, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-2/3 p-12 flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Massive Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-wager-lime/5 via-wager-charcoal/0 to-transparent pointer-events-none" />

        {/* Progressive HUD */}
        <div className="w-full max-w-2xl flex justify-between items-end mb-10 z-10">
          <div>
            <span className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-2 block">
              Potential Win
            </span>
            <div className="text-3xl font-mono text-wager-cyan font-bold">
              {currentWin} WAGER
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-2 block">
              Current Multiplier
            </span>
            <div className="text-7xl font-black text-white tracking-tighter">
              {multiplier.toFixed(2)}<span className="text-wager-lime text-5xl">x</span>
            </div>
          </div>
        </div>

        {/* 30-Box Grid */}
        <div className="w-full max-w-3xl grid grid-cols-6 gap-4 z-10">
          {boxes.map((box, idx) => {
            const isRevealed = box.isRevealed || gameState === "bust" || gameState === "cashout";
            const isSafe = isRevealed && !box.isMine;

            return (
              <motion.button
                key={box.id}
                whileTap={gameState === "playing" && !isRevealed ? { scale: 0.9 } : {}}
                onClick={() => handleBoxClick(idx)}
                disabled={gameState !== "playing" || isRevealed}
                className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                  !isRevealed
                    ? "bg-wager-black border-[3px] border-[#1a1a1a] shadow-[inset_0_-4px_0_rgba(255,255,255,0.05)] hover:border-wager-lime/50"
                    : isSafe
                    ? "bg-wager-lime/20 border-[3px] border-wager-lime text-wager-lime shadow-[0_0_25px_rgba(204,255,0,0.2)]"
                    : "bg-wager-red/20 border-[3px] border-wager-red text-wager-red shadow-[0_0_25px_rgba(255,0,0,0.3)]"
                }`}
              >
                {isRevealed && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {isSafe ? <Gem size={36} /> : <Bomb size={36} />}
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
