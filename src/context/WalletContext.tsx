"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { HashConnect, HashConnectConnectionState, SessionData } from "hashconnect";
import { LedgerId, Transaction, TransactionId, AccountId, Hbar } from "@hashgraph/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";

// ─── Constants ────────────────────────────────────────────────────────────────
// Hardcoded for relay stability — do NOT swap to an env var without verifying
// the value is registered in WalletConnect Cloud (https://cloud.walletconnect.com).
// An incorrect project ID causes the relay to close with code 3000 (Unauthorized).
const WC_PROJECT_ID = "37016fd71f4d35906f67ec93aa5225ec";
const WAGER_TOKEN_ID = "0.0.8818191";
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

const appMetadata = {
  name: "WagerHub",
  description: "Universal Web3 Arcade and DeFi Terminal on Hedera.",
  icons: ["https://wagerhub.vercel.app/logo.png"],
  url: "https://wagerhub.vercel.app",
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
        console.log("CRITICAL AUDIT - PROJECT ID: Hardcoded 37016fd71f4d35906f67ec93aa5225ec (env var not used)");
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

        // ── Aggressive WalletConnect cache purge on every init ──────────────
        // Stale IndexedDB sessions from previous deployments cause relay sockets
        // to connect with an old/undefined projectId, resulting in 400 errors
        // and hung sendTransaction calls. Purge unconditionally every init.
        if (typeof window !== "undefined") {
          try {
            // 1. Purge localStorage keys
            const keysToRemove = Object.keys(localStorage).filter(k =>
              k.toLowerCase().includes("walletconnect") ||
              k.toLowerCase().includes("hashconnect") ||
              k.toLowerCase().includes("wc@")
            );
            keysToRemove.forEach(k => localStorage.removeItem(k));
            if (keysToRemove.length > 0) {
              console.log(`[WagerWallet] Purged ${keysToRemove.length} stale localStorage keys.`);
            }

            // 2. Purge all known WalletConnect IndexedDB databases
            const dbsToPurge = ["walletconnect-v2", "WALLET_CONNECT_V2_INDEXED_DB", "wc@2"];
            if (window.indexedDB) {
              dbsToPurge.forEach(dbName => {
                const req = window.indexedDB.deleteDatabase(dbName);
                req.onsuccess = () => console.log(`[WagerWallet] Purged IndexedDB: ${dbName}`);
                req.onerror   = () => {}; // silent if db didn't exist
              });
              // Brief pause for IDB ops to settle before hashconnect.init()
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          } catch (e) {
            console.warn("[WagerWallet] Cache purge warning:", e);
          }
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

      // ─── Step 2: Execute via hashconnect.sendTransaction ─────────────────
      console.log("[WagerWallet] Awaiting wallet approval via sendTransaction...");

      // Instead of using the Signer wrapper which can hang or race, we use
      // the native HashConnect v3 sendTransaction method directly.
      const TIMEOUT_MS = 45_000; // 45s — fail fast so user can retry
      let txSettled = false;
      let timedOut = false;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!txSettled) {
            timedOut = true;
            reject(new Error(
              "TX_TIMEOUT: Wallet did not respond in time. " +
              "Please open HashPack and approve the pending request, " +
              "then try again. If stuck, disconnect and reconnect your wallet."
            ));
          }
        }, TIMEOUT_MS);
      });

      let response: any;
      try {
        // @ts-ignore - version mismatch between HashConnect and Hedera SDK
        const txPromise = hashconnect.sendTransaction(accountIdObj as any, transaction as any);
        
        response = await Promise.race([
          txPromise,
          timeoutPromise,
        ]);
        txSettled = true;
      } catch (innerErr) {
        txSettled = true;
        throw innerErr;
      }

      // ── Validate the Hedera network response ──────────────────────────────
      console.log("[WagerWallet] Raw response from sendTransaction:", JSON.stringify(response));

      // Hedera SUCCESS status is numeric 22. 
      const rawStatus =
        response?.nodeTransactionPrecheckCode ??
        response?.transactionReceipt?.status ??
        response?.receipt?.status ??
        response?.status ??
        response?.statusId; // Sometimes returned as statusId by HC

      const statusStr = rawStatus?.toString();

      if (rawStatus !== undefined && rawStatus !== 22 && statusStr !== "SUCCESS") {
        throw new Error(
          `Hedera network rejected the transaction. Status: ${statusStr}. ` +
          `Check your wallet balance and ensure you are not submitting duplicates.`
        );
      }

      const txId = response?.transactionId
        ? (typeof response.transactionId === "string"
          ? response.transactionId
          : response.transactionId.toString())
        : transaction.transactionId?.toString() || null;

      console.log("[WagerWallet] Transaction confirmed on-chain. txId:", txId);
      return { txId, status: "SUCCESS" };
    } catch (error: any) {
      const msg: string = error?.message || String(error);

      // Suppress MetaMask / EVM wallet-detection noise silently
      if (
        msg.includes("MetaMask") ||
        msg.includes("extension not found") ||
        msg.includes("No injected provider")
      ) {
        console.debug("[WagerWallet] Suppressed EVM detection noise:", msg);
        return null;
      }

      // Full raw error for debugging Hedera rejection reasons
      console.error("TX_EXECUTION_ERROR:", error);
      console.error("TX_EXECUTION_ERROR (detail):", {
        message: msg,
        name: error?.name,
        code: error?.code,
        status: error?.status,
        transactionId: error?.transactionId?.toString?.(),
        stack: error?.stack?.slice(0, 800),
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
