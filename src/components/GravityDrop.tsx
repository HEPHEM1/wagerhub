"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Link as LinkIcon, AlertCircle, RefreshCw, Layers, ShieldAlert, ArrowLeft, HelpCircle } from "lucide-react";
import { TransferTransaction } from "@hashgraph/sdk";
import confetti from "canvas-confetti";
import { useWalletContext } from "../context/WalletContext";

const WAGER_TOKEN_ID = process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191";
const TREASURY_ACCOUNT_ID = process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484";

type Risk = "Low" | "Medium" | "High";

export default function GravityDrop({ onClose }: { onClose: () => void }) {
  const { isConnected, accountId, balances, connect, executeTransaction, refreshBalances } = useWalletContext();

  const [wager, setWager] = useState<string>("50");
  const [rows, setRows] = useState<number>(12);
  const [risk, setRisk] = useState<Risk>("Medium");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false); // Prevents rapid double-click race conditions
  const [isDropping, setIsDropping] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  
  const [ballPath, setBallPath] = useState<{x: number, y: number}[] | null>(null);
  const [gameResult, setGameResult] = useState<{ status: "win" | "loss" | "tie", multiplier: number } | null>(null);
  const [finalBucketIndex, setFinalBucketIndex] = useState<number | null>(null);

  // Constants for Canvas Scaling
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 500;
  const START_Y = 40;
  const END_Y = 440;
  const rowHeight = (END_Y - START_Y) / rows;
  const colWidth = 400 / rows;

  // Generate Pegs Board
  const pegs = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c <= r; c++) {
      pegs.push({
        x: (CANVAS_WIDTH / 2) + (c - r / 2) * colWidth,
        y: START_Y + r * rowHeight
      });
    }
  }

  // Generate Multipliers
  const getMultipliers = () => {
    const bucketCount = rows + 1;
    const multipliers: number[] = [];
    
    for(let i = 0; i < bucketCount; i++) {
      const distance = Math.abs(i - (rows / 2)) / (rows / 2); // 0 to 1
      
      let base = 0;
      if (risk === "High") {
        base = 0.2 + Math.pow(distance, 4) * 100;
        if (distance > 0.9) base *= 3; 
      } else if (risk === "Medium") {
        base = 0.5 + Math.pow(distance, 3) * 20;
      } else {
        base = 0.8 + Math.pow(distance, 2) * 5;
      }
      
      const val = base >= 10 ? Math.floor(base) : Number(base.toFixed(1));
      multipliers.push(val);
    }
    return multipliers;
  };

  const multipliers = getMultipliers();

  // Reset visual state when parameters change
  useEffect(() => {
    if (!isDropping) {
      setBallPath(null);
      setGameResult(null);
      setFinalBucketIndex(null);
      setTxError(null);
    }
  }, [rows, risk]);

  const dropBall = async () => {
    if (!wager || parseFloat(wager) < 50 || isProcessingRef.current || isDropping) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    if (parseFloat(wager) > parseFloat(balances.wager)) {
      setTxError("Insufficient $WAGER balance.");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setTxError(null);
    setGameResult(null);
    setBallPath(null);
    setFinalBucketIndex(null);

    let txSucceeded = false;

    try {
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);
      const tx = new TransferTransaction()
        .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
        .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
        .setTransactionMemo(`Gravity Drop: ${rows} Rows, ${risk} Risk`);

      const res = await executeTransaction(tx);
      if (!res) throw new Error("Transaction rejected");

      // Transaction Succeeded! Start Drop Animation.
      txSucceeded = true;
      setIsProcessing(false);
      isProcessingRef.current = false;
      setIsDropping(true);

      // Generate Deterministic Path
      const pathCoords = [];
      let currentX = CANVAS_WIDTH / 2;
      let currentY = START_Y;
      
      pathCoords.push({ x: currentX, y: currentY });

      // Guard for Next.js SSR
      if (typeof window === "undefined" || !window.crypto) throw new Error("Crypto API unavailable");

      const saltArray = new Uint8Array(rows);
      window.crypto.getRandomValues(saltArray);
      
      let rights = 0;
      for(let i = 0; i < rows; i++) {
         const isRight = saltArray[i] % 2 === 1;
         if (isRight) rights++;
         
         currentX += isRight ? (colWidth / 2) : -(colWidth / 2);
         currentY += rowHeight;
         
         // Add a tiny randomness to Y to make bounces look natural without breaking determinism
         const bounceOffset = (saltArray[i] % 5) - 2;
         pathCoords.push({ x: currentX, y: currentY + bounceOffset });
      }

      setBallPath(pathCoords);
      setFinalBucketIndex(rights);

    } catch (err: any) {
      console.error("[GravityDrop] Error:", err);
      setTxError(err?.message || "Transaction failed.");
    } finally {
      if (!txSucceeded) {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    }
  };

  const handleDropComplete = () => {
    setIsDropping(false);
    if (finalBucketIndex === null) return;

    const mult = multipliers[finalBucketIndex];
    let status: "win" | "loss" | "tie" = "loss";
    
    if (mult > 1) status = "win";
    else if (mult === 1) status = "tie";

    setGameResult({ status, multiplier: mult });

    if (status === "win") {
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, colors: ['#ccff00', '#ff00ff', '#ffffff'] });
      
      const winAmount = (parseFloat(wager) * mult).toFixed(2);
      fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, winAmount, wagerAmount: wager, direction: 'GAME_WIN' })
      }).then(async r => { if (!r.ok) console.error(await r.text()) }).catch(console.error);

    } else if (status === "tie") {
      fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, winAmount: wager, wagerAmount: wager, direction: 'GAME_WIN' })
      }).then(async r => { if (!r.ok) console.error(await r.text()) }).catch(console.error);
    }

    [2000, 4000].forEach(delay => setTimeout(() => refreshBalances(), delay));
  };

  const getBucketColor = (mult: number) => {
    if (mult >= 10) return "bg-rose-500 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)]";
    if (mult > 1) return "bg-wager-lime border-green-400 text-black shadow-[0_0_10px_rgba(163,230,53,0.5)]";
    if (mult === 1) return "bg-zinc-600 border-zinc-400 text-white";
    return "bg-black border-white/10 text-zinc-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-6xl h-[85vh] flex bg-wager-charcoal/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10"
    >
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <button 
          onClick={onClose}
          className="p-3 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/50 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <button
          onClick={() => { onClose(); window.location.hash = "gravity-drop"; }}
          className="flex items-center gap-2 px-4 py-2 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/70 hover:text-white text-sm font-bold uppercase tracking-wider"
        >
          <HelpCircle size={16} />
          How to Play
        </button>
      </div>

      {/* Dynamic Flash Overlay */}
      <AnimatePresence>
        {gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-0 pointer-events-none mix-blend-overlay ${
              gameResult.status === "win" ? "bg-green-500/20" :
              gameResult.status === "loss" ? "bg-red-500/20" : "bg-yellow-500/20"
            }`}
          />
        )}
      </AnimatePresence>

      {/* Left Pane: Controls */}
      <div className="w-80 bg-wager-black/70 border-r border-white/5 p-8 flex flex-col justify-between relative z-50">
        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.3)]">
              <Play className="text-white fill-current" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">GRAVITY</h3>
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-tighter">Plinko Drop</span>
            </div>
          </div>

          {/* Staking Module */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-end mb-4">
              <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">$WAGER STAKE</span>
            </div>
            <div className="relative flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500/50 focus-within:shadow-[0_0_15px_rgba(249,115,22,0.2)] transition-all">
              <LinkIcon size={16} className="text-orange-400 mr-3" />
              <input
                type="number"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
                disabled={isProcessing || isDropping}
                className="bg-transparent w-full text-white font-mono text-xl font-bold focus:outline-none"
                placeholder="50"
                min="50"
                step="10"
              />
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-[10px] font-mono text-zinc-500">BAL: <span className="text-wager-lime">{balances.wager}</span></span>
              <div className="flex gap-2">
                {['MIN', '1/2', 'MAX'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => {
                      const bal = parseFloat(balances.wager);
                      if (isNaN(bal)) return;
                      if (btn === 'MIN') setWager("50");
                      if (btn === '1/2') setWager(Math.max(50, Math.floor(bal / 2)).toString());
                      if (btn === 'MAX') setWager(Math.max(50, Math.floor(bal)).toString());
                    }}
                    disabled={isProcessing || isDropping}
                    className="text-[9px] font-black text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rows Config */}
          <div className="mb-6">
            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Layers size={14} /> Rows
            </h4>
            <div className="bg-black/50 border border-white/10 rounded-xl p-2 flex">
              {[8, 10, 12, 14, 16].map(r => (
                <button
                  key={r}
                  onClick={() => setRows(r)}
                  disabled={isProcessing || isDropping}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    rows === r ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Config */}
          <div className="mb-6">
            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert size={14} /> Risk Level
            </h4>
            <div className="bg-black/50 border border-white/10 rounded-xl p-2 flex gap-1">
              {(["Low", "Medium", "High"] as Risk[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  disabled={isProcessing || isDropping}
                  className={`flex-1 py-2 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all ${
                    risk === r 
                      ? r === 'High' ? "bg-rose-500/20 text-rose-400" : r === 'Medium' ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {txError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-mono break-words">{txError}</p>
            </div>
          )}
        </div>

        <button
          onClick={dropBall}
          disabled={isProcessing || isDropping || parseFloat(wager) < 50}
          className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)]
            ${isProcessing || isDropping || parseFloat(wager) < 50 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' 
              : 'bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          {isProcessing ? "AWAITING WALLET..." : "DROP BALL"}
        </button>
      </div>

      {/* Right Pane: Canvas Area */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-gradient-to-b from-wager-charcoal to-black z-10 overflow-hidden">
        
        <button 
          onClick={onClose}
          disabled={isProcessing || isDropping}
          className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group z-50 disabled:opacity-50"
        >
          <X size={20} className="text-white/50 group-hover:text-white transition-colors" />
        </button>

        {/* Central Canvas Container */}
        <div 
          className="relative" 
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Render Pegs */}
          {pegs.map((p, i) => (
            <div 
              key={i} 
              className="absolute w-2 h-2 bg-white/20 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)] -ml-1 -mt-1"
              style={{ left: p.x, top: p.y }}
            />
          ))}

          {/* Render Multiplier Buckets */}
          <div 
            className="absolute flex w-full justify-between items-end gap-1 px-4"
            style={{ top: END_Y + 10, height: 40 }}
          >
            {multipliers.map((mult, i) => {
              const isHighlight = finalBucketIndex === i && gameResult !== null;
              return (
                <motion.div
                  key={i}
                  animate={isHighlight ? { y: [0, -10, 0] } : {}}
                  transition={{ duration: 0.3 }}
                  className={`flex-1 h-full rounded-md border flex items-center justify-center transition-all duration-300
                    ${getBucketColor(mult)} ${isHighlight ? 'scale-110' : ''}
                  `}
                >
                  <span className={`font-mono font-bold ${rows > 12 ? 'text-[9px]' : 'text-xs'}`}>
                    {mult}x
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* The Bouncing Ball */}
          <AnimatePresence>
            {ballPath && (
              <motion.div
                initial={{ x: ballPath[0].x, y: ballPath[0].y, opacity: 0 }}
                animate={{ 
                  x: ballPath.map(p => p.x), 
                  y: ballPath.map(p => p.y),
                  opacity: 1
                }}
                transition={{
                  duration: rows * 0.15,
                  ease: "linear",
                  opacity: { duration: 0.2 }
                }}
                onAnimationComplete={handleDropComplete}
                className="absolute w-5 h-5 rounded-full bg-white -ml-2.5 -mt-2.5 shadow-[0_0_20px_rgba(255,255,255,1)] z-50 flex items-center justify-center"
              >
                <div className="w-3 h-3 rounded-full bg-orange-400 blur-[2px]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Banner Overlay */}
          <AnimatePresence>
            {gameResult && !isDropping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center"
              >
                <h2 className={`text-6xl font-black uppercase tracking-tighter drop-shadow-2xl mb-2 ${
                  gameResult.status === "win" ? "text-green-400" :
                  gameResult.status === "loss" ? "text-red-500" : "text-yellow-400"
                }`}>
                  {gameResult.status === "win" ? "WIN" : gameResult.status === "loss" ? "LOSS" : "TIE"}
                </h2>
                <div className="bg-black/80 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full flex gap-3 items-center">
                  <span className="text-zinc-400 text-xs font-bold tracking-widest uppercase">Multiplier:</span>
                  <span className="text-white font-mono font-bold text-lg">{gameResult.multiplier}x</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
      </div>
    </motion.div>
  );
}
