"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Coins, Loader2, ArrowLeft } from "lucide-react";
import { useWalletContext } from "../context/WalletContext";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import confetti from "canvas-confetti";

const TREASURY_ACCOUNT_ID = AccountId.fromString((process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim());
const WAGER_TOKEN_ID = TokenId.fromString((process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim());

export default function TrendRider({ onBack }: { onBack: () => void }) {
  const { isConnected, accountId, balances, executeTransaction, connect } = useWalletContext();

  // Core Game State
  const [gameState, setGameState] = useState<"idle" | "active" | "resolved">("idle");
  const [wager, setWager] = useState("10");
  const [prediction, setPrediction] = useState<"LONG" | "SHORT" | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Price State
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ x: number; y: number }[]>([]);
  
  // Visual Effects State
  const [shake, setShake] = useState(false);
  const [pnlMultiplier, setPnlMultiplier] = useState(1.0);
  const [winStatus, setWinStatus] = useState<"WIN" | "LOSS" | null>(null);

  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // --- Price Simulation Engine ---
  useEffect(() => {
    // Generate initial history
    let price = 50000;
    const initialHistory = Array.from({ length: 40 }).map((_, i) => {
      price += (Math.random() - 0.5) * 100;
      return { x: i, y: price };
    });
    setPriceHistory(initialHistory);
    setCurrentPrice(price);
  }, []);

  useEffect(() => {
    const tickInterval = 250; // Update every 250ms for smooth action
    tickRef.current = setInterval(() => {
      if (gameState === "resolved") return; // Freeze chart on resolve

      setCurrentPrice((prevPrice) => {
        // Volatility is higher when game is active
        const volatility = gameState === "active" ? 250 : 80;
        const change = (Math.random() - 0.5) * volatility;
        
        // Add random spikes
        const isSpike = Math.random() > 0.95;
        const spikeAmount = isSpike ? (Math.random() - 0.5) * volatility * 3 : 0;
        
        const newPrice = prevPrice + change + spikeAmount;

        // Trigger screen shake on massive spikes if active
        if (gameState === "active" && Math.abs(change + spikeAmount) > volatility * 1.5) {
          setShake(true);
          setTimeout(() => setShake(false), 300);
        }

        setPriceHistory((prev) => {
          const newHistory = [...prev.slice(1), { x: prev[prev.length - 1].x + 1, y: newPrice }];
          return newHistory;
        });

        // Update unrealized PNL visual multiplier
        if (gameState === "active" && entryPrice && prediction) {
          const diff = newPrice - entryPrice;
          let rawMult = 1.0;
          if (prediction === "LONG") {
            rawMult = 1.0 + (diff / entryPrice) * 100; // arbitrary multiplier calc for visuals
          } else {
            rawMult = 1.0 - (diff / entryPrice) * 100;
          }
          setPnlMultiplier(Math.max(0.01, rawMult));
        }

        return newPrice;
      });
    }, tickInterval);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [gameState, entryPrice, prediction]);

  // --- Countdown Timer ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === "active" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (gameState === "active" && timeLeft === 0) {
      resolveTrade();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleQuickSelect = (percent: string) => {
    const total = parseFloat(balances.wager);
    if (isNaN(total) || total <= 0) return;
    if (percent === "MAX") {
      setWager(total.toString());
    } else {
      const p = parseInt(percent) / 100;
      setWager((total * p).toFixed(2));
    }
  };

  const placeTrade = async (dir: "LONG" | "SHORT") => {
    if (!wager || parseFloat(wager) <= 0) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    setIsProcessing(true);
    setTxError(null);
    setPrediction(dir);

    try {
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);
      
      const tx = new TransferTransaction()
        .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
        .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
        .setTransactionMemo(`Trend Rider ${dir} Entry`);

      const res = await executeTransaction(tx);
      if (!res) throw new Error("Transaction rejected");

      // Transaction Success - Start Game
      setEntryPrice(currentPrice);
      setGameState("active");
      setTimeLeft(10);
    } catch (err: any) {
      const msg = err?.message || "Transaction failed. Check your wallet.";
      setTxError(msg);
      setPrediction(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveTrade = () => {
    setGameState("resolved");
    const isWin =
      (prediction === "LONG" && currentPrice > entryPrice!) ||
      (prediction === "SHORT" && currentPrice < entryPrice!);

    setWinStatus(isWin ? "WIN" : "LOSS");

    if (isWin) {
      const winAmount = (parseFloat(wager) * 1.95).toFixed(2);
      
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#00ffff", "#ccff00", "#ffffff"]
      });

      // Execute Payout via Backend
      fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accountId, 
          winAmount,
          wagerAmount: wager,
          direction: 'GAME_WIN'
        })
      }).catch(err => console.error("Payout API error:", err));
    }

    // Reset after 4 seconds
    setTimeout(() => {
      setGameState("idle");
      setWinStatus(null);
      setEntryPrice(null);
      setPrediction(null);
      setTimeLeft(10);
      setPnlMultiplier(1.0);
    }, 4000);
  };

  // --- SVG Chart Calculations ---
  const chartWidth = 800;
  const chartHeight = 300;
  
  const minPrice = Math.min(...priceHistory.map((p) => p.y)) - 200;
  const maxPrice = Math.max(...priceHistory.map((p) => p.y)) + 200;
  const priceRange = maxPrice - minPrice;

  const minX = priceHistory[0]?.x || 0;
  const maxX = priceHistory[priceHistory.length - 1]?.x || 40;
  const xRange = maxX - minX;

  const getSvgCoordinates = (x: number, y: number) => {
    const svgX = ((x - minX) / xRange) * chartWidth;
    const svgY = chartHeight - ((y - minPrice) / priceRange) * chartHeight;
    return { svgX, svgY };
  };

  const pathD = priceHistory
    .map((p, i) => {
      const { svgX, svgY } = getSvgCoordinates(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${svgX} ${svgY}`;
    })
    .join(" ");

  const entryY = entryPrice ? getSvgCoordinates(0, entryPrice).svgY : null;
  const isCurrentlyWinning = prediction === "LONG" ? currentPrice > (entryPrice || 0) : currentPrice < (entryPrice || 0);
  const pulseColor = isCurrentlyWinning ? "rgba(0, 255, 255, 0.2)" : "rgba(255, 0, 0, 0.2)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={`relative w-full max-w-6xl h-[85vh] flex flex-col md:flex-row bg-wager-charcoal/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 ${shake ? "animate-shake" : ""}`}
      style={{ boxShadow: gameState === "active" ? `inset 0 0 50px ${pulseColor}` : "" }}
    >
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 z-50 p-3 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/50 hover:text-white"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Chart Pane */}
      <div className="flex-1 relative p-10 flex flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0 neon-grid opacity-30 z-0"></div>
        
        {/* Price Display */}
        <div className="absolute top-10 right-10 z-20 text-right">
          <div className="text-zinc-500 font-mono text-sm tracking-widest uppercase mb-1">Live Asset Index</div>
          <div className={`text-5xl font-black font-mono transition-colors duration-200 ${gameState === 'active' ? (isCurrentlyWinning ? 'text-wager-cyan' : 'text-wager-red') : 'text-white'}`}>
            ${currentPrice.toFixed(2)}
          </div>
        </div>

        {/* Dynamic Multiplier */}
        {gameState === "active" && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mb-1">Unrealized PNL</span>
            <span className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${isCurrentlyWinning ? 'from-wager-cyan to-wager-lime' : 'from-red-500 to-orange-500'}`}>
              {pnlMultiplier.toFixed(2)}x
            </span>
            <div className="mt-2 text-2xl font-black text-white/80">
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
        )}

        {/* Resolution Text */}
        <AnimatePresence>
          {gameState === "resolved" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              {winStatus === "WIN" ? (
                <div className="text-center">
                  <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-wager-cyan to-wager-lime text-shadow-neon tracking-tighter uppercase italic">
                    Profit
                  </h2>
                  <p className="text-2xl text-white font-mono mt-4">+{(parseFloat(wager) * 1.95).toFixed(2)} $WAGER</p>
                </div>
              ) : (
                <div className="text-center">
                  <h2 className="text-8xl font-black text-red-500 animate-glitch tracking-tighter uppercase italic" style={{ textShadow: "0 0 20px rgba(255,0,0,0.8)" }}>
                    Liquidated
                  </h2>
                  <p className="text-2xl text-red-400 font-mono mt-4">-{wager} $WAGER</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom SVG Chart */}
        <div className="w-full h-[300px] relative z-10">
          <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
            {/* Entry Line */}
            {entryY !== null && (
              <line 
                x1="0" 
                y1={entryY} 
                x2={chartWidth} 
                y2={entryY} 
                stroke={prediction === "LONG" ? "#00ffff" : "#ff0000"} 
                strokeWidth="2" 
                strokeDasharray="10 5" 
                className="opacity-70 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]"
              />
            )}
            
            {/* Price Path */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] transition-all duration-200"
            />
            
            {/* Current Price Dot */}
            {priceHistory.length > 0 && (
              <circle 
                cx={getSvgCoordinates(priceHistory[priceHistory.length - 1].x, priceHistory[priceHistory.length - 1].y).svgX} 
                cy={getSvgCoordinates(priceHistory[priceHistory.length - 1].x, priceHistory[priceHistory.length - 1].y).svgY} 
                r="6" 
                fill="#ffffff" 
                className="drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              />
            )}

            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                <stop offset="100%" stopColor="rgba(255,255,255,1)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Control Pane */}
      <div className="w-full md:w-96 bg-wager-black/70 border-l border-white/5 p-8 flex flex-col justify-between relative z-50">
        <div>
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-wager-cyan rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.3)]">
              <TrendingUp className="text-black" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">Trend Rider</h3>
              <span className="text-[10px] text-wager-cyan font-bold uppercase tracking-tighter">Prediction Engine</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 bg-gradient-to-br from-wager-black to-zinc-900 border border-white/10 rounded-2xl shadow-inner">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Payout Multiplier</span>
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black text-white leading-none">1.95<span className="text-wager-cyan text-xl">x</span></span>
                <span className="text-[10px] text-wager-cyan font-mono bg-wager-cyan/10 px-2 py-0.5 rounded">Fixed</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1 flex justify-between">
                <span>Stake Amount</span>
                {parseFloat(wager) > 0 && <span className="text-wager-lime">PAYOUT: {(parseFloat(wager) * 1.95).toFixed(2)}</span>}
              </label>
              <div className="w-full bg-wager-black border border-white/10 rounded-2xl p-4 flex items-center focus-within:border-wager-cyan transition-all shadow-lg">
                <Coins className="text-wager-cyan mr-3" size={20} />
                <input
                  type="number"
                  placeholder="0.00"
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                  disabled={gameState !== "idle" || isProcessing}
                  className="bg-transparent text-2xl font-mono text-white outline-none w-full placeholder:text-zinc-800 disabled:opacity-50"
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
                      disabled={gameState !== "idle" || isProcessing}
                      className="px-2 py-1 bg-wager-black border border-white/5 rounded-md text-[9px] font-bold text-zinc-500 hover:text-wager-cyan hover:border-wager-cyan/30 transition-all disabled:opacity-50"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col gap-4">
          <button
            onClick={() => placeTrade("LONG")}
            disabled={gameState !== "idle" || isProcessing || !wager || parseFloat(wager) <= 0}
            className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all shadow-xl bg-wager-cyan/20 text-wager-cyan border border-wager-cyan/50 hover:bg-wager-cyan hover:text-black hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing && prediction === "LONG" ? <Loader2 className="animate-spin" size={20} /> : <TrendingUp size={20} />}
            LONG (UP)
          </button>
          <button
            onClick={() => placeTrade("SHORT")}
            disabled={gameState !== "idle" || isProcessing || !wager || parseFloat(wager) <= 0}
            className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all shadow-xl bg-wager-red/20 text-wager-red border border-wager-red/50 hover:bg-wager-red hover:text-white hover:shadow-[0_0_30px_rgba(255,0,0,0.6)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing && prediction === "SHORT" ? <Loader2 className="animate-spin" size={20} /> : <TrendingDown size={20} />}
            SHORT (DOWN)
          </button>
          
          {txError && (
            <div className="mt-2 p-3 bg-red-950/60 border border-red-500/40 rounded-xl">
              <p className="text-[10px] text-red-400 font-mono text-center leading-snug">{txError}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
