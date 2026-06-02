"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { HashConnect, HashConnectConnectionState } from "hashconnect";
import { LedgerId, Transaction, TransactionId, AccountId, Hbar } from "@hashgraph/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";

// ─── Constants ────────────────────────────────────────────────────────────────
const WC_PROJECT_ID = (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "37016fd71f4d35906f67ec93aa5225ec").trim();
const WAGER_TOKEN_ID = "0.0.8818191";
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

const appMetadata = {
  name: "WagerHub",
  description: "Universal Web3 Arcade and DeFi Terminal on Hedera.",
  icons: ["https://wagerhub.vercel.app/logo.png"],
  url: "https://wagerhub.vercel.app",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WalletBalances {
  hbar: string;
  wager: string;
}

export interface WalletContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  isInitialized: boolean;
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
  isConnecting: true,
  isInitialized: false,
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [network] = useState<string | null>("testnet");
  const [wagerCredits, setWagerCredits] = useState<number>(0);
  const [balances, setBalances] = useState<WalletBalances>(defaultBalances);
  const [error, setError] = useState<string | null>(null);
  const [hashconnect] = useState(() => new HashConnect(LedgerId.TESTNET, WC_PROJECT_ID, appMetadata, true));

  // Load WagerCredits from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wagerHub_credits");
      if (stored) setWagerCredits(parseInt(stored, 10));
    } catch (e) {
      console.warn("Could not read wagerHub_credits from localStorage", e);
    }
  }, []);

  // ── Initialize HashConnect (correct order: listeners FIRST, then init) ──────
  useEffect(() => {
    let isMounted = true;

    // ── STEP 1: Register ALL event listeners BEFORE calling init() ────────────
    // Required by HashConnect v3 — events fire during init() to restore sessions.

    hashconnect.pairingEvent.on((pairingData) => {
      if (!isMounted) return;
      if (pairingData.accountIds && pairingData.accountIds.length > 0) {
        setAccountId(pairingData.accountIds[0].toString());
        setIsConnected(true);
        setError(null);
      }
    });

    hashconnect.disconnectionEvent.on(() => {
      if (!isMounted) return;
      setAccountId(null);
      setIsConnected(false);
      setBalances(defaultBalances);
      setError(null);
    });

    hashconnect.connectionStatusChangeEvent.on((state) => {
      if (!isMounted) return;
      if (state === HashConnectConnectionState.Connecting) {
        setIsConnecting(true);
      } else {
        setIsConnecting(false);
      }
    });

    // ── STEP 2: Silently suppress unhandled EVM promise rejections ────────────
    // WalletConnect's SDK scans for injected EVM providers on page load.
    // We suppress those errors silently — no console noise.
    const evmRejectionHandler = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || String(event?.reason || "");
      if (
        msg.includes("MetaMask") ||
        msg.includes("extension not found") ||
        msg.includes("ethereum") ||
        msg.includes("No injected provider") ||
        msg.includes("explicitly disabled")
      ) {
        event.preventDefault(); // suppress — not relevant to HashPack/Hedera
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", evmRejectionHandler);
    }

    // ── STEP 3: Silently intercept EVM provider to prevent WalletConnect hang ─
    // WalletConnect internally probes window.ethereum. We override .request()
    // to fail instantly so it moves on without hanging. Done silently.
    let originalRequest: any = undefined;
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        originalRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = () =>
          Promise.reject(new Error("EVM provider not used in this application."));
      } catch (e) {}
    }

    // ── STEP 4: Purge corrupted WalletConnect cache if detected ───────────────
    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage);
        const hasCorrupted = keys.some(k => {
          const v = localStorage.getItem(k) || "";
          return (k.includes("walletconnect") || k.includes("hashconnect")) && v.includes("undefined");
        });
        if (hasCorrupted) {
          keys.forEach(k => {
            if (k.toLowerCase().includes("walletconnect") || k.toLowerCase().includes("hashconnect")) {
              localStorage.removeItem(k);
            }
          });
          if (window.indexedDB) window.indexedDB.deleteDatabase("walletconnect-v2");
        }
      } catch (e) {}
    }

    // ── STEP 5: Call init() now that listeners are registered ─────────────────
    const doInit = async () => {
      try {
        // Race init against a 15s timeout.
        // IMPORTANT: Even if the WalletConnect relay is slow to respond,
        // we mark isInitialized=true after timeout so HashPack browser extension
        // can still pair directly — it does not need the relay to be up.
        await Promise.race([
          hashconnect.init(),
          new Promise<void>((resolve) =>
            setTimeout(() => resolve(), 15000) // resolve (not reject) on timeout
          ),
        ]);

        if (isMounted) {
          setIsInitialized(true);

          // Restore session if already paired
          const saved = hashconnect.connectedAccountIds;
          if (saved && saved.length > 0) {
            setAccountId(saved[0].toString());
            setIsConnected(true);
          }
        }
      } catch (err: any) {
        // Even on error, unlock the connect button so HashPack can attempt pairing
        if (isMounted) setIsInitialized(true);
      } finally {
        // Silently restore EVM provider
        if (typeof window !== "undefined" && originalRequest) {
          try {
            (window as any).ethereum.request = originalRequest;
          } catch (e) {}
        }
        if (isMounted) setIsConnecting(false);
      }
    };

    doInit();

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("unhandledrejection", evmRejectionHandler);
      }
    };
  }, [hashconnect]);

  // ── Refresh balances when wallet connects ─────────────────────────────────
  useEffect(() => {
    if (isConnected && accountId) {
      refreshBalances();
    } else {
      setBalances(defaultBalances);
    }
  }, [isConnected, accountId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const connect = async () => {
    if (!isInitialized) {
      setError("Wallet provider is still initializing. Please wait a moment and try again.");
      return;
    }
    try {
      setError(null);
      // 500ms buffer delay to ensure the HashPack extension has settled
      await new Promise(resolve => setTimeout(resolve, 500));
      await hashconnect.openPairingModal();
    } catch (err: any) {
      console.error("[WagerWallet] openPairingModal error:", err);
      setError(err.message || "Failed to open wallet connection modal.");
    }
  };

  const disconnect = async () => {
    try {
      await hashconnect.disconnect();
      setAccountId(null);
      setIsConnected(false);
      setBalances(defaultBalances);
    } catch (err: any) {
      console.warn("[WagerWallet] Disconnect error:", err);
    }
  };

  const addWagerCredits = (amount: number) => {
    setWagerCredits((prev) => {
      const newVal = prev + amount;
      try { localStorage.setItem("wagerHub_credits", newVal.toString()); } catch (e) {}
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

  const refreshBalances = async () => {
    if (!accountId) { setBalances(defaultBalances); return; }
    const [h, w] = await Promise.all([
      fetchHbarBalance(accountId),
      fetchWagerBalance(accountId),
    ]);
    setBalances({ hbar: h, wager: w });
  };

  const executeTransaction = async (transaction: Transaction): Promise<{ txId: string | null; status: string | null } | null> => {
    if (!isConnected || !accountId) {
      setError("Wallet not connected.");
      return null;
    }

    try {
      const accountIdObj = AccountId.fromString(accountId);

      if (!transaction.isFrozen()) {
        if (!transaction.transactionId) {
          transaction.setTransactionId(TransactionId.generate(accountIdObj));
        }
        if (!transaction.nodeAccountIds || transaction.nodeAccountIds.length === 0) {
          transaction.setNodeAccountIds([
            AccountId.fromString("0.0.3"),
            AccountId.fromString("0.0.4"),
            AccountId.fromString("0.0.5"),
          ]);
        }
        transaction.setMaxTransactionFee(Hbar.fromTinybars(2_000_000));
        transaction.freeze();
      }

      console.log("[WagerWallet] Awaiting wallet approval via sendTransaction...");

      const TIMEOUT_MS = 60_000;
      let txSettled = false;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!txSettled) reject(new Error("Transaction timed out. Please check your wallet or reconnect."));
        }, TIMEOUT_MS);
      });

      let response: any;
      try {
        // @ts-ignore
        const txPromise = hashconnect.sendTransaction(accountIdObj as any, transaction as any);
        response = await Promise.race([txPromise, timeoutPromise]);
        txSettled = true;
      } catch (innerErr) {
        txSettled = true;
        throw innerErr;
      }

      console.log("[WagerWallet] Raw response from sendTransaction:", JSON.stringify(response));

      const rawStatus =
        response?.nodeTransactionPrecheckCode ??
        response?.transactionReceipt?.status ??
        response?.receipt?.status ??
        response?.status ??
        response?.statusId;

      const statusStr = rawStatus?.toString();
      if (rawStatus !== undefined && rawStatus !== 22 && statusStr !== "SUCCESS") {
        throw new Error(`Hedera network rejected the transaction. Status: ${statusStr}.`);
      }

      const txId = response?.transactionId
        ? (typeof response.transactionId === "string" ? response.transactionId : response.transactionId.toString())
        : transaction.transactionId?.toString() || null;

      console.log("[WagerWallet] ✅ Transaction confirmed. txId:", txId);
      return { txId, status: "SUCCESS" };
    } catch (error: any) {
      const msg: string = error?.message || String(error);
      if (msg.includes("MetaMask") || msg.includes("extension not found") || msg.includes("No injected provider")) {
        console.debug("[WagerWallet] Suppressed EVM detection noise:", msg);
        return null;
      }
      console.error("TX_EXECUTION_ERROR:", { message: msg, name: error?.name, code: error?.code });
      setError(msg || "Transaction failed.");
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isConnecting,
        isInitialized,
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

// Default export so ClientProviders can import without curly braces
export default WalletProvider;

export const useWalletContext = () => useContext(WalletContext);
export { WalletContext };
