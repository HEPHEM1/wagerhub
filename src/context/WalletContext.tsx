"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { HashConnect, HashConnectConnectionState, SessionData } from "hashconnect";
import { LedgerId, Transaction, TransactionId, AccountId, Hbar } from "@hashgraph/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";

// ─── Constants ────────────────────────────────────────────────────────────────
// Hardcoded for stability until Vercel environment propagation is confirmed
const WC_PROJECT_ID = "37016fd71f4d35906f67ec93aa5225ec";
const WAGER_TOKEN_ID = "0.0.8818191";
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

const appMetadata = {
  name: "WagerHub",
  description: "Universal Web3 Arcade and DeFi Terminal on Hedera.",
  icons: ["https://wagerhub.vercel.app/logo.png"],
  url: "https://wagerhub.vercel.app", // Matching Reown allowlist exactly
};

// Create a singleton instance of HashConnect
export const hashconnect = new HashConnect(LedgerId.TESTNET, WC_PROJECT_ID, appMetadata, true);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WalletBalances {
  hbar: string;
  wager: string;
}

export interface WalletContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  accountId: string | null;
  network: string | null;
  wagerCredits: number;
  balances: WalletBalances;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  addWagerCredits: (amount: number) => void;
  executeTransaction: (transaction: Transaction) => Promise<{ txId: string | null; status: string | null } | null>;
  refreshBalances: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const defaultBalances: WalletBalances = { hbar: "0.00", wager: "0.00" };

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  isConnecting: false,
  accountId: null,
  network: null,
  wagerCredits: 0,
  balances: defaultBalances,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
  addWagerCredits: () => {},
  executeTransaction: async () => null,
  refreshBalances: async () => {},
});

// ─── Mirror Node Helpers ──────────────────────────────────────────────────────
async function fetchHbarBalance(accountId: string): Promise<string> {
  try {
    const res = await fetch(`${MIRROR_NODE_BASE}/accounts/${accountId}`);
    if (!res.ok) throw new Error(`Mirror Node HTTP ${res.status}`);
    const data = await res.json();
    const tinybars: number = data?.balance?.balance ?? 0;
    return (tinybars / 1e8).toFixed(2);
  } catch (e) {
    console.warn("[WagerWallet] fetchHbarBalance error:", e);
    return "0.00";
  }
}

async function fetchWagerBalance(accountId: string): Promise<string> {
  try {
    const url = `${MIRROR_NODE_BASE}/accounts/${accountId}/tokens?token.id=${WAGER_TOKEN_ID}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mirror Node token HTTP ${res.status}`);
    const data = await res.json();

    const entry = data?.tokens?.[0];
    if (!entry) return "0.00";

    const raw: number = entry.balance ?? 0;
    const decimals: number = entry.decimals ?? 8;
    return (raw / Math.pow(10, decimals)).toFixed(2);
  } catch (e) {
    console.warn("[WagerWallet] fetchWagerBalance error:", e);
    return "0.00";
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>("testnet");
  const [wagerCredits, setWagerCredits] = useState<number>(0);
  const [balances, setBalances] = useState<WalletBalances>(defaultBalances);
  const [error, setError] = useState<string | null>(null);

  // Initialize HashConnect
  useEffect(() => {
    let isMounted = true;

    const setupHashConnect = async () => {
      try {
        console.log("CRITICAL AUDIT - PROJECT ID:", process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "Hardcoded: " + WC_PROJECT_ID);
        console.log("CRITICAL AUDIT - METADATA URL:", typeof window !== "undefined" ? window.location.origin : "SSR");

        // ── Silence MetaMask/EVM wallet-detection noise from WalletConnect ──
        if (typeof window !== "undefined") {
          window.addEventListener("unhandledrejection", (event) => {
            const msg = event?.reason?.message || "";
            if (
              msg.includes("MetaMask") ||
              msg.includes("extension not found") ||
              msg.includes("ethereum") ||
              msg.includes("No injected provider")
            ) {
              event.preventDefault();
              console.debug("[WagerWallet] Suppressed EVM wallet-detection noise:", msg);
            }
          });
        }

        await hashconnect.init();

        // Check if there is an existing pairing
        const savedData = hashconnect.connectedAccountIds;
        if (savedData && savedData.length > 0) {
          if (isMounted) {
            setAccountId(savedData[0].toString());
            setIsConnected(true);
            setError(null); // Clear any cached errors
          }
        }
      } catch (err) {
        console.error("HashConnect init error:", err);
      } finally {
        if (isMounted) setIsConnecting(false);
      }
    };

    setupHashConnect();

    // Listeners
    hashconnect.pairingEvent.on((pairingData) => {
      if (isMounted && pairingData.accountIds.length > 0) {
        setAccountId(pairingData.accountIds[0].toString());
        setIsConnected(true);
        setError(null); // Clear error on successful pair
      }
    });

    hashconnect.disconnectionEvent.on(() => {
      if (isMounted) {
        setAccountId(null);
        setIsConnected(false);
        setBalances(defaultBalances);
        setError(null); // Clear error on disconnect
      }
    });

    hashconnect.connectionStatusChangeEvent.on((state) => {
      if (isMounted) {
        if (state === HashConnectConnectionState.Connecting) {
          setIsConnecting(true);
        } else {
          setIsConnecting(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load WagerCredits from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wagerHub_credits");
      if (stored) {
        setWagerCredits(parseInt(stored, 10));
      }
    } catch (e) {
      console.warn("Could not read wagerHub_credits from localStorage", e);
    }
  }, []);

  const addWagerCredits = (amount: number) => {
    setWagerCredits((prev) => {
      const newVal = prev + amount;
      try {
        localStorage.setItem("wagerHub_credits", newVal.toString());
      } catch (e) {}
      
      // Attempt silent HCS sync via our API route
      if (accountId) {
        fetch("/api/log-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, earnedCredits: amount }),
        }).catch(err => console.warn("Background HCS sync failed:", err));
      }

      return newVal;
    });
  };

  // Refresh Balances
  const refreshBalances = async () => {
    if (!accountId) {
      setBalances(defaultBalances);
      return;
    }
    const [h, w] = await Promise.all([
      fetchHbarBalance(accountId),
      fetchWagerBalance(accountId),
    ]);
    setBalances({ hbar: h, wager: w });
  };

  useEffect(() => {
    if (isConnected && accountId) {
      refreshBalances();
    } else {
      setBalances(defaultBalances);
    }
  }, [isConnected, accountId]);

  // Connect & Disconnect
  const connect = async () => {
    try {
      setError(null);
      await hashconnect.openPairingModal();
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet.");
    }
  };

  const disconnect = async () => {
    try {
      await hashconnect.disconnect();
      setAccountId(null);
      setIsConnected(false);
    } catch (err: any) {
      console.warn("Disconnect error:", err);
    }
  };

  // Execute Transaction
  const executeTransaction = async (transaction: Transaction): Promise<{ txId: string | null; status: string | null } | null> => {
    if (!isConnected || !accountId) {
      setError("Wallet not connected.");
      return null;
    }

    try {
      const accountIdObj = AccountId.fromString(accountId);

      // ─── Step 1: Freeze with valid TransactionId, multiple nodes & fee cap ──
      if (!transaction.isFrozen()) {
        if (!transaction.transactionId) {
          transaction.setTransactionId(TransactionId.generate(accountIdObj));
        }
        if (!transaction.nodeAccountIds || transaction.nodeAccountIds.length === 0) {
          // Use multiple Hedera testnet nodes to avoid 400 errors from a single overloaded node
          transaction.setNodeAccountIds([
            AccountId.fromString("0.0.3"),
            AccountId.fromString("0.0.4"),
            AccountId.fromString("0.0.5"),
          ]);
        }
        // Ensure a max fee is always set to prevent INSUFFICIENT_TX_FEE errors
        transaction.setMaxTransactionFee(Hbar.fromTinybars(2_000_000));
        transaction.freeze();
      }

      // ─── Step 2: Use the V3 Signer Implementation ───────────────────────
      // @ts-ignore - version mismatch between SDK 2.81 and 2.41
      const signer = hashconnect.getSigner(accountIdObj as any);

      console.log("[WagerWallet] Executing transaction with Signer...");

      // @ts-ignore - version mismatch
      const response = await transaction.executeWithSigner(signer);

      console.log("[WagerWallet] Transaction response:", response);
      return {
        txId: response.transactionId ? response.transactionId.toString() : null,
        status: "SUCCESS"
      };
    } catch (error: any) {
      const msg: string = error?.message || String(error);

      // Suppress MetaMask noise — WalletConnect probes for EVM wallets internally
      if (
        msg.includes("MetaMask") ||
        msg.includes("extension not found") ||
        msg.includes("No injected provider")
      ) {
        console.debug("[WagerWallet] Suppressed EVM detection noise inside executeTransaction:", msg);
        // Do NOT return null here — this isn't a real failure.
        // Fall through: if response was obtained before this, it would have returned already.
        // If we hit this it means the tx itself failed at a different layer — surface it.
      }

      console.error("[WagerWallet] TRANSACTION FAILURE details:", {
        message: msg,
        name: error?.name,
        stack: error?.stack?.slice(0, 500),
      });
      setError(msg || "Transaction failed.");
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isConnecting,
        accountId,
        network,
        wagerCredits,
        balances,
        error,
        connect,
        disconnect,
        addWagerCredits,
        executeTransaction,
        refreshBalances,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWalletContext = () => useContext(WalletContext);
