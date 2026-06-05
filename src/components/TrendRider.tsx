"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Coins, Loader2, ArrowLeft, Target, ShieldAlert, HelpCircle } from "lucide-react";
import { useWalletContext } from "../context/WalletContext";
import { TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import confetti from "canvas-confetti";

const TREASURY_ACCOUNT_ID = AccountId.fromString((process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim());
const WAGER_TOKEN_ID = TokenId.fromString((process.env.NEXT_PUBLIC_WAGER_TOKEN_ID || "0.0.8818191").trim());

const LEVERAGE = 500; // 500x synthetic leverage for highly dynamic payouts

interface Candle {
  id: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function TrendRider({ onBack }: { onBack: () => void }) {
  const { isConnected, accountId, balances, executeTransaction, connect } = useWalletContext();

  // Core Game State
  const [gameState, setGameState] = useState<"idle" | "active" | "resolved">("idle");
  const [wager, setWager] = useState("10");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [prediction, setPrediction] = useState<"LONG" | "SHORT" | null>(null);
  const [timeLeft, setTimeLeft] = useState(5); // EXACTLY 5 SECONDS
  const [isProcessing, setIsProcessing] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Price & Candlestick State
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [candleHistory, setCandleHistory] = useState<Candle[]>([]);
  const [pastResults, setPastResults] = useState<number[]>([]);
  
  // Visual Effects State
  const [shake, setShake] = useState(false);
  const [pnlMultiplier, setPnlMultiplier] = useState(1.0);
  const [winStatus, setWinStatus] = useState<"WIN" | "LOSS" | "LIQUIDATED" | null>(null);
  const [finalPayout, setFinalPayout] = useState(0);

  // Suspense Curve State
  const [isChartFrozen, setIsChartFrozen] = useState(false);
  const [tensionState, setTensionState] = useState<"NONE" | "DANGER" | "PROFIT">("NONE");

  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const candleRef = useRef<NodeJS.Timeout | null>(null);

  // --- Candlestick Simulation Engine ---
  useEffect(() => {
    let price = 50000;
    const initialCandles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      const open = price;
      const close = price + (Math.random() - 0.5) * 100;
      const high = Math.max(open, close) + Math.random() * 50;
      const low = Math.min(open, close) - Math.random() * 50;
      initialCandles.push({ id: i, open, high, low, close });
      price = close;
    }
    setCandleHistory(initialCandles);
    setCurrentPrice(price);
  }, []);

  useEffect(() => {
    if (gameState === "resolved" || isChartFrozen) return;

    // Phase 1 (Secs 5-3): Extreme Volatility. Phase 2 (Secs 2-0): Heartbeat Drop
    const isPhase1 = timeLeft > 2;
    const tickInterval = gameState === "active" ? (isPhase1 ? 50 : 300) : 50;

    tickRef.current = setInterval(() => {
      setCurrentPrice((prevPrice) => {
        const volatility = gameState === "active" ? (isPhase1 ? 150 : 60) : 30; // Massive volatility vs heavy thumps
        const change = (Math.random() - 0.5) * volatility;
        
        // Massive random spikes
        const isSpike = Math.random() > 0.98;
        const spikeAmount = isSpike ? (Math.random() - 0.5) * volatility * 4 : 0;
        
        const newPrice = prevPrice + change + spikeAmount;

        // Proximity Tension Effects
        if (gameState === "active" && entryPrice) {
          let dangerDist = Infinity;
          let profitDist = Infinity;

          if (stopLoss) {
            dangerDist = Math.abs(newPrice - parseFloat(stopLoss));
            if (dangerDist < Math.abs(entryPrice - parseFloat(stopLoss)) * 0.15) {
              setTensionState("DANGER");
              setShake(true);
              setTimeout(() => setShake(false), 200);
            }
          }
          if (takeProfit) {
            profitDist = Math.abs(newPrice - parseFloat(takeProfit));
            if (profitDist < Math.abs(entryPrice - parseFloat(takeProfit)) * 0.15) {
              setTensionState("PROFIT");
            }
          }
          
          if (dangerDist >= Math.abs(entryPrice - (parseFloat(stopLoss)||0)) * 0.15 && profitDist >= Math.abs(entryPrice - (parseFloat(takeProfit)||0)) * 0.15) {
             setTensionState("NONE");
          }
        } else if (gameState === "active" && Math.abs(change + spikeAmount) > volatility * 2) {
          setShake(true);
          setTimeout(() => setShake(false), 200);
        }

        // Update the current candle dynamically
        setCandleHistory((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            close: newPrice,
            high: Math.max(last.high, newPrice),
            low: Math.min(last.low, newPrice)
          };
          return updated;
        });

        // --- Core Game Logic Evaluation ---
        if (gameState === "active" && entryPrice && prediction) {
          // Calculate Dynamic Multiplier
          let rawMult = 1.0;
          if (prediction === "LONG") {
            rawMult = 1.0 + ((newPrice - entryPrice) / entryPrice) * LEVERAGE;
          } else {
            rawMult = 1.0 + ((entryPrice - newPrice) / entryPrice) * LEVERAGE;
          }
          
          setPnlMultiplier(Math.max(0, rawMult));

          // 1. Auto-Liquidate if multiplier hits 0 or below
          if (rawMult <= 0) {
            resolveTrade("LIQUIDATED", newPrice, 0);
            return newPrice;
          }

          // 2. TP / SL Collision Logic
          if (takeProfit) {
            const tpVal = parseFloat(takeProfit);
            if ((prediction === "LONG" && newPrice >= tpVal) || (prediction === "SHORT" && newPrice <= tpVal)) {
              resolveTrade("WIN", newPrice, rawMult);
              return newPrice;
            }
          }

          if (stopLoss) {
            const slVal = parseFloat(stopLoss);
            if ((prediction === "LONG" && newPrice <= slVal) || (prediction === "SHORT" && newPrice >= slVal)) {
              resolveTrade("LOSS", newPrice, rawMult);
              return newPrice;
            }
          }
        }

        return newPrice;
      });
    }, tickInterval);

    // Candle Push Engine
    const candleInterval = gameState === "active" ? (isPhase1 ? 250 : 1200) : 1000;
    candleRef.current = setInterval(() => {
      setCandleHistory((prev) => {
        const last = prev[prev.length - 1];
        const newCandle = {
          id: last.id + 1,
          open: last.close,
          high: last.close,
          low: last.close,
          close: last.close
        };
        // Keep array size manageable
        return [...prev.slice(-60), newCandle];
      });
    }, candleInterval);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (candleRef.current) clearInterval(candleRef.current);
    };
  }, [gameState, isChartFrozen, timeLeft, entryPrice, prediction, takeProfit, stopLoss]);

  // --- Countdown Timer ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === "active" && !isChartFrozen && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (gameState === "active" && !isChartFrozen && timeLeft <= 0) {
      // 5 Seconds Expired - Resolve based on current position
      setIsChartFrozen(true);
      const finalMult = pnlMultiplier;
      if (finalMult > 1) {
        resolveTrade("WIN", currentPrice, finalMult);
      } else {
        resolveTrade("LOSS", currentPrice, finalMult);
      }
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isChartFrozen, pnlMultiplier, currentPrice]);

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

    // Freeze chart immediately and set entry price so blue line appears!
    setEntryPrice(currentPrice);
    setIsChartFrozen(true);

    try {
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);
      
      const tx = new TransferTransaction()
        .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
        .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ACCOUNT_ID, amountInTokens)
        .setTransactionMemo(`Trend Rider ${dir} Entry`);

      const res = await executeTransaction(tx);
      if (!res) throw new Error("Transaction rejected");

      // Transaction Success - Start Game immediately
      setGameState("active");
      setTimeLeft(5); // Exactly 5 seconds
      setPnlMultiplier(1.0);
      setIsChartFrozen(false);
    } catch (err: any) {
      const msg = err?.message || "Transaction failed. Check your wallet.";
      setTxError(msg);
      setPrediction(null);
      setEntryPrice(null);
      setIsChartFrozen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveTrade = (status: "WIN" | "LOSS" | "LIQUIDATED", resolvePrice: number, mult: number) => {
    setGameState("resolved");
    setWinStatus(status);
    
    // Update history
    setPastResults((prev) => [resolvePrice, ...prev].slice(0, 5));

    const finalReturn = parseFloat(wager) * mult;
    setFinalPayout(finalReturn);

    if (status === "WIN" && finalReturn > 0) {
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
          winAmount: finalReturn.toFixed(2),
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
      setTimeLeft(5);
      setPnlMultiplier(1.0);
      setIsChartFrozen(false);
      setTensionState("NONE");
    }, 4000);
  };

  // --- Candlestick SVG Chart Calculations ---
  const chartWidth = 800;
  const chartHeight = 300;
  
  // Dynamic Y-Axis scale based on visible candles + some padding
  const allHighs = candleHistory.map(c => c.high);
  const allLows = candleHistory.map(c => c.low);
  const minPrice = Math.min(...allLows, entryPrice || Infinity, parseFloat(stopLoss) || Infinity, parseFloat(takeProfit) || Infinity) - 100;
  const maxPrice = Math.max(...allHighs, entryPrice || -Infinity, parseFloat(stopLoss) || -Infinity, parseFloat(takeProfit) || -Infinity) + 100;
  const priceRange = maxPrice - minPrice;

  // X-Axis calculations
  const totalVisibleCandles = 60;
  const candleWidth = chartWidth / totalVisibleCandles;
  const xOffset = Math.max(0, candleHistory.length - totalVisibleCandles);
  const visibleCandles = candleHistory.slice(xOffset);

  const getSvgY = (y: number) => {
    return chartHeight - ((y - minPrice) / priceRange) * chartHeight;
  };

  const isCurrentlyWinning = prediction === "LONG" ? currentPrice > (entryPrice || 0) : currentPrice < (entryPrice || 0);
  const pulseColor = isCurrentlyWinning ? "rgba(0, 255, 255, 0.2)" : "rgba(255, 0, 0, 0.2)";

  let boxS = gameState === "active" ? `inset 0 0 50px ${pulseColor}` : "";
  if (tensionState === "DANGER") {
    boxS = `inset 0 0 150px rgba(255,0,0,0.8)`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={`relative w-full max-w-7xl h-[90vh] flex flex-col md:flex-row bg-wager-charcoal/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 ${shake ? "animate-shake" : ""}`}
      style={{ boxShadow: boxS, transition: "box-shadow 0.3s ease-in-out" }}
    >
      <div className="absolute top-6 left-6 z-50 flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/50 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <button
          onClick={() => { onBack(); window.location.hash = "trend-rider"; }}
          className="flex items-center gap-2 px-4 py-2 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/70 hover:text-white text-sm font-bold uppercase tracking-wider"
        >
          <HelpCircle size={16} />
          How to Play
        </button>
      </div>

      {/* Chart Pane */}
      <div className="flex-1 relative flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 neon-grid opacity-20 z-0"></div>
        
        {/* Top Info Bar */}
        <div className="relative z-20 flex justify-between items-start p-10">
          {/* Dynamic Multiplier */}
          {gameState === "active" && (
            <div className="flex flex-col items-start bg-black/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
              <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mb-1">Unrealized PNL</span>
              <span className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${isCurrentlyWinning ? 'from-wager-cyan to-wager-lime' : 'from-red-500 to-orange-500'}`}>
                {pnlMultiplier.toFixed(2)}x
              </span>
              <div className="mt-1 text-xl font-black text-white/60 font-mono flex items-center gap-2">
                <Loader2 className="animate-spin text-wager-cyan" size={16} />
                00:0{timeLeft}
              </div>
            </div>
          )}

          {/* Live Price Display */}
          <div className="text-right bg-black/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md ml-auto">
            <div className="text-zinc-500 font-mono text-sm tracking-widest uppercase mb-1">Live Asset Index</div>
            <div className={`text-4xl font-black font-mono transition-colors duration-200 ${gameState === 'active' ? (isCurrentlyWinning ? 'text-wager-cyan' : 'text-wager-red') : 'text-white'}`}>
              ${currentPrice.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Resolution Overlay */}
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
                  <p className="text-3xl text-white font-mono mt-4">Payout: {finalPayout.toFixed(2)} $WAGER</p>
                  <p className="text-wager-lime mt-2 font-black">{pnlMultiplier.toFixed(2)}x Multiplier</p>
                </div>
              ) : (
                <div className="text-center">
                  <h2 className="text-8xl font-black text-red-500 animate-glitch tracking-tighter uppercase italic" style={{ textShadow: "0 0 20px rgba(255,0,0,0.8)" }}>
                    {winStatus === "LIQUIDATED" ? "Liquidated" : "Stop Loss"}
                  </h2>
                  <p className="text-2xl text-red-400 font-mono mt-4">Returned: {finalPayout.toFixed(2)} $WAGER</p>
                  <p className="text-red-500/50 mt-2 font-black">{pnlMultiplier.toFixed(2)}x Multiplier</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Candlestick SVG Chart */}
        <div className="w-full flex-1 relative z-10 px-6">
          <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
            
            {/* Candlesticks */}
            {visibleCandles.map((c, i) => {
              const x = i * candleWidth + (candleWidth * 0.1);
              const isGreen = c.close >= c.open;
              const color = isGreen ? "#00ffff" : "#ff0000";
              const openY = getSvgY(c.open);
              const closeY = getSvgY(c.close);
              const highY = getSvgY(c.high);
              const lowY = getSvgY(c.low);

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(closeY - openY), 1); // min 1px height
              const isLast = i === visibleCandles.length - 1;
              const glow = isLast && tensionState === "PROFIT" 
                ? "drop-shadow-[0_0_20px_rgba(0,255,0,1)]" 
                : "drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]";

              return (
                <g key={c.id}>
                  {/* Wick */}
                  <line x1={center} y1={highY} x2={center} y2={lowY} stroke={color} strokeWidth="2" className="opacity-80" />
                  {/* Body */}
                  <rect 
                    x={x} 
                    y={bodyTop} 
                    width={candleWidth * 0.8} 
                    height={bodyHeight} 
                    fill={color} 
                    className={glow}
                  />
                </g>
              );
            })}

            {/* Target Lines */}
            {(gameState === "active" || isProcessing) && entryPrice !== null && (
              <>
                {/* Entry Price Line */}
                <line 
                  x1="0" y1={getSvgY(entryPrice)} x2={chartWidth} y2={getSvgY(entryPrice)} 
                  stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 5" 
                  className="opacity-80 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                />
                <text x="10" y={getSvgY(entryPrice) - 5} fill="#3b82f6" fontSize="12" className="font-mono font-bold">ENTRY: {entryPrice.toFixed(2)}</text>

                {/* Take Profit Line */}
                {takeProfit && (
                  <>
                    <line 
                      x1="0" y1={getSvgY(parseFloat(takeProfit))} x2={chartWidth} y2={getSvgY(parseFloat(takeProfit))} 
                      stroke="#00ff00" strokeWidth="2" 
                      className="opacity-70 drop-shadow-[0_0_8px_rgba(0,255,0,0.8)]"
                    />
                    <text x="10" y={getSvgY(parseFloat(takeProfit)) - 5} fill="#00ff00" fontSize="12" className="font-mono font-bold">TP: {takeProfit}</text>
                  </>
                )}

                {/* Stop Loss Line */}
                {stopLoss && (
                  <>
                    <line 
                      x1="0" y1={getSvgY(parseFloat(stopLoss))} x2={chartWidth} y2={getSvgY(parseFloat(stopLoss))} 
                      stroke="#ff0000" strokeWidth="2" 
                      className="opacity-70 drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]"
                    />
                    <text x="10" y={getSvgY(parseFloat(stopLoss)) - 5} fill="#ff0000" fontSize="12" className="font-mono font-bold">SL: {stopLoss}</text>
                  </>
                )}
              </>
            )}
          </svg>
        </div>

        {/* History Bar */}
        <div className="h-16 border-t border-white/5 bg-black/40 flex items-center px-10 gap-4 z-20">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">History:</span>
          {pastResults.length === 0 ? <span className="text-zinc-600 font-mono text-sm">No recent data</span> : null}
          {pastResults.map((res, i) => (
            <div key={i} className="px-3 py-1 bg-white/5 rounded text-white font-mono text-sm border border-white/5">
              ${res.toFixed(2)}
            </div>
          ))}
        </div>
      </div>

      {/* Control Pane */}
      <div className="w-full md:w-[400px] bg-wager-black/70 border-l border-white/5 p-8 flex flex-col justify-between relative z-50">
        <div className="overflow-y-auto pr-2 no-scrollbar">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-wager-cyan rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.3)]">
              <TrendingUp className="text-black" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">Trend Rider</h3>
              <span className="text-[10px] text-wager-cyan font-bold uppercase tracking-tighter">Candlestick Engine • 500x</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Wager Input */}
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1">Stake Amount ($WAGER)</label>
              <div className="w-full bg-wager-black border border-white/10 rounded-2xl p-4 flex items-center focus-within:border-wager-cyan transition-all shadow-lg">
                <Coins className="text-wager-cyan mr-3" size={20} />
                <input
                  type="number"
                  placeholder="0.00"
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                  disabled={gameState !== "idle" || isProcessing}
                  className="bg-transparent text-xl font-mono text-white outline-none w-full placeholder:text-zinc-800 disabled:opacity-50"
                />
              </div>
              <div className="flex justify-between px-1">
                <span className="text-[9px] text-zinc-600 font-black uppercase">Bal: <span className="text-wager-cyan">{balances.wager}</span></span>
                <div className="flex gap-1">
                  {["25", "50", "MAX"].map((p) => (
                    <button
                      key={p} onClick={() => handleQuickSelect(p)} disabled={gameState !== "idle" || isProcessing}
                      className="px-2 py-0.5 bg-wager-black border border-white/5 rounded text-[9px] font-bold text-zinc-500 hover:text-wager-cyan transition-all disabled:opacity-50"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>

            {/* Take Profit Input */}
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1 flex justify-between">
                <span className="flex items-center gap-1"><Target size={12} className="text-wager-lime" /> Take Profit (Optional)</span>
              </label>
              <div className="w-full bg-wager-black border border-wager-lime/20 rounded-xl p-3 flex items-center focus-within:border-wager-lime transition-all">
                <span className="text-wager-lime font-mono mr-2">$</span>
                <input
                  type="number"
                  placeholder="Absolute Price (e.g. 50500)"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  disabled={gameState !== "idle" || isProcessing}
                  className="bg-transparent text-lg font-mono text-white outline-none w-full placeholder:text-zinc-800 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Stop Loss Input */}
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1 flex justify-between">
                <span className="flex items-center gap-1"><ShieldAlert size={12} className="text-red-500" /> Stop Loss (Optional)</span>
              </label>
              <div className="w-full bg-wager-black border border-red-500/20 rounded-xl p-3 flex items-center focus-within:border-red-500 transition-all">
                <span className="text-red-500 font-mono mr-2">$</span>
                <input
                  type="number"
                  placeholder="Absolute Price (e.g. 49500)"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  disabled={gameState !== "idle" || isProcessing}
                  className="bg-transparent text-lg font-mono text-white outline-none w-full placeholder:text-zinc-800 disabled:opacity-50"
                />
              </div>
            </div>

          </div>
        </div>

        <div className="pt-6 flex flex-col gap-4 mt-auto">
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
