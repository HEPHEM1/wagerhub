"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownUp, Info, Settings, ChevronDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useWagerWallet } from "@/hooks/useWagerWallet";
import { 
  EVM_WAGER_TOKEN_ADDRESS, 
  EVM_TREASURY_ADDRESS, 
  ERC20_ABI, 
  HTS_PRECOMPILE_ADDRESS,
  HTS_ABI,
  EVM_USDC_ADDRESS,
  EVM_USDT_ADDRESS
} from "../evm";
import { 
  MOCK_WAGER_SWAP_POOL_ADDRESS, 
  WAGER_SWAP_POOL_ABI 
} from "@/evm-contracts";
import { HCSLiveFeed } from "./HCSLiveFeed";

// ─── Constants ────────────────────────────────────────────────────────────────

const WAGER_TOKEN_ID_STRING = "0.0.8818191";
const USDT_TOKEN_ID_STRING = "0.0.9388816";
const USDC_TOKEN_ID_STRING = "0.0.9388818";

const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";
const TREASURY_ID = (process.env.NEXT_PUBLIC_TREASURY_ID || "0.0.8814484").trim();

// Core 4-token roster — SAUCE/PACK/HBARX removed per spec
const TOKENS = [
  {
    id: "HBAR",  symbol: "HBAR",   type: "native", decimals: 8, tokenId: "HBAR",
    iconUrl: "https://assets.coingecko.com/coins/images/3688/standard/hbar.png",
  },
  {
    id: "USDC",  symbol: "USDC",   type: "erc20",  decimals: 6, tokenId: USDC_TOKEN_ID_STRING,
    iconUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
  },
  {
    id: "USDT",  symbol: "USDT",   type: "erc20",  decimals: 6, tokenId: USDT_TOKEN_ID_STRING,
    iconUrl: "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
  },
  {
    id: "WAGER", symbol: "$WAGER", type: "erc20",  decimals: 8, tokenId: WAGER_TOKEN_ID_STRING,
    iconUrl: "https://ui-avatars.com/api/?name=W&background=CCFF00&color=000&rounded=true&bold=true",
  },
];

// ─── Routing: all pairs in a 4-token universe are direct ───────────────────────────
type Token = typeof TOKENS[number];

// Build direct-pool set programmatically for every A↔B combo
const DIRECT_POOLS = new Set(
  TOKENS.flatMap((a) => TOKENS.filter((b) => b.id !== a.id).map((b) => `${a.symbol}-${b.symbol}`))
);

const getRoute = (pay: Token, receive: Token): Token[] => {
  if (pay.symbol === receive.symbol) return [pay];
  // In a 4-token universe all pairs are direct pools
  return [pay, receive];
};

export default function Wagerswap() {
  const [payAmount, setPayAmount] = useState("");
  const [payToken, setPayToken] = useState(TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState(TOKENS[3]);
  
  const [isPayTokenSelectorOpen, setIsPayTokenSelectorOpen] = useState(false);
  const [isReceiveTokenSelectorOpen, setIsReceiveTokenSelectorOpen] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [exchangeRate, setExchangeRate] = useState<string>("0.00");
  
  // 🟢 Live AMM Reserves
  const [reserves, setReserves] = useState<{ hbar: bigint; wager: bigint; usdc: bigint; usdt: bigint }>({ hbar: 0n, wager: 0n, usdc: 0n, usdt: 0n });
  
  // ── Wallet hook ──────────────────────────────────────────────────────────────
  const { isConnected, accountId, walletType, balances, network, wagerPoints, addWagerPoints, executeTransaction, executeEVMTransfer, executeEVMSmartContract, refreshBalances } = useWagerWallet();

  const [isClaimed, setIsClaimed] = useState(false);

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
  }, [payToken, receiveToken]);

  // ── Live Oracle: USD prices (4-token core) ───────────────────────────────────────────────────
  //  HBAR  → live from /api/prices (SaucerSwap → CoinGecko → static fallback)
  //  USDC  → live from /api/prices
  //  USDT  → live from /api/prices
  //  $WAGER → LOCKED: always hbarUsd / 10. Never fetched from any external API.
  const [pricesUsd, setPricesUsd] = useState<Record<string, number>>({
    "HBAR":   0.07,
    "$WAGER": 0.007,  // fallback: 0.07 / 10
    "USDC":   1.00,
    "USDT":   1.00,
  });
  const [oracleSource, setOracleSource]     = useState<"live" | "fallback">("fallback");
  const [oracleUpdatedAt, setOracleUpdatedAt] = useState<number | null>(null);

  // Decimal precision map for on-chain math normalization
  const TOKEN_DECIMALS: Record<string, number> = {
    "HBAR":   8,
    "$WAGER": 8,
    "USDC":   6,
    "USDT":   6,
  };

  // ── 30-second live price refresh via /api/prices proxy ───────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchLivePrices = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) throw new Error(`/api/prices returned ${res.status}`);
        const data: { source: string; prices: Record<string, number>; updatedAt: number } = await res.json();
        if (!isMounted) return;

        // Validate prices before applying
        const hbarUsd = data.prices["HBAR"];
        const usdcUsd = data.prices["USDC"];
        const usdtUsd = data.prices["USDT"];

        const next: Record<string, number> = {};
        if (isFinite(hbarUsd) && hbarUsd > 0.001) {
          next["HBAR"]   = hbarUsd;
          next["$WAGER"] = hbarUsd / 10;  // ← RULE: locked constant, never from API
        }
        if (isFinite(usdcUsd) && usdcUsd > 0.9 && usdcUsd < 1.1) next["USDC"] = usdcUsd;
        if (isFinite(usdtUsd) && usdtUsd > 0.9 && usdtUsd < 1.1) next["USDT"] = usdtUsd;

        setPricesUsd(prev => ({ ...prev, ...next }));
        setOracleSource(data.source === "fallback" ? "fallback" : "live");
        setOracleUpdatedAt(data.updatedAt);
        console.log(`[Wagerswap] 📊 Oracle (${data.source}): HBAR=$${next["HBAR"]?.toFixed(4)} WAGER=$${next["$WAGER"]?.toFixed(5)}`);
      } catch (err) {
        console.warn("[Wagerswap] Price fetch failed, keeping current rates:", err);
        if (isMounted) setOracleSource("fallback");
      }
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30_000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // 🟢 Fetch Live Reserves from Pool
  useEffect(() => {
    let isMounted = true;
    const fetchReserves = async () => {
      try {
        const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        // Get HBAR balance (wei = 18 decimals, convert to 8 decimals)
        const hbarBalWei = await provider.getBalance(MOCK_WAGER_SWAP_POOL_ADDRESS);
        const hbarBal = hbarBalWei / 10000000000n;
        
        const wagerContract = new ethers.Contract(EVM_WAGER_TOKEN_ADDRESS, ERC20_ABI, provider);
        const usdcContract = new ethers.Contract(EVM_USDC_ADDRESS, ERC20_ABI, provider);
        const usdtContract = new ethers.Contract(EVM_USDT_ADDRESS, ERC20_ABI, provider);
        
        // Fetch balances individually so one missing token doesn't break everything
        const safeBalanceOf = async (contract: ethers.Contract) => {
          try { return await contract.balanceOf(MOCK_WAGER_SWAP_POOL_ADDRESS); }
          catch { return 0n; }
        };

        const [wagerBal, usdcBal, usdtBal] = await Promise.all([
          safeBalanceOf(wagerContract),
          safeBalanceOf(usdcContract),
          safeBalanceOf(usdtContract)
        ]);
        
        if (isMounted) {
          setReserves({ hbar: hbarBal, wager: wagerBal, usdc: usdcBal, usdt: usdtBal });
          console.log(`[Wagerswap] Live Pool: ${ethers.formatUnits(hbarBal, 8)} HBAR, ${ethers.formatUnits(wagerBal, 8)} WAGER, ${ethers.formatUnits(usdcBal, 6)} USDC, ${ethers.formatUnits(usdtBal, 6)} USDT`);
        }
      } catch (err) {
        console.warn("[Wagerswap] Failed to fetch live reserves:", err);
      }
    };

    fetchReserves();
    const interval = setInterval(fetchReserves, 10_000); // 10s polling
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Map symbol to reserve value and decimals
  const getReserveInfo = (symbol: string) => {
    if (symbol === "HBAR") return { reserve: reserves.hbar, dec: 8 };
    if (symbol === "$WAGER") return { reserve: reserves.wager, dec: 8 };
    if (symbol === "USDC") return { reserve: reserves.usdc, dec: 6 };
    if (symbol === "USDT") return { reserve: reserves.usdt, dec: 6 };
    return { reserve: 0n, dec: 8 };
  };

  // ── Rate computation ────────────────────────────────────────────────────────────────────
  // Calculate spot rate from AMM reserves if available, otherwise fallback to USD oracle
  const computeRate = (pay: Token, receive: Token): number => {
    const isOracleRoute = (pay.symbol === "HBAR" && (receive.symbol === "USDC" || receive.symbol === "USDT")) ||
                          ((pay.symbol === "USDC" || pay.symbol === "USDT") && receive.symbol === "HBAR");

    if (!isOracleRoute) {
      const inInfo = getReserveInfo(pay.symbol);
      const outInfo = getReserveInfo(receive.symbol);
      
      const reserveIn = Number(ethers.formatUnits(inInfo.reserve, inInfo.dec));
      const reserveOut = Number(ethers.formatUnits(outInfo.reserve, outInfo.dec));

      if (reserveIn > 0 && reserveOut > 0) {
        return reserveOut / reserveIn;
      }
    }

    // Fallback to USD oracle rate (always used for Oracle Routes)
    const payUsd     = pricesUsd[pay.symbol]     ?? 0.01;
    const receiveUsd = pricesUsd[receive.symbol] ?? 0.01;
    if (receiveUsd === 0) return 0;
    return payUsd / receiveUsd;
  };

  useEffect(() => {
    const rate = computeRate(payToken, receiveToken);
    const precision = rate < 0.0001 ? 8 : rate < 0.01 ? 6 : rate < 10 ? 4 : 2;
    setExchangeRate(rate.toFixed(precision));
  }, [payToken, receiveToken, pricesUsd, reserves]);

  const getReceiveAmount = (): string => {
    const isBlockedRoute = ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "$WAGER") ||
                           (payToken.symbol === "$WAGER" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT"));
    if (isBlockedRoute) return "---";

    const amt = parseFloat(payAmount);
    if (!payAmount || isNaN(amt) || amt <= 0) return "";
    
    const isOracleRoute = (payToken.symbol === "HBAR" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT")) ||
                          ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "HBAR");

    if (!isOracleRoute) {
      const inInfo = getReserveInfo(payToken.symbol);
      const outInfo = getReserveInfo(receiveToken.symbol);
      
      const reserveIn = Number(ethers.formatUnits(inInfo.reserve, inInfo.dec));
      const reserveOut = Number(ethers.formatUnits(outInfo.reserve, outInfo.dec));

      if (reserveIn > 0 && reserveOut > 0) {
        // Pool has liquidity, use constant product AMM formula: dy = (y * dx) / (x + dx)
        const amountOut = (reserveOut * amt) / (reserveIn + amt);
        return amountOut.toFixed(outInfo.dec); 
      }
    }

    // Fallback to oracle price
    const rate   = computeRate(payToken, receiveToken);
    const result = amt * rate;
    const dec = TOKEN_DECIMALS[receiveToken.symbol] ?? receiveToken.decimals;
    return result.toFixed(dec);
  };

  const receiveAmount = getReceiveAmount();

  // ── Routing (all 4×4 pairs are direct) ───────────────────────────────────────────────────
  const route        = getRoute(payToken, receiveToken);
  const requiresApproval = payToken.type === "erc20";

  const getBalanceForToken = (symbol: string) => {
    switch (symbol) {
      case "HBAR": return balances.hbar || "0.00";
      case "$WAGER": return balances.wager || "0.00";
      case "USDT": return balances.usdt || "0.00";
      case "USDC": return balances.usdc || "0.00";
      default: return "0.00";
    }
  };

  const getNumericBalance = (symbol: string) => {
    return parseFloat(getBalanceForToken(symbol)) || 0;
  };

  const handleQuickSelect = (percent: string) => {
    const balString = getBalanceForToken(payToken.symbol);
    const balance = parseFloat(balString);
    if (isNaN(balance) || balance <= 0) return;

    let amount = 0;
    if (percent === 'MAX') {
      amount = payToken.symbol === 'HBAR' ? Math.max(0, balance - 1) : balance;
    } else {
      const factor = parseInt(percent.replace('%', '')) / 100;
      amount = balance * factor;
    }
    setPayAmount(amount.toFixed(2));
  };

  // ── Association check (single token) ──────────────────────────────────────────────
  const checkTokenAssociation = async (accId: string, tokenIdStr: string): Promise<boolean> => {
    try {
      if (tokenIdStr === "HBAR") return true;
      // Mirror node accepts both 0x EVM address and 0.0.X Hedera ID
      const url = `${MIRROR_NODE_BASE}/accounts/${accId}/tokens?token.id=${tokenIdStr}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      const isAssociated = (data?.tokens?.length ?? 0) > 0;
      console.log(`[Wagerswap] Association check for ${tokenIdStr}:`, isAssociated);
      return isAssociated;
    } catch (e) {
      console.log("[Wagerswap] Association check error:", e);
      return false;
    }
  };

  // ── Batch association guardrail (loops through entire route) ──────────────────────
  const ensureAllAssociated = async (accId: string, tokensToCheck: Token[]): Promise<void> => {
    const toAssociate: string[] = [];
    for (const token of tokensToCheck) {
      if (token.type === "native" || token.tokenId === "HBAR") continue;
      const associated = await checkTokenAssociation(accId, token.tokenId);
      if (!associated) {
        console.log(`[Wagerswap] Queuing association for ${token.symbol} (${token.tokenId})`);
        // Convert Hedera token ID (0.0.X) to EVM address (0x...)
        const parts = token.tokenId.split('.');
        const num = BigInt(parts[2]);
        const evmAddress = "0x" + num.toString(16).padStart(40, '0');
        toAssociate.push(evmAddress);
      }
    }
    if (toAssociate.length === 0) return;

    setSwapStatus("associating");
    console.log(`[Wagerswap] Associating ${toAssociate.length} token(s) via HTS Precompile...`);
    
    // CRITICAL FIX: associateTokens is a STATE-CHANGING function on the HTS precompile.
    // We must NOT use the standard ABI string because ethers.js will detect the int64 return
    // type and make it a static CALL (which Hedera rejects with LOCAL_CALL_MODIFICATION_EXCEPTION).
    // Instead, use executeEVMSmartContract which forces a transaction via sendTransaction.
    const assocRes = await executeEVMSmartContract(
      HTS_PRECOMPILE_ADDRESS,
      // Use non-payable ABI with explicit return type suppressed to force tx (not static call)
      ["function associateTokens(address account, address[] memory tokens) external"],
      "associateTokens",
      [accId, toAssociate]
    );

    if (!assocRes || assocRes.status !== "SUCCESS") {
      throw new Error("Token association rejected. Please approve in your wallet and retry.");
    }
    console.log("[Wagerswap] ✅ Batch association confirmed:", assocRes.txId);
  };

  // ── Main executeSwap ─────────────────────────────────────────────────────────────────────────
  const executeSwap = async () => {
    if (!isConnected || !accountId) {
      setSwapError("Link HashPack first.");
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
      // ── Step 1: ERC20 approval
      if (requiresApproval && !isApproved) {
        setSwapStatus("associating");
        
        let tokenEVMAddress = payToken.tokenId;
        if (tokenEVMAddress.includes(".")) {
           const parts = tokenEVMAddress.split('.');
           const num = BigInt(parts[2]);
           tokenEVMAddress = "0x" + num.toString(16).padStart(40, '0');
        }
        
        const decimals = TOKEN_DECIMALS[payToken.symbol] ?? payToken.decimals;
        const amountInTokens = Math.floor(parseFloat(payAmount) * Math.pow(10, decimals));

        const appRes = await executeEVMSmartContract(
          tokenEVMAddress,
          ERC20_ABI,
          "approve",
          [MOCK_WAGER_SWAP_POOL_ADDRESS, amountInTokens.toString()]
        );
        
        if (!appRes || appRes.status !== "SUCCESS") {
          throw new Error("Approval rejected or failed.");
        }

        setIsApproved(true);
        setSwapStatus("idle");
        setIsProcessing(false);
        return;
      }

      // ── Step 2: Batch-check + associate ALL tokens in the route ────────────────
      const tokensToAssociate = route.slice(1); // everything except the pay token
      await ensureAllAssociated(accountId, tokensToAssociate);

      // ── Step 3: Build the swap transaction ──────────────────────────────────
      setSwapStatus("swapping");
      let res;

      // 🟢 Calculate minAmountOut based on slippage
      const receiveAmountStr = getReceiveAmount();
      const receiveAmountFloat = parseFloat(receiveAmountStr) || 0;
      const slippagePercent = parseFloat(slippage) || 0.5;
      const minAmountOutFloat = receiveAmountFloat * (1 - (slippagePercent / 100));
      
      const rDecimals = TOKEN_DECIMALS[receiveToken.symbol] ?? receiveToken.decimals;
      const minAmountOutTokens = Math.floor(minAmountOutFloat * Math.pow(10, rDecimals)).toString();

      const decimals = TOKEN_DECIMALS[payToken.symbol] ?? payToken.decimals;
      const amountInTokens = Math.floor(parseFloat(payAmount) * Math.pow(10, decimals));

      const isOracleRoute = (payToken.symbol === "HBAR" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT")) ||
                            ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "HBAR");
      
      let priceUpdateData: string[] = [];
      let pythFee = 0n;
      
      if (isOracleRoute) {
        try {
          // Pyth HBAR/USD feed ID – the ONLY ID Hermes-Beta (testnet) recognises for HBAR/USD
          // Verified by forensic audit: 0x83eb07... is UNKNOWN to hermes-beta; this ID returns live data.
          const HBAR_USD_FEED = "0xf2ef5dc6156e6cdccda6c315f3fc6de2bf37e9aecbc9b5efc51de98096c3e7c6";
          const pythUrl = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${HBAR_USD_FEED}`;
          console.log(`[Wagerswap] Fetching Pyth Data: ${pythUrl}`);
          const pythRes = await fetch(pythUrl);
          if (!pythRes.ok) throw new Error(`Failed to fetch Pyth data: ${pythRes.status}`);
          const pythJson = await pythRes.json();
          priceUpdateData = pythJson.binary.data.map((d: string) => "0x" + d);
          
          // Dynamically fetch the required Pyth fee for this specific update payload
          const pythProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
          const pythContract = new ethers.Contract(
            "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
            ["function getUpdateFee(bytes[] memory updateData) public view returns (uint256 feeAmount)"],
            pythProvider
          );
          pythFee = await pythContract.getUpdateFee(priceUpdateData);
          console.log(`[Wagerswap] Pyth Update Fee fetched: ${ethers.formatEther(pythFee)} HBAR`);
        } catch (err) {
          throw new Error("Failed to fetch live oracle price. Try again.");
        }
      }

      if (payToken.symbol === "HBAR") {
        const msgValue = pythFee > 0 ? (ethers.parseEther(payAmount) + pythFee).toString() : payAmount;
        res = await executeEVMSmartContract(
          MOCK_WAGER_SWAP_POOL_ADDRESS,
          WAGER_SWAP_POOL_ABI,
          "swapHbarForToken",
          [receiveToken.symbol, minAmountOutTokens, priceUpdateData],
          pythFee > 0 ? ethers.formatEther(msgValue) : payAmount
        );
      } else if (receiveToken.symbol === "HBAR") {
        console.log(`[Wagerswap] Swap Pool Call | MinOut: ${minAmountOutTokens}`);
        res = await executeEVMSmartContract(
          MOCK_WAGER_SWAP_POOL_ADDRESS,
          WAGER_SWAP_POOL_ABI,
          "swapTokenForHbar",
          [payToken.symbol, amountInTokens.toString(), minAmountOutTokens, priceUpdateData],
          pythFee > 0n ? ethers.formatEther(pythFee) : undefined
        );
      } else {
        console.log(`[Wagerswap] Token->Token Pool Call | MinOut: ${minAmountOutTokens}`);
        res = await executeEVMSmartContract(
          MOCK_WAGER_SWAP_POOL_ADDRESS,
          WAGER_SWAP_POOL_ABI,
          "swapTokenForToken",
          [payToken.symbol, receiveToken.symbol, amountInTokens.toString(), minAmountOutTokens, priceUpdateData]
        );
      }
      
      if (!res || res.status !== "SUCCESS") {
        throw new Error("Swap transaction was rejected by the wallet or failed.");
      }
      
      const txId = res.txId || "Confirmed on-chain (duplicate tx recovered)";

      // Smart contract handles payout directly for all token types.

      // ── Step 5: Success & Reward Calculation ───────────────────────────────
      setSwapStatus("success");

      console.log("[Wagerswap] ✅ Swap successful. Tx ID:", txId);
      
      const usdEquivalentValue = parseFloat(payAmount) * (pricesUsd[payToken.symbol] || 0);
      const todayGMT = new Date().toISOString().split('T')[0];
      const lastBonusDate = localStorage.getItem(`wagerHub_daily_bonus_date_${accountId}`);

      let earnedPoints = 0;

      if (usdEquivalentValue >= 10.00 && lastBonusDate !== todayGMT) {
        // Daily $10 Bonus Hit!
        earnedPoints = 5000;
        localStorage.setItem(`wagerHub_daily_bonus_date_${accountId}`, todayGMT);
        console.log(`[Wagerswap] 🏆 MASSIVE BONUS AWARDED! 5,000 Points for first $10+ swap today.`);
      } else {
        // Baseline volume reward
        earnedPoints = Math.floor(usdEquivalentValue * 250);
        console.log(`[Wagerswap] 🪙 Baseline reward awarded: ${earnedPoints} Points for $${usdEquivalentValue.toFixed(2)} volume.`);
      }

      addWagerPoints(earnedPoints);
      
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#CCFF00', '#00FFFF']
      });

      // (HCS log-score submission is now automatically handled inside addWagerPoints context)

      setLastEarnedCredits(earnedPoints);
      setLastTxId(txId);
      setSwapStatus("success");
      setPayAmount("");
      setIsApproved(false);

      refreshBalances();
      setTimeout(() => refreshBalances(), 3000);

    } catch (err: unknown) {
      console.log("[Wagerswap] ❌ Swap error:", err);
      let message = "Swap failed. Check console for the Hedera ResponseCode.";
      if (err instanceof Error) {
        message = err.message;
        if (message.includes("TOKEN_NOT_ASSOCIATED_TO_ACCOUNT")) {
          message = `${receiveToken.symbol} not associated. Please retry — association will be triggered automatically.`;
        } else if (message.includes("INSUFFICIENT_PAYER_BALANCE")) {
          message = "Insufficient balance to cover gas + swap amount.";
        } else if (message.includes("INSUFFICIENT_GAS")) {
          message = "Gas too low. Contact support — gas is set to 4M.";
        } else if (message.includes("CONTRACT_REVERT_EXECUTED")) {
          const isOracleRoute = (payToken.symbol === "HBAR" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT")) ||
                                ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "HBAR");
          const isBlockedRoute = ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "$WAGER") ||
                                 (payToken.symbol === "$WAGER" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT"));
          if (isBlockedRoute) {
            message = "Stablecoin to WAGER swaps are explicitly blocked by the Hybrid Router.";
          } else if (isOracleRoute) {
            message = "Oracle Route reverted. Possible reasons: Pyth Price Update failed, or Treasury lacks sufficient USDC/USDT/HBAR liquidity.";
          } else {
            message = "Router contract reverted. Slippage too high or pool has insufficient liquidity.";
          }
        }
      }
      setSwapError(message);
      setSwapStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const flipTokens = () => {
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
                  <h4 className="text-white text-sm font-black tracking-tight uppercase">12-Hourly WagerPoint Claim</h4>
                  <p className="text-cyan-400/80 text-[11px] uppercase font-black tracking-tighter">Claim your 50 WagerPoints reward</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsClaimed(true);
                  if (isConnected) addWagerPoints(50);
                }}
                className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20"
              >
                CLAIM
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The massive DeFi Terminal card */}
      <div className="relative glass-card p-8 md:p-10 overflow-hidden">
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
                onChange={(e) => setPayAmount(e.target.value)}
                className="bg-transparent text-6xl font-mono text-white outline-none placeholder:text-zinc-800 w-full"
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
                    <img src={payToken.iconUrl} alt={payToken.symbol} className="w-6 h-6 rounded-full" />
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
                      className="absolute top-full right-0 mt-3 w-64 bg-wager-charcoal border-2 border-wager-cyan/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-72 z-50 custom-scrollbar"
                    >
                      {TOKENS.map((token) => (
                        <button
                          key={token.id}
                          disabled={token.symbol === receiveToken.symbol || 
                                    ((token.symbol === "USDC" || token.symbol === "USDT") && receiveToken.symbol === "$WAGER") ||
                                    (token.symbol === "$WAGER" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT"))}
                          onClick={() => {
                            setPayToken(token);
                            setIsPayTokenSelectorOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left border-b border-white/5 last:border-0 ${
                            (token.symbol === receiveToken.symbol || 
                             ((token.symbol === "USDC" || token.symbol === "USDT") && receiveToken.symbol === "$WAGER") ||
                             (token.symbol === "$WAGER" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT"))) 
                               ? 'opacity-30 cursor-not-allowed bg-black/40' : 'hover:bg-wager-cyan/10 cursor-pointer'
                          }`}
                        >
                          <img src={token.iconUrl} alt={token.symbol} className="w-6 h-6 rounded-full" />
                          <span className="font-black text-xl text-white">{token.symbol}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Pay Balance and Quick Selectors */}
            <div className="flex justify-between items-center mt-6 px-1 border-t border-white/5 pt-4">
              <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-tighter">
                Balance: <span className="text-white/60 ml-1">{getBalanceForToken(payToken.symbol)} {payToken.symbol}</span>
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
                    <img src={receiveToken.iconUrl} alt={receiveToken.symbol} className="w-6 h-6 rounded-full" />
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
                      className="absolute top-full right-0 mt-3 w-64 bg-wager-charcoal border-2 border-wager-lime/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-72 z-50 custom-scrollbar"
                    >
                      {TOKENS.map((token) => (
                        <button
                          key={token.id}
                          disabled={token.symbol === payToken.symbol || 
                                    ((token.symbol === "USDC" || token.symbol === "USDT") && payToken.symbol === "$WAGER") ||
                                    (token.symbol === "$WAGER" && (payToken.symbol === "USDC" || payToken.symbol === "USDT"))}
                          onClick={() => {
                            setReceiveToken(token);
                            setIsReceiveTokenSelectorOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left border-b border-white/5 last:border-0 ${
                            (token.symbol === payToken.symbol || 
                             ((token.symbol === "USDC" || token.symbol === "USDT") && payToken.symbol === "$WAGER") ||
                             (token.symbol === "$WAGER" && (payToken.symbol === "USDC" || payToken.symbol === "USDT"))) 
                               ? 'opacity-30 cursor-not-allowed bg-black/40' : 'hover:bg-wager-lime/10 cursor-pointer'
                          }`}
                        >
                          <img src={token.iconUrl} alt={token.symbol} className="w-6 h-6 rounded-full" />
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
            
            {/* Receive Balance */}
            <div className="flex items-center mt-6 px-1 border-t border-white/5 pt-4 text-white/30 text-[10px] font-bold uppercase tracking-tighter">
              Balance: <span className="text-wager-lime/60 ml-2">{getBalanceForToken(receiveToken.symbol)} {receiveToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Live Exchange Rate Ticker */}
        <div className="mt-8 bg-wager-black border border-white/5 rounded-xl overflow-hidden">
          {/* Top row: live indicator + rate */}
          <div className="px-4 py-3 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  oracleSource === "live" ? "bg-green-400" : "bg-amber-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  oracleSource === "live" ? "bg-green-500" : "bg-amber-500"
                }`}></span>
              </span>
              <span className={`uppercase tracking-widest font-bold ${
                oracleSource === "live" ? "text-green-400" : "text-amber-400"
              }`}>
                {oracleSource === "live" ? "Live Rate" : "Fallback Rate"}
              </span>
              {oracleUpdatedAt && (
                <span className="text-[9px] text-zinc-600 font-mono normal-case">
                  • {new Date(oracleUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              )}
            </div>
            <div className="font-bold text-white text-sm">
              1 {payToken.symbol} ≈ <span className="text-wager-lime">{exchangeRate}</span> {receiveToken.symbol}
            </div>
          </div>

          {/* Bottom row: live USD reference prices */}
          <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Ref Prices</span>
            <div className="flex items-center gap-5">
              {Object.entries(pricesUsd).map(([sym, usd]) => (
                <span key={sym} className="flex items-center gap-1 text-[10px] font-mono">
                  <span className="text-zinc-500">{sym}</span>
                  <span className="text-zinc-300">${usd.toFixed(sym === '$WAGER' ? 5 : sym === 'HBAR' ? 4 : 4)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Direct pool label */}
        <div className="mt-3 px-4 flex items-center justify-between text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
          <span className="text-cyan-400/60 font-bold">Direct Pool</span>
          <div className="flex items-center gap-2">
            <img src={payToken.iconUrl} alt={payToken.symbol} className="w-3 h-3 rounded-full" />
            <span className="text-white/40">{payToken.symbol}</span>
            <span className="text-zinc-700">→</span>
            <img src={receiveToken.iconUrl} alt={receiveToken.symbol} className="w-3 h-3 rounded-full" />
            <span className="text-wager-lime/60">{receiveToken.symbol}</span>
          </div>
        </div>

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
          {(() => {
            const numAmount = parseFloat(payAmount) || 0;
            const currentBalance = getNumericBalance(payToken.symbol);
            const isInsufficientBalance = numAmount > currentBalance;
            const isBlockedRoute = ((payToken.symbol === "USDC" || payToken.symbol === "USDT") && receiveToken.symbol === "$WAGER") ||
                                   (payToken.symbol === "$WAGER" && (receiveToken.symbol === "USDC" || receiveToken.symbol === "USDT"));

            return (
              <motion.button
                whileHover={!isProcessing && !isInsufficientBalance && !isBlockedRoute ? { scale: 1.01 } : {}}
                whileTap={!isProcessing && !isInsufficientBalance && !isBlockedRoute ? { scale: 0.99 } : {}}
                onClick={executeSwap}
                disabled={!payAmount || isProcessing || !isConnected || isInsufficientBalance || isBlockedRoute}
                className={`w-full font-black uppercase tracking-widest py-6 rounded-3xl transition-all text-2xl flex items-center justify-center gap-3
                  ${!isConnected
                    ? 'bg-wager-charcoal text-zinc-500 cursor-not-allowed border-2 border-white/5'
                    : isBlockedRoute
                    ? 'bg-wager-charcoal text-wager-red/50 cursor-not-allowed border-2 border-wager-red/20'
                    : !payAmount
                    ? 'bg-wager-charcoal text-zinc-600 cursor-not-allowed border-2 border-white/5'
                    : isProcessing
                    ? 'bg-wager-charcoal text-zinc-400 cursor-wait border-2 border-white/10'
                    : isInsufficientBalance
                    ? 'bg-wager-charcoal text-wager-red cursor-not-allowed border-2 border-wager-red/50'
                    : (requiresApproval && !isApproved)
                    ? 'bg-amber-400 text-black shadow-[0_0_30px_rgba(251,191,36,0.3)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] border-2 border-amber-300'
                    : 'bg-wager-cyan text-black shadow-[0_0_30px_rgba(0,255,255,0.3)] hover:shadow-[0_0_50px_rgba(0,255,255,0.5)] border-2 border-cyan-300'
                  }`}
              >
                {!isConnected ? (
                  <>Link HashPack to Swap</>
                ) : isBlockedRoute ? (
                  <>Route Blocked by Router</>
                ) : isInsufficientBalance ? (
                  <>INSUFFICIENT {payToken.symbol} BALANCE</>
                ) : isProcessing && swapStatus === "associating" ? (
                  <><Loader2 size={24} className="animate-spin" /> Associating {receiveToken.symbol} Token...</>
                ) : isProcessing && swapStatus === "swapping" ? (
                  <><Loader2 size={24} className="animate-spin" /> Awaiting Wallet Approval...</>
                ) : isProcessing && swapStatus === "payout" ? (
                  <><Loader2 size={24} className="animate-spin" /> Processing Backend Payout...</>
                ) : isProcessing ? (
                  <><Loader2 size={24} className="animate-spin" /> Processing...</>
                ) : (requiresApproval && !isApproved) ? (
                  <>Approve {payToken.symbol}</>
                ) : (
                  <>Execute Swap <CheckCircle2 size={28} /></>
                )}
              </motion.button>
            );
          })()}
          {/* Wallet not connected nudge */}
          {!isConnected && (
            <p className="text-center text-xs font-mono text-zinc-600 mt-3">
              Link HashPack via the top menu to enable swaps
            </p>
          )}
        </div>
      </div>

      <HCSLiveFeed />
    </div>
  );
}
