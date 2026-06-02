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
  // Passing WC_PROJECT_ID explicitly so the relay uses the verified project ID.
  const [hashconnect] = useState(
    () => new HashConnect(LedgerId.TESTNET, WC_PROJECT_ID, appMetadata, false)
  );

  // ── Initialization lock ───────────────────────────────────────────────────
  // React Strict Mode mounts → unmounts → remounts every component in dev.
  // Without this guard, hashconnect.init() gets called twice concurrently,
  // producing "WalletConnect Core is already initialized" errors and timeouts.
  // We use a ref (not state) so it persists across the remount cycle without
  // triggering a re-render. We intentionally do NOT reset it in the cleanup
  // function — resetting would just let Strict Mode fire the double-init again.
  const isInitStarted = useRef(false);

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
    // Guard against Strict Mode double-fire and any other re-render that
    // might call this effect again. Once set, init never runs a second time.
    if (isInitStarted.current) return;
    isInitStarted.current = true;
    // ─────────────────────────────────────────────────────────────────────────

    let isMounted = true;

    // ── STEP 1: Register ALL event listeners BEFORE init() ───────────────────
    // HashConnect v3 fires pairingEvent and connectionStatusChangeEvent
    // DURING init() to restore existing sessions. Registering after init()
    // means those events are missed permanently.

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

    // ── STEP 2: Silently suppress EVM provider noise ──────────────────────────
    // WalletConnect's SDK scans for window.ethereum on startup (it's designed
    // for EVM chains). WagerHub is Hedera-only — we suppress this silently.
    const evmRejectionHandler = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || String(event?.reason || "");
      if (
        msg.includes("MetaMask") ||
        msg.includes("extension not found") ||
        msg.includes("ethereum") ||
        msg.includes("No injected provider") ||
        msg.includes("EVM provider not used")
      ) {
        event.preventDefault();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", evmRejectionHandler);
    }

    // ── STEP 3: Intercept window.ethereum.request to prevent hang ────────────
    // WalletConnect probes window.ethereum during init. If MetaMask is installed
    // it tries to connect, stalling the relay handshake. We override .request()
    // to reject instantly, then restore it after init completes.
    let originalEthRequest: any = undefined;
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        originalEthRequest = (window as any).ethereum.request;
        (window as any).ethereum.request = () =>
          Promise.reject(new Error("EVM provider not used in this application."));
      } catch (_) {}
    }

    // ── STEP 4: Purge corrupted WalletConnect cache ───────────────────────────
    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage);
        const hasCorrupted = keys.some((k) => {
          const v = localStorage.getItem(k) || "";
          return (
            (k.includes("walletconnect") || k.includes("hashconnect")) &&
            v.includes("undefined")
          );
        });
        if (hasCorrupted) {
          keys.forEach((k) => {
            if (
              k.toLowerCase().includes("walletconnect") ||
              k.toLowerCase().includes("hashconnect")
            ) {
              localStorage.removeItem(k);
            }
          });
          if (window.indexedDB) window.indexedDB.deleteDatabase("walletconnect-v2");
        }
      } catch (_) {}
    }

    // ── STEP 5: init() — single, guarded call ────────────────────────────────
    // Project ID verification: WC_PROJECT_ID is explicitly trimmed at the top
    // of this file and passed as the second arg to the HashConnect constructor.
    // HashConnect.init() uses that stored projectId internally — no need to
    // re-pass it here; it is verified once at construction time.
    const doInit = async () => {
      try {
        await hashconnect.init();

        if (isMounted) {
          setIsInitialized(true);
          // Restore an existing paired session if one is cached
          const saved = hashconnect.connectedAccountIds;
          if (saved?.length > 0) {
            setAccountId(saved[0].toString());
            setIsConnected(true);
          }
        }
      } catch (err: any) {
        // On any init error, still unlock the button — HashPack extension
        // may be able to pair without a fully established relay.
        if (isMounted) setIsInitialized(true);
      } finally {
        // Always restore window.ethereum.request
        if (typeof window !== "undefined" && originalEthRequest) {
          try {
            (window as any).ethereum.request = originalEthRequest;
          } catch (_) {}
        }
        if (isMounted) setIsConnecting(false);
      }
    };

    doInit();

    // Cleanup: mark unmounted so state setters don't fire on stale renders.
    // We do NOT reset isInitStarted.current here — resetting it would allow
    // Strict Mode's remount to trigger a second init() call.
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

  const connect = async () => {
    try {
      setError(null);
      setIsConnecting(true);

      // ── Why generatePairingString() is called first ────────────────────────
      // openPairingModal() reads this._pairingString at its very first line.
      // If it is undefined it immediately logs "hashconnect - URI Missing" and
      // exits — the WalletConnect modal never opens. _pairingString is only
      // populated by the private generatePairingString() method which calls
      // this._signClient.connect() to get a fresh WalletConnect proposal URI.
      // We call it explicitly via a type-cast before openPairingModal() so the
      // URI is always ready.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (hashconnect as any).generatePairingString();

      // Small buffer so HashPack extension can detect the new WalletConnect session
      await new Promise((resolve) => setTimeout(resolve, 300));

      await hashconnect.openPairingModal();
    } catch (err: any) {
      const msg = err?.message || "Failed to connect wallet.";
      if (
        !msg.includes("EVM") &&
        !msg.includes("ethereum") &&
        !msg.includes("MetaMask")
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
