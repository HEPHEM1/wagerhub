"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { HashConnect, HashConnectConnectionState } from "hashconnect";
import { LedgerId, Transaction, TransactionId, AccountId, Hbar } from "@hashgraph/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";

// ─── Constants ────────────────────────────────────────────────────────────────
// .trim() guards against accidental trailing spaces entered in the Vercel dashboard.
const WC_PROJECT_ID = (
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "37016fd71f4d35906f67ec93aa5225ec"
).trim();

const WAGER_TOKEN_ID = "0.0.8818191";
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

const appMetadata = {
  name: "WagerHub",
  description: "Universal Web3 Arcade and DeFi Terminal on Hedera.",
  icons: ["https://wagerhub.vercel.app/logo.png"],
  // WalletConnect v2 strictly requires this to match the actual domain in the browser bar.
  // If tested on a Vercel preview link, a hardcoded URL will cause silent init failures!
  url: typeof window !== "undefined" ? window.location.origin : "https://wagerhub.vercel.app",
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
  executeTransaction: (
    transaction: Transaction
  ) => Promise<{ txId: string | null; status: string | null } | null>;
  refreshBalances: () => Promise<void>;
}

// ─── Context defaults ─────────────────────────────────────────────────────────
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

  // Single HashConnect instance — created once for the lifetime of this provider.
  // LedgerId.TESTNET  — WagerHub Season 1 runs on Hedera Testnet.
  // debug: true        — enables WalletConnect relay logs so init failures are visible.
  // WC_PROJECT_ID is trimmed at the top of this file to prevent Vercel whitespace bugs.
  const projectId = WC_PROJECT_ID;
  const [hashconnect, setHashconnect] = useState(
    () => new HashConnect(LedgerId.TESTNET, projectId, appMetadata, true)
  );

  // ── Initialization lock ───────────────────────────────────────────────────
  // React Strict Mode mounts → unmounts → remounts every component in dev.
  // Without this guard, hashconnect.init() gets called twice concurrently,
  // producing "WalletConnect Core is already initialized" errors and timeouts.
  // We use a ref (not state) so it persists across the remount cycle without
  // triggering a re-render. We intentionally do NOT reset it in the cleanup
  // function — resetting would just let Strict Mode fire the double-init again.
  const isInitStarted = useRef(false);
  const initErrorRef = useRef<string | null>(null);

  // Load WagerCredits from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wagerHub_credits");
      if (stored) setWagerCredits(parseInt(stored, 10));
    } catch (e) {
      console.warn("[WagerWallet] Could not read wagerHub_credits:", e);
    }
  }, []);

  // ── Bootstrap HashConnect (listeners FIRST, then init — once only) ────────
  useEffect(() => {
    // ── INITIALIZATION LOCK ───────────────────────────────────────────────────
    if (isInitStarted.current) return;
    isInitStarted.current = true;
    // ─────────────────────────────────────────────────────────────────────────

    let isMounted = true;

    hashconnect.pairingEvent.on((pairingData) => {
      if (!isMounted) return;
      if (pairingData.accountIds?.length > 0) {
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
      setIsConnecting(state === HashConnectConnectionState.Connecting);
    });

    const doInit = async () => {
      try {
        await hashconnect.init();

        if (isMounted) {
          setIsInitialized(true);
          const saved = hashconnect.connectedAccountIds;
          if (saved?.length > 0) {
            setAccountId(saved[0].toString());
            setIsConnected(true);
          }
        }
      } catch (err: any) {
        console.error("[WagerWallet] Background HashConnect init failed:", err);
        initErrorRef.current = err?.message || "Unknown HashConnect initialization error";
        if (isMounted) setIsInitialized(true);
      } finally {
        if (isMounted) setIsConnecting(false);
      }
    };

    doInit();

    return () => {
      isMounted = false;
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
    try {
      setError(null);
      setIsConnecting(true);

      // HashConnect v3 has a known race condition where invoking openPairingModal() too quickly
      // before the extension finishes initializing results in "URI Missing" and a crash.
      // We must add a mandatory delay to give it time to breathe.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Use the official public API to open the WalletConnect modal.
      try {
        await hashconnect.openPairingModal("dark", "#0b121c", "#00ffff", "#00ffff", "16px");
      } catch (modalErr: any) {
        console.error("[WagerWallet] openPairingModal failed:", modalErr);
        if (initErrorRef.current) {
          throw new Error(`WalletConnect Initialization Error: ${initErrorRef.current}`);
        } else {
          throw new Error(`WalletConnect error: ${modalErr?.message || "Unknown error opening pairing modal"}`);
        }
      }

      // HashConnect's openPairingModal catches its own errors internally and fails silently (logging "URI Missing").
      // We can detect this silent failure by checking if the pairingString was populated.
      // NOTE: HashConnect assigns the string literal "undefined testnet" if the URI fails to generate,
      // which is truthy! We must explicitly check for the word "undefined".
      if (!hashconnect.pairingString || hashconnect.pairingString.includes("undefined")) {
        try {
          localStorage.removeItem("hashconnectData");
          localStorage.removeItem("walletconnect");
        } catch (_) {}
        throw new Error("WalletConnect session cache is corrupted (URI Missing). We have automatically cleared the cache. Please refresh the page (Ctrl+F5) to connect.");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to connect wallet.";
      if (
        !msg.includes("EVM") &&
        !msg.includes("ethereum") &&
        !msg.includes("MetaMask") &&
        !msg.includes("already initialized")
      ) {
        setError(msg);
      }
    } finally {
      setIsConnecting(false);
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
      try {
        localStorage.setItem("wagerHub_credits", newVal.toString());
      } catch (_) {}
      if (accountId) {
        fetch("/api/log-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, earnedCredits: amount }),
        }).catch((err) => console.warn("[WagerWallet] HCS sync failed:", err));
      }
      return newVal;
    });
  };

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

  const executeTransaction = async (
    transaction: Transaction
  ): Promise<{ txId: string | null; status: string | null } | null> => {
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

      const TIMEOUT_MS = 60_000;
      let txSettled = false;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!txSettled)
            reject(new Error("Transaction timed out. Please check your wallet or reconnect."));
        }, TIMEOUT_MS);
      });

      let response: any;
      try {
        // @ts-ignore — version mismatch between HashConnect and Hedera SDK types
        const txPromise = hashconnect.sendTransaction(accountIdObj as any, transaction as any);
        response = await Promise.race([txPromise, timeoutPromise]);
        txSettled = true;
      } catch (innerErr) {
        txSettled = true;
        throw innerErr;
      }

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
        ? typeof response.transactionId === "string"
          ? response.transactionId
          : response.transactionId.toString()
        : transaction.transactionId?.toString() || null;

      console.log("[WagerWallet] ✅ Transaction confirmed. txId:", txId);
      return { txId, status: "SUCCESS" };
    } catch (error: any) {
      const msg: string = error?.message || String(error);
      if (
        msg.includes("MetaMask") ||
        msg.includes("extension not found") ||
        msg.includes("No injected provider")
      ) {
        return null; // suppress EVM noise silently
      }
      console.error("[WagerWallet] TX_EXECUTION_ERROR:", {
        message: msg,
        name: error?.name,
        code: error?.code,
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

// Default export for ClientProviders dynamic import (no curly braces needed)
export default WalletProvider;

export const useWalletContext = () => useContext(WalletContext);
export { WalletContext };
