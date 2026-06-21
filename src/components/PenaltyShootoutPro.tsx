"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, XCircle, Coins, Loader2, Footprints, Target, Info, ArrowLeft, HelpCircle } from "lucide-react";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { EVM_WAGER_TOKEN_ADDRESS, EVM_TREASURY_ADDRESS } from "@/evm";
import { MOCK_WAGER_GAMES_ADDRESS, WAGER_GAMES_ABI, WAGER_GAMES_HEDERA_ID } from "@/evm-contracts";
import { TransferTransaction, ContractExecuteTransaction, ContractFunctionParameters, AccountId, TokenId, ContractId } from "@hashgraph/sdk";
import { ethers } from "ethers";
import confetti from "canvas-confetti";

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

export default function PenaltyShootoutPro({ onClose }: { onClose: () => void }) {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [wager, setWager] = useState<string>("50");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedZones, setSelectedZones] = useState<number[]>([]);
  const [keeperZones, setKeeperZones] = useState<number[]>([]);
  const [lastWinAmount, setLastWinAmount] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [winPulse, setWinPulse] = useState(false);

  const { isConnected, accountId, walletType, balances, connect, executeTransaction, executeEVMSmartContract, refreshBalances, addWagerPoints } = useWagerWallet();

  // ── Auto-reset after GOAL or SAVED ─────────────────────────────────────────
  useEffect(() => {
    if (gameState === "goal" || gameState === "saved") {
      const timer = setTimeout(() => {
        setGameState("setup");
        setSelectedZones([]);
        setKeeperZones([]);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

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

  const toggleZone = (id: number) => {
    if (gameState !== "setup") return;
    if (selectedZones.includes(id)) {
      setSelectedZones(selectedZones.filter(z => z !== id));
    } else {
      setSelectedZones([...selectedZones, id]);
    }
  };

  const takeShot = async () => {
    if (!wager || parseFloat(wager) <= 0 || selectedZones.length < 2) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    setIsProcessing(true);
    setTxError(null);
    setGameState("kicking");

    try {
      // 1. Randomly select 2 dive zones for the keeper
      const zones = [0, 1, 2, 3, 4, 5];
      const dives: number[] = [];
      while (dives.length < 2) {
        const rand = zones[Math.floor(Math.random() * zones.length)];
        if (!dives.includes(rand)) dives.push(rand);
      }
      setKeeperZones(dives);

      // Evaluate shot: Win if NONE of the selected zones are in the keeper zones
      const isLoss = selectedZones.some(z => dives.includes(z));
      const winAmount = (parseFloat(wager) * 2.0).toFixed(2);
      const amountInTokens = Math.floor(parseFloat(wager) * 1e8);
      
      let txId = null;

      // 1. Execute Smart Contract Game Call
      if (walletType === "METAMASK") {
        const res = await executeEVMSmartContract(
          MOCK_WAGER_GAMES_ADDRESS,
          WAGER_GAMES_ABI,
          "playPenalty",
          [amountInTokens.toString()]
        );
        if (res?.status !== "SUCCESS") throw new Error("MetaMask contract call failed.");
        txId = res.txId;
      } else {
        const memo = isLoss ? "Penalty Pro Loss" : "Penalty Pro Win - Verifying...";
        
        // HashPack Smart Contract Call via Raw ABI Encoding
        const iface = new ethers.Interface(WAGER_GAMES_ABI);
        const encoded = iface.encodeFunctionData("playPenalty", [amountInTokens.toString()]);
        const rawParams = ethers.getBytes(encoded);

        const tx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromString(WAGER_GAMES_HEDERA_ID))
          .setGas(5000000)
          .setFunctionParameters(rawParams)
          .setTransactionMemo(memo);
          
        console.log("[PenaltyPro] Executing V3 Game with 5M gas...");
        const res = await executeTransaction(tx);
        if (res?.status !== "SUCCESS") throw new Error("HashPack contract call failed.");
        txId = res.txId;
      }

      if (isLoss) {
        setIsProcessing(false);
        setGameState("saved");
      } else {
        // Player Won -> 2.0x Multiplier
        setLastWinAmount(winAmount);

        setIsProcessing(false);
        setGameState("goal");
        setWinPulse(true);
        setTimeout(() => setWinPulse(false), 2000);

        // Payout (non-blocking, don't await)
        fetch("/api/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            accountId, 
            winAmount,
            wagerAmount: wager,
            direction: 'GAME_WIN'
          })
        })
        .then(async (payoutRes) => {
          if (!payoutRes.ok) console.error("Payout failed:", await payoutRes.text());
        })
        .catch(err => console.error("Payout API error:", err));
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ccff00', '#00ffff', '#ffffff']
        });
      }
      
      const wagerAmount = parseFloat(wager);
      if (wagerAmount >= 10.00) {
        addWagerPoints(800);
        console.log("🎮 Valid Qualifying Wager: Awarded 800 WagerPoints.");
      } else {
        console.log("🎮 Micro-Bet Detected (< 10 $WAGER): Awarded 0 WagerPoints.");
      }

      [2000, 4000, 6000].forEach(delay => setTimeout(() => refreshBalances(), delay));
    } catch (err: any) {
      const msg = err?.message || "Transaction failed. Check your wallet.";
      console.error("[PenaltyShootoutPro] Error:", err);
      // Always reset to setup so the player can try again
      setGameState("setup");
      setSelectedZones([]);
      setKeeperZones([]);
      setTxError(msg);
    } finally {
      setIsProcessing(false);
    }
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
          onClick={() => { onClose(); window.location.hash = "penalty-shootout"; }}
          className="flex items-center gap-2 px-4 py-2 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/70 hover:text-white text-sm font-bold uppercase tracking-wider"
        >
          <HelpCircle size={16} />
          How to Play
        </button>
      </div>

      {/* Left Pane: Pro Controls */}
      <div className="w-80 bg-wager-black/70 border-r border-white/5 p-8 flex flex-col justify-between relative z-50">
        <div>
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-wager-lime rounded-2xl shadow-[0_0_20px_rgba(204,255,0,0.3)]">
              <Footprints className="text-black" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">Penalty</h3>
              <span className="text-[10px] text-wager-lime font-bold uppercase tracking-tighter">Pro Edition</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 bg-gradient-to-br from-wager-black to-zinc-900 border border-white/10 rounded-2xl shadow-inner">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Win Multiplier</span>
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black text-white leading-none">2.0<span className="text-wager-cyan text-xl">x</span></span>
                <span className="text-[10px] text-wager-cyan font-mono bg-wager-cyan/10 px-2 py-0.5 rounded">40% Win Rate</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-1 flex justify-between">
                <span>$WAGER Stake</span>
                {parseFloat(wager) > 0 && <span className="text-wager-lime">PAYOUT: {(parseFloat(wager) * 2).toFixed(2)}</span>}
              </label>
              <div className="w-full bg-wager-black border border-white/10 rounded-2xl p-4 flex items-center focus-within:border-wager-lime transition-all shadow-lg">
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-zinc-600 font-black uppercase">Bal:</span>
                  <span className="text-[10px] font-mono text-wager-lime font-bold">{balances.wager}</span>
                </div>
                <div className="flex gap-1">
                  {["25", "50", "75", "MAX"].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleQuickSelect(p)}
                      disabled={gameState !== "setup"}
                      className="px-2 py-1 bg-wager-black border border-white/5 rounded-md text-[9px] font-bold text-zinc-500 hover:text-wager-lime hover:border-wager-lime/30 transition-all"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              {/* Minimum Wager Warning */}
              {parseFloat(wager) < 10 && (
                <div className="text-[9px] text-orange-500 font-bold uppercase tracking-widest px-1 flex items-center gap-1 mt-1">
                  <Footprints size={10} />
                  Bet is under 10 $WAGER. 0 Points will be awarded.
                </div>
              )}
            </div>
            
            <div className="pt-4">
              <button
                onClick={takeShot}
                disabled={gameState !== "setup" || selectedZones.length < 2 || !wager || parseFloat(wager) <= 0 || isProcessing}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all shadow-xl flex items-center justify-center gap-3
                  ${isProcessing
                    ? "bg-amber-950/60 text-amber-400 cursor-not-allowed border border-amber-500/30 animate-pulse"
                    : (selectedZones.length < 2 || !wager)
                    ? "bg-wager-charcoal text-zinc-600 cursor-not-allowed border border-white/5"
                    : "bg-wager-lime text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(204,255,0,0.4)] hover:shadow-[0_0_50px_rgba(204,255,0,0.6)]"
                  }`}
              >
                {isProcessing
                  ? <><Loader2 className="animate-spin" size={20} /> Awaiting Wallet...</>
                  : "Take Shot"
                }
              </button>
              {selectedZones.length < 2 && gameState === "setup" && (
                <p className="text-[9px] text-center text-wager-cyan uppercase font-bold mt-3 animate-pulse">Select at least 2 target zones</p>
              )}
              {txError && (
                <div className="mt-3 p-3 bg-red-950/60 border border-red-500/40 rounded-xl">
                  <p className="text-[10px] text-red-400 font-mono text-center leading-snug">{txError}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 flex gap-3">
            <Info size={16} className="text-wager-cyan shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
              Pick 2+ zones. If the keeper dives to <span className="text-wager-red font-bold">ANY</span> of your selected zones, the shot is saved!
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-4 text-xs font-black text-zinc-600 hover:text-white tracking-widest transition-colors border border-transparent hover:border-white/10 rounded-2xl"
          >
            EXIT STADIUM
          </button>
        </div>
      </div>

      {/* Right Pane: Pro Pitch & Stadium */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-[radial-gradient(circle_at_bottom,_#222_0%,_#050505_100%)] overflow-hidden">
        {/* Pitch markings */}
        <div className="absolute bottom-0 w-full h-[30%] bg-zinc-900/30 border-t-4 border-white/10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-full border-x-4 border-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/20 rounded-full" />
        </div>

        <div className="mb-12 text-center z-20">
          <AnimatePresence mode="wait">
            {gameState === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h2 className="text-5xl font-black text-white uppercase tracking-[0.3em] italic drop-shadow-2xl">
                  Match Point
                </h2>
                <div className="flex justify-center gap-2 mt-4">
                  {selectedZones.map(id => (
                    <span key={id} className="w-2 h-2 rounded-full bg-wager-lime animate-pulse" />
                  ))}
                </div>
              </motion.div>
            )}
            {gameState === "goal" && (
              <motion.div key="goal" initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} className="relative">
                <h2 className="text-8xl font-black text-wager-lime uppercase tracking-widest drop-shadow-[0_0_40px_rgba(204,255,0,0.8)] italic">
                  GOAL!!!
                </h2>
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-wager-cyan font-mono font-bold mt-2 text-2xl tracking-widest">
                  + {lastWinAmount} $WAGER
                </motion.div>
              </motion.div>
            )}
            {gameState === "saved" && (
              <motion.div key="saved" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <h2 className="text-8xl font-black text-wager-red uppercase tracking-widest drop-shadow-[0_0_40px_rgba(255,0,0,0.6)] italic">
                  SAVED!
                </h2>
                <p className="text-zinc-500 font-bold tracking-widest mt-2 uppercase">Better luck next time, rookie.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Professional Goal */}
        <div className="relative w-full max-w-5xl aspect-[2.4/1] z-10">
          {/* Goal Frame */}
          <div className="absolute inset-0 border-[10px] border-zinc-100 rounded-t-2xl shadow-[0_0_60px_rgba(255,255,255,0.15)] z-40 pointer-events-none">
            <div className="absolute -bottom-10 -left-[10px] w-8 h-20 bg-zinc-200 rounded-b-lg" />
            <div className="absolute -bottom-10 -right-[10px] w-8 h-20 bg-zinc-200 rounded-b-lg" />
          </div>

          {/* Goal Net */}
          <div className="absolute inset-0 bg-white/5 overflow-hidden rounded-t-xl">
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#fff 2px, transparent 2px), linear-gradient(90deg, #fff 2px, transparent 2px)", backgroundSize: "25px 25px" }} />
             
             {/* The Keeper Figure */}
             <motion.div 
               animate={
                 gameState === "kicking" ? { 
                   x: keeperZones[0] === 0 || keeperZones[0] === 3 ? -150 : keeperZones[0] === 2 || keeperZones[0] === 5 ? 150 : 0,
                   y: keeperZones[0] < 3 ? -50 : 50,
                   rotate: keeperZones[0] === 0 || keeperZones[0] === 3 ? -30 : keeperZones[0] === 2 || keeperZones[0] === 5 ? 30 : 0,
                   scale: 1.1
                 } : 
                 gameState === "saved" || gameState === "goal" ? {
                   x: keeperZones[0] === 0 || keeperZones[0] === 3 ? -250 : keeperZones[0] === 2 || keeperZones[0] === 5 ? 250 : 0,
                   y: keeperZones[0] < 3 ? -80 : 80,
                   rotate: keeperZones[0] === 0 || keeperZones[0] === 3 ? -90 : keeperZones[0] === 2 || keeperZones[0] === 5 ? 90 : 0,
                   opacity: 0.8
                 } : 
                 { x: 0, y: 0, rotate: 0, scale: 1 }
               }
               className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-56 flex flex-col items-center z-30 transition-all duration-700"
             >
                {/* Keeper Body */}
                <div className="w-16 h-16 bg-wager-cyan rounded-full border-4 border-zinc-900 shadow-xl" />
                <div className="w-24 h-32 bg-zinc-100 rounded-t-3xl border-x-4 border-t-4 border-zinc-900 relative">
                   <div className="absolute -left-8 top-0 w-8 h-24 bg-zinc-200 rounded-full origin-top rotate-12" />
                   <div className="absolute -right-8 top-0 w-8 h-24 bg-zinc-200 rounded-full origin-top -rotate-12" />
                </div>
                <div className="flex gap-4">
                   <div className="w-8 h-20 bg-zinc-800 rounded-b-xl" />
                   <div className="w-8 h-20 bg-zinc-800 rounded-b-xl" />
                </div>
             </motion.div>
          </div>

          {/* Interactive Zone Grid */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-3 p-4 z-50">
            {ZONES.map((zone) => {
              const isSelected = selectedZones.includes(zone.id);
              const isKeeperZone = keeperZones.includes(zone.id);
              const isOverlapped = isSelected && isKeeperZone;
              
              return (
                <button
                  key={zone.id}
                  onClick={() => toggleZone(zone.id)}
                  disabled={gameState !== "setup"}
                  className={`relative group rounded-xl transition-all duration-500 border-2 overflow-hidden
                    ${gameState === "setup" 
                      ? isSelected 
                        ? "bg-wager-lime/20 border-wager-lime shadow-[0_0_25px_rgba(204,255,0,0.3)] scale-[1.02] z-10" 
                        : "bg-transparent border-white/5 hover:border-white/20 hover:bg-white/5" 
                      : "border-transparent"}
                  `}
                >
                  <AnimatePresence>
                   {/* Goal → all selected zones glow green */}
                   {gameState === "goal" && isSelected && (
                     <motion.div
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-green-500/50 shadow-[inset_0_0_30px_rgba(34,197,94,0.8)] flex items-center justify-center"
                     >
                       <Target size={48} className="text-white drop-shadow-lg" />
                     </motion.div>
                   )}
                   {/* Saved → blocked (overlapped) zones flash red, other selected zones dim */}
                   {gameState === "saved" && isOverlapped && (
                     <motion.div
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-red-500/70 animate-pulse shadow-[inset_0_0_30px_rgba(239,68,68,1)] flex items-center justify-center"
                     >
                       <XCircle size={64} className="text-white drop-shadow-xl" />
                     </motion.div>
                   )}
                   {/* Saved → non-blocked selected zones still show (dimmed) */}
                   {gameState === "saved" && isSelected && !isOverlapped && (
                     <motion.div
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-wager-lime/20 flex items-center justify-center"
                     />
                   )}
                    {isKeeperZone && (gameState === "goal" || gameState === "saved") && !isSelected && (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 0.3 }}
                        className="absolute inset-0 bg-wager-red/40 flex items-center justify-center"
                      >
                         <Footprints size={40} className="text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <span className={`absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest transition-colors
                    ${isSelected ? "text-wager-lime" : "text-zinc-700 group-hover:text-zinc-500"}
                  `}>
                    {zone.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The Ball */}
        <div className="mt-12 relative z-50">
          <motion.div
            animate={
              gameState === "setup" ? { y: [0, -4, 0], scale: 1 } :
              gameState === "kicking" ? { 
                scale: [1, 0.4, 0.15], 
                y: -300, 
                x: selectedZones[0] === 0 || selectedZones[0] === 3 ? -200 : selectedZones[0] === 2 || selectedZones[0] === 5 ? 200 : 0,
                rotate: 720,
                opacity: [1, 1, 0] 
              } :
              { opacity: 0, scale: 0 }
            }
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-20 h-20 bg-white rounded-full shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex items-center justify-center border-4 border-zinc-300 relative overflow-hidden"
          >
             {/* Soccer Ball Pattern */}
             <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#000 3px, transparent 0)", backgroundSize: "15px 15px" }} />
             <div className="w-10 h-10 border-2 border-zinc-900/10 rounded-full" />
          </motion.div>
          {gameState === "setup" && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/40 blur-md rounded-full" />
          )}
        </div>

        {/* Action Button - Replay */}
        <AnimatePresence>
          {(gameState === "goal" || gameState === "saved") && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
              className="mt-12 z-[60]"
            >
              <button
                onClick={() => {
                  setGameState("setup");
                  setSelectedZones([]);
                  setKeeperZones([]);
                }}
                className="bg-white text-black font-black uppercase tracking-[0.2em] px-16 py-6 rounded-2xl hover:bg-wager-lime hover:scale-105 active:scale-95 transition-all text-2xl shadow-2xl"
              >
                Back to the Spot
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
