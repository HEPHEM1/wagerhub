"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Unlock, Link as LinkIcon, RefreshCw, AlertCircle, ArrowLeft, HelpCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { useWalletContext } from "../context/WalletContext";
import { EVM_WAGER_TOKEN_ADDRESS, EVM_TREASURY_ADDRESS } from "../evm";

type Move = "ROCK" | "PAPER" | "SCISSORS";

export default function RpsZeroTrust({ onClose }: { onClose: () => void }) {
  const { isConnected, accountId, balances, connect, executeEVMTransfer, refreshBalances, addWagerPoints } = useWalletContext();

  const [wager, setWager] = useState<string>("10");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  
  const [houseCommitment, setHouseCommitment] = useState<{ move: Move; salt: string; hash: string } | null>(null);
  const [playerMove, setPlayerMove] = useState<Move | null>(null);
  const [gameState, setGameState] = useState<"setup" | "revealed">("setup");
  const [gameResult, setGameResult] = useState<"win" | "loss" | "tie" | null>(null);

  // Generate House Commitment
  const generateCommitment = async () => {
    // 1. Strict Guard to prevent Next.js SSR crashes
    if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
      console.warn("[RpsZeroTrust] Skipping hash generation during server-side render.");
      return;
    }

    const moves: Move[] = ["ROCK", "PAPER", "SCISSORS"];
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    
    // 2. Client-side only secure random generation
    const saltArray = new Uint8Array(16);
    window.crypto.getRandomValues(saltArray);
    const saltHex = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 3. Web-Safe SHA-256 (No Node.js Buffer dependencies)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${randomMove}-${saltHex}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    setHouseCommitment({ move: randomMove, salt: saltHex, hash: hashHex });
    setGameState("setup");
    setGameResult(null);
    setPlayerMove(null);
    setTxError(null);
  };

  useEffect(() => {
    generateCommitment();
  }, []);

  const play = async (move: Move) => {
    if (!wager || parseFloat(wager) <= 0 || isProcessing || !houseCommitment) return;
    if (!isConnected || !accountId) {
      connect();
      return;
    }

    if (parseFloat(wager) > parseFloat(balances.wager)) {
      setTxError("Insufficient $WAGER balance.");
      return;
    }

    setPlayerMove(move);
    setIsProcessing(true);
    setTxError(null);

    try {
      const amountInTokens = BigInt(Math.floor(parseFloat(wager) * 1e8));
      const res = await executeEVMTransfer(
        EVM_WAGER_TOKEN_ADDRESS,
        EVM_TREASURY_ADDRESS,
        amountInTokens.toString()
      );
      if (!res || res.status !== "SUCCESS") throw new Error("Transaction rejected");

      // Transaction Succeeded! Reveal UI instantly.
      setIsProcessing(false);
      setGameState("revealed");

      const hMove = houseCommitment.move;
      
      let result: "win" | "loss" | "tie" = "loss";
      if (move === hMove) result = "tie";
      else if (
        (move === "ROCK" && hMove === "SCISSORS") ||
        (move === "PAPER" && hMove === "ROCK") ||
        (move === "SCISSORS" && hMove === "PAPER")
      ) {
        result = "win";
      }

      setGameResult(result);

      if (result === "win") {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#00ffff', '#ffffff'] });
        
        const winAmount = (parseFloat(wager) * 2.0).toFixed(2);
        fetch("/api/payout", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Payout-Secret": process.env.NEXT_PUBLIC_PAYOUT_SECRET || ""
          },
          body: JSON.stringify({ accountId, winAmount, wagerAmount: wager, direction: 'GAME_WIN' })
        }).then(async r => { if (!r.ok) console.error(await r.text()) }).catch(console.error);

      } else if (result === "tie") {
        // Refund exactly 1x the wager
        fetch("/api/payout", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Payout-Secret": process.env.NEXT_PUBLIC_PAYOUT_SECRET || ""
          },
          body: JSON.stringify({ accountId, winAmount: wager, wagerAmount: wager, direction: 'GAME_WIN' })
        }).then(async r => { if (!r.ok) console.error(await r.text()) }).catch(console.error);
      }

      const wagerAmount = parseFloat(wager);
      if (wagerAmount >= 10.00) {
        addWagerPoints(800);
        console.log("🎮 Valid Qualifying Wager: Awarded 800 WagerPoints.");
      } else {
        console.log("🎮 Micro-Bet Detected (< 10 $WAGER): Awarded 0 WagerPoints.");
      }

      // Refresh balances non-blockingly
      [2000, 4000].forEach(delay => setTimeout(() => refreshBalances(), delay));

    } catch (err: any) {
      console.error("[RpsZeroTrust] Error:", err);
      setTxError(err?.message || "Transaction failed.");
      setPlayerMove(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const movesConfig = [
    { id: "ROCK", emoji: "🪨", label: "ROCK", color: "hover:border-zinc-400 hover:shadow-[0_0_20px_rgba(161,161,170,0.5)]" },
    { id: "PAPER", emoji: "📄", label: "PAPER", color: "hover:border-blue-400 hover:shadow-[0_0_20px_rgba(96,165,250,0.5)]" },
    { id: "SCISSORS", emoji: "✂️", label: "SCISSORS", color: "hover:border-rose-400 hover:shadow-[0_0_20px_rgba(251,113,133,0.5)]" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-5xl h-[85vh] flex bg-wager-charcoal/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10"
    >
      {/* Dynamic Flash Overlay for Result */}
      {gameState === "revealed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute inset-0 z-0 pointer-events-none mix-blend-overlay ${
            gameResult === "win" ? "bg-green-500/20" :
            gameResult === "loss" ? "bg-red-500/20" : "bg-yellow-500/20"
          }`}
        />
      )}

      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <button 
          onClick={onClose}
          className="p-3 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/50 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <button
          onClick={() => { onClose(); window.location.hash = "rps-zero-trust"; }}
          className="flex items-center gap-2 px-4 py-2 bg-wager-black/50 hover:bg-white/10 rounded-full border border-white/10 transition-all text-white/70 hover:text-white text-sm font-bold uppercase tracking-wider"
        >
          <HelpCircle size={16} />
          How to Play
        </button>
      </div>

      {/* Left Pane: Staking & Controls */}
      <div className="w-80 bg-wager-black/70 border-r border-white/5 p-8 flex flex-col justify-between relative z-50">
        <div>
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-purple-500 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <Lock className="text-white" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-widest uppercase italic leading-none">RPS</h3>
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Zero Trust</span>
            </div>
          </div>

          {/* Staking Module */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-end mb-4">
              <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">$WAGER STAKE</span>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                PAYOUT: {wager ? (parseFloat(wager) * 2).toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="relative flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus-within:border-purple-500/50 focus-within:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all">
              <LinkIcon size={16} className="text-purple-400 mr-3" />
              <input
                type="number"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
                disabled={isProcessing || gameState === "revealed"}
                className="bg-transparent w-full text-white font-mono text-xl font-bold focus:outline-none"
                placeholder="10"
                min="0.1"
                step="0.1"
              />
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-[10px] font-mono text-zinc-500">BAL: <span className="text-wager-lime">{balances.wager}</span></span>
              <div className="flex gap-2">
                {['25%', '50%', '75%', 'MAX'].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const bal = parseFloat(balances.wager);
                      if (isNaN(bal)) return;
                      const mul = pct === 'MAX' ? 1 : parseInt(pct) / 100;
                      setWager(Math.floor(bal * mul).toString());
                    }}
                    disabled={isProcessing || gameState === "revealed"}
                    className="text-[9px] font-black text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {pct}
                  </button>
                ))}
              </div>
            </div>
            {/* Minimum Wager Warning */}
            {parseFloat(wager) < 10 && (
              <div className="text-[9px] text-orange-500 font-bold uppercase tracking-widest px-1 flex items-center gap-1 mt-2">
                <Lock size={10} />
                Bet is under 10 $WAGER. 0 Points will be awarded.
              </div>
            )}
          </div>

          {txError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-mono break-words">{txError}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={isProcessing}
          className="w-full py-4 rounded-xl border border-white/10 text-xs font-black text-white/50 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-all disabled:opacity-50"
        >
          Exit Zero Trust
        </button>
      </div>

      {/* Right Pane: Gameplay */}
      <div className="flex-1 p-12 flex flex-col relative z-10 overflow-y-auto">
        
        {/* Cryptographic Proof Console */}
        <div className="mb-12">
          <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Lock size={14} /> HOUSE COMMITMENT (SHA-256)
          </h4>
          <div className="bg-black border border-white/10 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-purple-400 font-mono text-sm break-all">
              {houseCommitment?.hash || "Generating hash..."}
            </p>
            {gameState === "revealed" && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 pt-2 border-t border-white/10"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1">
                  <Unlock size={12} className="text-green-400" /> DECRYPTED REVEAL:
                </div>
                <div className="flex gap-4">
                  <span className="text-white font-bold">{houseCommitment?.move}</span>
                  <span className="text-zinc-500 text-xs truncate">SALT: {houseCommitment?.salt}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 flex flex-col items-center justify-center">
          
          <AnimatePresence mode="wait">
            {gameState === "setup" ? (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-2xl"
              >
                <h2 className="text-center text-xl font-black text-white uppercase tracking-widest mb-8">
                  SELECT YOUR MOVE
                </h2>
                <div className="grid grid-cols-3 gap-6">
                  {movesConfig.map(({ id, emoji, label, color }) => {
                    const isSelected = playerMove === id;
                    const isDisabled = isProcessing && !isSelected;
                    
                    return (
                      <button
                        key={id}
                        onClick={() => play(id as Move)}
                        disabled={isProcessing}
                        className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-4 transition-all duration-300
                          ${isSelected ? 'bg-white/10 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] scale-105' : 'bg-black/40 border-white/5'}
                          ${isDisabled ? 'opacity-20 grayscale' : color}
                        `}
                      >
                        {isSelected && isProcessing ? (
                          <div className="animate-pulse flex flex-col items-center gap-4">
                            <Lock size={32} className="text-purple-400" />
                            <span className="text-xs font-black text-purple-400 tracking-widest">AWAITING WALLET...</span>
                          </div>
                        ) : (
                          <>
                            {id === "ROCK" ? (
                              <img src="/rock.png" alt="ROCK" className="w-16 h-16 object-contain drop-shadow-2xl" />
                            ) : (
                              <span className="text-6xl drop-shadow-2xl">{emoji}</span>
                            )}
                            <span className="text-sm font-black text-white/70 tracking-widest">{label}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full flex flex-col items-center"
              >
                {/* Result Announcement */}
                <div className="mb-12 text-center">
                  <motion.h1 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`text-5xl md:text-6xl font-black uppercase tracking-tighter drop-shadow-2xl mb-4 ${
                      gameResult === "win" ? "text-green-400" :
                      gameResult === "loss" ? "text-red-500" : "text-yellow-400"
                    }`}
                  >
                    {gameResult === "win" ? "YOU WIN" : gameResult === "loss" ? "HOUSE WINS" : "TIE GAME"}
                  </motion.h1>
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-xl font-mono text-white/80 uppercase"
                  >
                    {gameResult === "win" && `${playerMove} DEFEATS ${houseCommitment?.move}`}
                    {gameResult === "loss" && `${houseCommitment?.move} CRUSHES ${playerMove}`}
                    {gameResult === "tie" && "CRYPTOGRAPHIC TIE - STAKE REFUNDED"}
                  </motion.p>
                </div>

                {/* Showdown Display */}
                <div className="flex items-center justify-center gap-12 mb-16">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">YOU</span>
                    <div className={`w-32 h-32 rounded-2xl flex items-center justify-center text-7xl bg-black/50 border border-white/10 ${gameResult === 'win' ? 'shadow-[0_0_40px_rgba(74,222,128,0.5)] border-green-500/50' : ''}`}>
                      {playerMove === "ROCK" ? (
                        <img src="/rock.png" alt="ROCK" className="w-20 h-20 object-contain drop-shadow-2xl" />
                      ) : (
                        movesConfig.find(m => m.id === playerMove)?.emoji
                      )}
                    </div>
                  </div>
                  
                  <div className="text-3xl font-black text-white/20 italic">VS</div>

                  <div className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">HOUSE</span>
                    <div className={`w-32 h-32 rounded-2xl flex items-center justify-center text-7xl bg-black/50 border border-white/10 ${gameResult === 'loss' ? 'shadow-[0_0_40px_rgba(239,68,68,0.5)] border-red-500/50' : ''}`}>
                      {houseCommitment?.move === "ROCK" ? (
                        <img src="/rock.png" alt="ROCK" className="w-20 h-20 object-contain drop-shadow-2xl" />
                      ) : (
                        movesConfig.find(m => m.id === houseCommitment?.move)?.emoji
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateCommitment}
                  className="px-8 py-4 bg-white text-black hover:bg-zinc-200 rounded-full font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  <RefreshCw size={16} />
                  Play Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </motion.div>
  );
}
