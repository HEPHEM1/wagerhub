"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownUp, Info, Settings, ChevronDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { HCSLiveFeed } from "./HCSLiveFeed";
import {
  TokenAssociateTransaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TransferTransaction,
  ContractId,
  TokenId,
  AccountId,
  Hbar,
} from "@hashgraph/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Testnet $WAGER token ID in native Hedera shard.realm.num format.
 * Using TokenId.fromString() — fromSolidityAddress() caused INVALID_TOKEN_ID.
 */
const WAGER_TOKEN_ID_STRING = "0.0.8818191";
const WAGER_TOKEN_ID = TokenId.fromString(WAGER_TOKEN_ID_STRING);

/**
 * SaucerSwap V2 Router contract on Hedera Testnet.
 * Replace with the live deployed contract ID before mainnet.
 */
const SWAP_CONTRACT_ID = ContractId.fromString("0.0.1234567"); // TODO: replace with live router

/** Gas limit for Hedera contract calls — must be set explicitly or the tx fails */
const SWAP_GAS = 100_000;

/** Hedera Testnet Mirror Node base URL */
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";
const TREASURY_ID = (process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim();

const TOKENS = [
  { id: "HBAR", symbol: "HBAR", type: "native", icon: "ℏ" },
  { id: "USDC", symbol: "USDC", type: "erc20", icon: "$" },
  { id: "USDT", symbol: "USDT", type: "erc20", icon: "₮" },
  { id: "WAGER", symbol: "$WAGER", type: "erc20", icon: "W" },
];

export default function Wagerswap() {
  const [payAmount, setPayAmount] = useState("");
  const [payToken, setPayToken] = useState(TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState(TOKENS[3]);
  
  const [isPayTokenSelectorOpen, setIsPayTokenSelectorOpen] = useState(false);
  const [isReceiveTokenSelectorOpen, setIsReceiveTokenSelectorOpen] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  
  // ── Wallet hook ──────────────────────────────────────────────────────────────
  const { isConnected, accountId, balances, network, wagerCredits, addWagerCredits, executeTransaction, refreshBalances } = useWagerWallet();

  const [isClaimed, setIsClaimed] = useState(false);
  const [isHbarToWager, setIsHbarToWager] = useState(true);

  // ── Swap state ────────────────────────────────────────────────────────────────
  const [isApproved, setIsApproved] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [swapStatus, setSwapStatus] = useState<"idle" | "associating" | "swapping" | "payout" | "success" | "error">("idle");
  const [swapError, setSwapError] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastEarnedCredits, setLastEarnedCredits] = useState<number | null>(null);

  // Reset approval + status when pay token changes
  useEffect(() => {
    setIsApproved(false);
    setSwapError(null);
    setSwapStatus("idle");
  }, [payToken]);

  // ── Conversion rates (Season 1: 1 HBAR = 100 $WAGER) ─────────────────────
  const getReceiveAmount = () => {
    if (!payAmount || isNaN(parseFloat(payAmount))) return "";
    
    // HBAR -> $WAGER (1:100)
    if (isHbarToWager) {
      return (parseFloat(payAmount) * 100).toFixed(2);
    } 
    // $WAGER -> HBAR (100:1)
    else {
      return (parseFloat(payAmount) / 100).toFixed(2);
    }
  };

  const receiveAmount = getReceiveAmount();
  const requiresApproval = payToken.type === "erc20";
  const isHopRequired = payToken.type === "erc20" && receiveToken.type === "erc20";

  const handleQuickSelect = (percent: string) => {
    const hbarBalance = parseFloat(balances.hbar);
    if (isNaN(hbarBalance) || hbarBalance <= 0) return;

    let amount = 0;
    if (percent === 'MAX') {
      amount = Math.max(0, hbarBalance - 1); // Gas buffer
    } else {
      const factor = parseInt(percent.replace('%', '')) / 100;
      amount = hbarBalance * factor;
    }
    setPayAmount(amount.toFixed(2));
  };

  // ── Association check ─────────────────────────────────────────────────────────
  /**
   * Checks via Mirror Node whether the connected account is already associated
   * with the $WAGER token. Returns true if associated, false if not.
   */
  const isWagerAssociated = async (accId: string): Promise<boolean> => {
    try {
      // Mirror Node requires native shard.realm.num format for token.id queries
      const url = `${MIRROR_NODE_BASE}/accounts/${accId}/tokens?token.id=${WAGER_TOKEN_ID_STRING}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      const isAssociated = (data?.tokens?.length ?? 0) > 0;
      console.log(`[Wagerswap] Association check for ${WAGER_TOKEN_ID_STRING}:`, isAssociated);
      return isAssociated;
    } catch (e) {
      console.log("[Wagerswap] Association check error:", e);
      return false;
    }
  };

  // ── Main executeSwap ──────────────────────────────────────────────────────────
  /**
   * Full swap flow:
   *   1. Guard: wallet connected + amount entered + network is testnet
   *   2. Check: is account associated with $WAGER token?
   *   3. If not → send TokenAssociateTransaction first
   *   4. Build ContractExecuteTransaction with setGas(100_000)
   *   5. Sign + execute via wallet; log any Hedera ResponseCode on failure
   */
  const executeSwap = async () => {
    if (!isConnected || !accountId) {
      setSwapError("Connect your wallet first.");
      return;
    }
    
    if (network !== "testnet") {
      setSwapError(`Network mismatch: Wallet is connected to ${network || "an unknown network"}. Please switch to Hedera Testnet.`);
      return;
    }

    if (!payAmount || parseFloat(payAmount) <= 0) {
      setSwapError("Enter an amount to swap.");
      return;
    }

    setSwapError(null);
    setLastTxId(null);
    setIsProcessing(true);

    try {
      // ── Step 1: ERC-20 approval (mock state for now — replace with
      //            ContractExecuteTransaction calling approve() when ABI is ready)
      if (requiresApproval && !isApproved) {
        setSwapStatus("associating");
        await new Promise((r) => setTimeout(r, 800)); // simulate approval round-trip
        setIsApproved(true);
        setSwapStatus("idle");
        setIsProcessing(false);
        return;
      }

      // ── Step 2: Check $WAGER token association ──────────────────────────────
      const associated = await isWagerAssociated(accountId);

      if (!associated && receiveToken.symbol === "$WAGER") {
        setSwapStatus("associating");
        console.log(
          `[Wagerswap] Account not associated with $WAGER (${WAGER_TOKEN_ID_STRING}) — sending TokenAssociateTransaction`
        );

        // Use native TokenAssociateTransaction via the WalletConnect signer.
        // TokenId.fromString() is used here — NOT fromSolidityAddress() — to
        // avoid INVALID_TOKEN_ID errors on the Hedera network.
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromString(accountId))
          .setTokenIds([TokenId.fromString(WAGER_TOKEN_ID_STRING)]);

        const assocTxId = await executeTransaction(associateTx);
        if (!assocTxId) {
          throw new Error(
            `TokenAssociateTransaction for ${WAGER_TOKEN_ID_STRING} was rejected or failed.`
          );
        }
        console.log("[Wagerswap] ✅ Association tx submitted:", assocTxId);
      }

      // ── Step 3: Build the swap transaction ──────────────────────────────────
      setSwapStatus("swapping");

      const direction = isHbarToWager ? 'HBAR_TO_WAGER' : 'WAGER_TO_HBAR';
      let swapTx;

      if (isHbarToWager) {
        const amountInHbar = Hbar.fromString(payAmount);
        console.log(`[Wagerswap] Executing HBAR -> $WAGER Swap: ${payAmount} HBAR to Treasury.`);
        
        swapTx = new TransferTransaction()
          .addHbarTransfer(accountId, amountInHbar.negated())
          .addHbarTransfer(TREASURY_ID, amountInHbar)
          .setTransactionMemo("WagerHub Swap: HBAR -> $WAGER");
      } else {
        // $WAGER -> HBAR
        // $WAGER has 8 decimals
        const amountInTokens = Math.floor(parseFloat(payAmount) * 1e8);
        console.log(`[Wagerswap] Executing $WAGER -> HBAR Swap: ${payAmount} $WAGER to Treasury.`);

        swapTx = new TransferTransaction()
          .addTokenTransfer(WAGER_TOKEN_ID, accountId, -amountInTokens)
          .addTokenTransfer(WAGER_TOKEN_ID, TREASURY_ID, amountInTokens)
          .setTransactionMemo("WagerHub Swap: $WAGER -> HBAR");
      }

      let res;
      try {
        res = await executeTransaction(swapTx);
      } catch (error) {
        console.error("TRANSACTION FAILURE (Frontend):", error);
        throw error;
      }
      
      if (!res) {
        throw new Error("Swap transaction was rejected by the wallet or cancelled.");
      }
      
      const txId = res.txId || "Confirmed (TxId hidden by HashConnect V3)";

      // ── Step 4: Backend Payout ─────────────────────────────────────────────
      setSwapStatus("payout");
      console.log(`[Wagerswap] Requesting backend payout of ${receiveAmount} $WAGER to ${accountId}`);

      const payoutRes = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accountId, 
          hbarAmount: isHbarToWager ? payAmount : null,
          wagerAmount: !isHbarToWager ? payAmount : null,
          direction 
        })
      });

      if (!payoutRes.ok) {
        throw new Error("Swap HBAR transferred successfully, but Backend Payout failed.");
      }

      // ── Step 5: Success ────────────────────────────────────────────────────
      console.log("[Wagerswap] ✅ Swap & Payout successful. Tx ID:", txId);
      
      // Reward the user with WagerCredits
      const earnedCredits = Math.floor(parseFloat(payAmount) * 10);
      addWagerCredits(earnedCredits);
      
      // Trigger a glorious celebration
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#CCFF00', '#00FFFF'] // Neon Gold, Lime, Cyan
      });

      // Silently sync the new high score to the Hedera Consensus Service
      fetch('/api/log-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          creditsEarned: earnedCredits,
          totalCredits: wagerCredits + earnedCredits,
          event: "wagerswap"
        })
      }).catch(err => console.error("[HCS Sync Error]", err));

      setLastEarnedCredits(earnedCredits);
      setLastTxId(txId);
      setSwapStatus("success");
      setPayAmount("");
      setIsApproved(false);

      // Refresh wallet balances immediately and again after 3s to account for Mirror Node indexing
      refreshBalances();
      setTimeout(() => refreshBalances(), 3000);

    } catch (err: unknown) {
      // ── Full error logging — shows Hedera ResponseCode (e.g. TOKEN_NOT_ASSOCIATED_TO_ACCOUNT)
      console.log("[Wagerswap] ❌ Swap error:", err);

      // Extract a human-readable message if the Hedera SDK provides one
      let message = "Swap failed. Check console for the Hedera ResponseCode.";
      if (err instanceof Error) {
        message = err.message;
        // Hedera SDK often embeds the ResponseCode in the message string
        if (message.includes("TOKEN_NOT_ASSOCIATED_TO_ACCOUNT")) {
          message = "$WAGER not associated. Please retry — association will be triggered automatically.";
        } else if (message.includes("INSUFFICIENT_PAYER_BALANCE")) {
          message = "Insufficient HBAR balance to cover gas + swap amount.";
        } else if (message.includes("INSUFFICIENT_GAS")) {
          message = "Gas too low. Contact support — gas is set to " + SWAP_GAS + ".";
        } else if (message.includes("CONTRACT_REVERT_EXECUTED")) {
          message = "Router contract reverted. Slippage too high or pool has insufficient liquidity.";
        }
      }

      setSwapError(message);
      setSwapStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const flipTokens = () => {
    setIsHbarToWager(!isHbarToWager);
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount("");
    setIsApproved(false);
    setSwapError(null);
    setSwapStatus("idle");
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* Early Adopter Bonus Banner */}
      <AnimatePresence>
        {!isClaimed && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 p-[1px] rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/5"
          >
            <div className="bg-[#121214] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-500/20 p-2 rounded-lg">
                  <CheckCircle2 size={20} className="text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-black tracking-tight uppercase">Early Adopter Bonus</h4>
                  <p className="text-cyan-400/80 text-[11px] uppercase font-black tracking-tighter">Claim 500 $WAGER Tokens</p>
                </div>
              </div>
              <button 
                onClick={() => setIsClaimed(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20"
              >
                CLAIM
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The massive DeFi Terminal card */}
      <div className="relative bg-wager-charcoal/80 backdrop-blur-2xl border border-wager-cyan/20 rounded-[3rem] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Glow effect behind the terminal */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-wager-lime animate-pulse shadow-[0_0_10px_rgba(204,255,0,0.8)]"></span>
            Universal Router
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`transition-colors p-3 rounded-xl ${isSettingsOpen ? 'bg-wager-cyan/20 text-wager-cyan' : 'bg-wager-black border border-white/5 text-zinc-400 hover:text-white hover:border-white/20'}`}
            >
              <Settings size={20} />
            </button>
            <button className="text-zinc-400 hover:text-white transition-colors p-3 bg-wager-black border border-white/5 hover:border-white/20 rounded-xl">
              <Info size={20} />
            </button>
          </div>
        </div>

        {/* Slippage Settings Drawer */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-wager-black/60 border border-wager-charcoal rounded-2xl p-6 flex items-center justify-between shadow-inner">
                <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">Max Slippage Tolerance</span>
                <div className="flex gap-3">
                  {["0.1", "0.5", "1.0"].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSlippage(val)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${slippage === val ? 'bg-wager-cyan text-black shadow-[0_0_15px_rgba(0,255,255,0.2)]' : 'bg-wager-charcoal text-zinc-400 hover:text-white border border-white/5'}`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Massive Input Section */}
        <div className="space-y-4 relative">
          
          {/* Pay Input */}
          <div className="bg-wager-black/80 border-2 border-wager-charcoal rounded-3xl p-8 focus-within:border-wager-cyan/50 transition-colors relative z-20 shadow-inner">
            <label className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-4 block">You Pay</label>
            <div className="flex justify-between items-center gap-6">
              <input 
                type="number"
                placeholder="0.00"
                value={payAmount}
                disabled={payToken.symbol !== "HBAR"}
                onChange={(e) => setPayAmount(e.target.value)}
                className={`bg-transparent text-6xl font-mono text-white outline-none placeholder:text-zinc-800 w-full ${payToken.symbol !== "HBAR" ? 'opacity-20 cursor-not-allowed' : ''}`}
              />
              
              {/* Pay Token Selector */}
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => {
                    setIsPayTokenSelectorOpen(!isPayTokenSelectorOpen);
                    setIsReceiveTokenSelectorOpen(false);
                  }}
                  className="flex items-center gap-3 bg-wager-charcoal hover:bg-wager-charcoal/80 px-6 py-4 rounded-2xl transition-colors border border-white/10 shadow-lg min-w-[160px] justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white shadow-inner">{payToken.icon}</span>
                    <span className="font-black text-2xl text-white tracking-wide">{payToken.symbol}</span>
                  </div>
                  <ChevronDown size={20} className="text-zinc-400" />
                </button>

                {/* Pay Dropdown Menu */}
                <AnimatePresence>
                  {isPayTokenSelectorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full right-0 mt-3 w-64 bg-wager-charcoal border-2 border-wager-cyan/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50"
                    >
                      {TOKENS.map((token) => (
                        <button
                          key={token.id}
                          disabled={token.symbol === receiveToken.symbol}
                          onClick={() => {
                            setPayToken(token);
                            setIsPayTokenSelectorOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left border-b border-white/5 last:border-0 ${
                            token.symbol === receiveToken.symbol ? 'opacity-30 cursor-not-allowed bg-black/40' : 'hover:bg-wager-cyan/10 cursor-pointer'
                          }`}
                        >
                          <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">{token.icon}</span>
                          <span className="font-black text-xl text-white">{token.symbol}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* HBAR Balance and Quick Selectors */}
            <div className="flex justify-between items-center mt-6 px-1 border-t border-white/5 pt-4">
              <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-tighter">
                Balance: <span className="text-white/60 ml-1">{balances.hbar || "0.00"} HBAR</span>
              </div>
              <div className="flex gap-1.5">
                {['25%', '50%', '75%', 'MAX'].map((label) => (
                  <button
                    key={label}
                    onClick={() => handleQuickSelect(label)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-[9px] font-black text-white/30 hover:text-cyan-400 transition-all border border-white/5 hover:border-cyan-500/30"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Massive Swap Icon Button */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <button 
              onClick={flipTokens}
              className="bg-wager-black border-[4px] border-wager-charcoal text-wager-cyan p-4 rounded-2xl hover:border-wager-cyan/50 hover:bg-wager-charcoal transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)] group"
            >
              <ArrowDownUp size={28} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Receive Output Section */}
          <div className="bg-wager-black/80 border-2 border-wager-charcoal rounded-3xl p-8 focus-within:border-wager-lime/50 transition-colors relative z-10 shadow-inner">
            <label className="text-sm text-zinc-500 uppercase font-bold tracking-widest mb-4 block">You Receive</label>
            <div className="flex justify-between items-center gap-6">
              <input 
                type="text"
                readOnly
                placeholder="0.00"
                value={receiveAmount}
                className={`bg-transparent text-6xl font-mono outline-none placeholder:text-zinc-800 w-full ${receiveAmount ? 'text-wager-lime' : 'text-zinc-600'}`}
              />
              
              {/* Receive Token Selector */}
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => {
                    setIsReceiveTokenSelectorOpen(!isReceiveTokenSelectorOpen);
                    setIsPayTokenSelectorOpen(false);
                  }}
                  className="flex items-center gap-3 bg-wager-charcoal hover:bg-wager-charcoal/80 px-6 py-4 rounded-2xl transition-colors border border-white/10 shadow-lg min-w-[160px] justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${
                      receiveToken.symbol === '$WAGER' ? 'bg-wager-lime/20 text-wager-lime' : 'bg-white/10 text-white'
                    }`}>
                      {receiveToken.icon}
                    </span>
                    <span className={`font-black text-2xl tracking-wide ${
                      receiveToken.symbol === '$WAGER' ? 'text-wager-lime' : 'text-white'
                    }`}>
                      {receiveToken.symbol}
                    </span>
                  </div>
                  <ChevronDown size={20} className="text-zinc-400" />
                </button>

                {/* Receive Dropdown Menu */}
                <AnimatePresence>
                  {isReceiveTokenSelectorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full right-0 mt-3 w-64 bg-wager-charcoal border-2 border-wager-lime/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50"
                    >
                      {TOKENS.map((token) => (
                        <button
                          key={token.id}
                          disabled={token.symbol === payToken.symbol}
                          onClick={() => {
                            setReceiveToken(token);
                            setIsReceiveTokenSelectorOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left border-b border-white/5 last:border-0 ${
                            token.symbol === payToken.symbol ? 'opacity-30 cursor-not-allowed bg-black/40' : 'hover:bg-wager-lime/10 cursor-pointer'
                          }`}
                        >
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            token.symbol === '$WAGER' ? 'bg-wager-lime/20 text-wager-lime' : 'bg-white/10 text-white'
                          }`}>
                            {token.icon}
                          </span>
                          <span className={`font-black text-xl ${
                            token.symbol === '$WAGER' ? 'text-wager-lime' : 'text-white'
                          }`}>
                            {token.symbol}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* $WAGER Balance */}
            <div className="flex items-center mt-6 px-1 border-t border-white/5 pt-4 text-white/30 text-[10px] font-bold uppercase tracking-tighter">
              Balance: <span className="text-wager-lime/60 ml-2">{balances.wager || "0.00"} $WAGER</span>
            </div>
          </div>
        </div>

        {/* Routing Path Visualization */}
        {isHopRequired && (
          <div className="mt-8 px-4 flex items-center justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest bg-wager-black/40 p-3 rounded-xl border border-white/5">
            <span className="font-bold">Multi-Hop Route</span>
            <div className="flex items-center gap-3">
              <span className="text-white">{payToken.symbol}</span>
              <span className="text-zinc-600 font-sans">→</span>
              <span className="text-zinc-400">HBAR</span>
              <span className="text-zinc-600 font-sans">→</span>
              <span className="text-wager-lime font-bold">{receiveToken.symbol}</span>
            </div>
          </div>
        )}

        {/* Error banner */}
        <AnimatePresence>
          {swapError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-6 flex items-start gap-3 bg-wager-red/10 border border-wager-red/30 rounded-2xl px-5 py-4"
            >
              <AlertCircle size={18} className="text-wager-red flex-shrink-0 mt-0.5" />
              <p className="text-sm font-mono text-wager-red leading-snug">{swapError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success banner */}
        <AnimatePresence>
          {swapStatus === "success" && lastTxId && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-start gap-3 bg-wager-lime/10 border border-wager-lime/30 rounded-2xl px-5 py-4"
            >
              <CheckCircle2 size={18} className="text-wager-lime flex-shrink-0 mt-0.5" />
              <div className="w-full">
                <p className="text-sm font-bold text-wager-lime">Swap Confirmed!</p>
                {lastEarnedCredits !== null && (
                  <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest mt-1 mb-1 animate-pulse">
                    🎉 You earned {lastEarnedCredits} WagerCredits!
                  </p>
                )}
                <p className="text-xs font-mono text-zinc-400 break-all mt-0.5">Tx: {lastTxId}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Massive Dual-State Action Button */}
        <div className="mt-8">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={executeSwap}
            disabled={!payAmount || isProcessing || !isConnected}
            className={`w-full font-black uppercase tracking-widest py-6 rounded-3xl transition-all text-2xl flex items-center justify-center gap-3
              ${!isConnected
                ? 'bg-wager-charcoal text-zinc-500 cursor-not-allowed border-2 border-white/5'
                : !payAmount
                ? 'bg-wager-charcoal text-zinc-600 cursor-not-allowed border-2 border-white/5'
                : isProcessing
                ? 'bg-wager-charcoal text-zinc-400 cursor-wait border-2 border-white/10'
                : (requiresApproval && !isApproved)
                ? 'bg-amber-400 text-black shadow-[0_0_30px_rgba(251,191,36,0.3)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] border-2 border-amber-300'
                : 'bg-wager-cyan text-black shadow-[0_0_30px_rgba(0,255,255,0.3)] hover:shadow-[0_0_50px_rgba(0,255,255,0.5)] border-2 border-cyan-300'
              }`}
          >
            {!isConnected ? (
              <>Connect Wallet to Swap</>
            ) : isProcessing && swapStatus === "associating" ? (
              <><Loader2 size={24} className="animate-spin" /> Associating $WAGER Token...</>
            ) : isProcessing && swapStatus === "swapping" ? (
              <><Loader2 size={24} className="animate-spin" /> Awaiting Wallet Approval...</>
            ) : isProcessing && swapStatus === "payout" ? (
              <><Loader2 size={24} className="animate-spin" /> Processing Backend Payout...</>
            ) : isProcessing ? (
              <><Loader2 size={24} className="animate-spin" /> Processing...</>
            ) : requiresApproval && !isApproved ? (
              <>Approve {payToken.symbol} Contract</>
            ) : (
              <>Execute Swap &amp; Load Wallet</>
            )}
            {isApproved && requiresApproval && !isProcessing && <CheckCircle2 size={28} className="text-black" />}
          </motion.button>

          {/* Wallet not connected nudge */}
          {!isConnected && (
            <p className="text-center text-xs font-mono text-zinc-600 mt-3">
              Connect your wallet via the header to enable swaps
            </p>
          )}
        </div>
      </div>

      <HCSLiveFeed />
    </div>
  );
}

