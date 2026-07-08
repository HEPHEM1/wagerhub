"use client";

import { useState, useEffect } from "react";
import { Wallet, ChevronDown, LogOut, RefreshCw, AlertCircle, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { useAppKit } from "@reown/appkit/react";

export default function Header() {
  const {
    isConnected,
    isConnecting,
    isInitialized,
    accountId,
    wagerCredits,
    balances,
    error,
    connect,
    disconnect,
    refreshBalances,
  } = useWagerWallet();

  const { open } = useAppKit();

  // Shorten EVM address for display: 0x1234...5678
  const shortAccountId = accountId
    ? `${accountId.slice(0, 6)}...${accountId.slice(-4)}`
    : null;

  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Beta Season timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      // Calculate end of the current calendar month
      const target = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const diff = target.getTime() - now.getTime();
      
      if (diff <= 0) { 
        setTimeLeft("SEASON ENDED"); 
        return; 
      }
      
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      
      setTimeLeft(`${d}D ${h}H ${m}M ${s}S`);
    };

    updateTimer(); // run immediately
    const interval = setInterval(updateTimer, 1000); // update every second

    return () => clearInterval(interval);
  }, []);

  // ── Refresh balances handler ────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  if (!mounted) {
    return <div className="w-full sticky top-0 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl z-50 flex-shrink-0 min-h-[72px]"></div>;
  }

  return (
    <div className="w-full sticky top-0 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl z-50 flex-shrink-0 min-h-[72px]">
      {/* Left: Logo */}
      <div className="flex flex-col w-1/3">
        <h1 className="text-2xl font-black tracking-[0.2em] text-white uppercase italic">
          Wager<span className="text-wager-lime">Hub</span>
        </h1>
      </div>

      {/* Center: Season Timer & Credits */}
      <div className="w-1/3 flex flex-col items-center opacity-90">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-wager-cyan uppercase tracking-widest">
              Beta Season
            </span>
            <span className="text-sm font-mono text-white/70">{timeLeft}</span>
          </div>
          
          <div className="w-px h-8 bg-wager-charcoal/50 mx-2"></div>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-[#FFD700] uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]">
              WagerCredits
            </span>
            <span className="text-sm font-black font-mono text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]">
              {wagerCredits.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Wallet Area */}
      <div className="w-1/3 flex items-center justify-end gap-3">

        {/* Error pill */}
        <AnimatePresence>
          {error && !accountId && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1.5 text-wager-red text-xs font-bold px-3 py-1.5 rounded-full border border-wager-red/30 bg-wager-red/10"
            >
              <AlertCircle size={12} />
              {error.length > 30 ? error.slice(0, 30) + "…" : error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Disconnected state ───────────────────────────────────────────── */}
        {!isConnected ? (
          <button
            onClick={() => open()}
            className="bg-wager-cyan hover:bg-cyan-400 text-black text-xs font-black px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,255,255,0.3)] uppercase tracking-widest flex items-center gap-2"
          >
            <Wallet size={14} />
            Connect Wallet
          </button>
        ) : (
          /* ── Connected state ──────────────────────────────────────────────── */
          <div className="relative">
            <motion.button
              id="wgr-btn-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-3 bg-wager-charcoal/50 text-white text-xs font-mono font-bold px-4 py-1.5 rounded-full border border-wager-lime/20 cursor-pointer hover:bg-wager-charcoal transition-colors"
            >
              {/* Account ID & Balances */}
              <div className="flex flex-col items-end mr-2 text-right">
                <span className="text-white text-[10px] bg-white/10 px-2 py-0.5 rounded-full mb-1">{accountId}</span>
                <div className="flex items-center gap-x-3 text-right">
                  <span className="text-wager-lime text-[10px]">{balances.hbar} HBAR</span>
                  <span className="text-wager-cyan text-[10px]">{balances.wager} WAGER</span>
                </div>
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-wager-lime to-wager-cyan flex items-center justify-center border border-black">
                <ChevronDown
                  size={16}
                  className={`text-black transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </div>
            </motion.button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-wager-charcoal border border-white/10 rounded-2xl p-3 shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-50"
                >
                  {/* Account ID */}
                  <div className="px-2 py-1.5 mb-2 border-b border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Account
                    </span>
                    <p className="text-xs font-mono text-white mt-0.5 truncate">
                      {accountId}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500">
                      {shortAccountId} · Hedera Testnet
                    </p>
                  </div>

                  {/* Stablecoin Balances */}
                  <div className="px-2 py-1.5 mb-2 border-b border-white/10 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">
                      Balances
                    </span>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-blue-400 font-bold">USDC</span>
                      <span className="text-white">{balances.usdc || "0.00"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-emerald-400 font-bold">USDT</span>
                      <span className="text-white">{balances.usdt || "0.00"}</span>
                    </div>
                  </div>

                  {/* Refresh balances */}
                  <button
                    id="refresh-balances-btn"
                    onClick={handleRefresh}
                    className="w-full flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-wager-lime px-2 py-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <motion.span
                      animate={isRefreshing ? { rotate: 360 } : {}}
                      transition={{ duration: 0.6, ease: "linear" }}
                      className="inline-block"
                    >
                      <RefreshCw size={14} />
                    </motion.span>
                    Refresh Balances
                  </button>

                  {/* Disconnect */}
                  <button
                    onClick={() => {
                      disconnect();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-wager-red font-bold hover:bg-wager-red/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Unlink HashPack
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
