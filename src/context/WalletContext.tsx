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
import { ethers } from "ethers";
import { EVM_WAGER_TOKEN_ADDRESS, ERC20_ABI, HEDERA_TESTNET_CHAIN_ID } from "../evm";

// ─── ONE-TIME CACHE WIPE FOR CORRUPTED PAIRINGS ───────────────────────────────
if (typeof window !== "undefined") {
  const isWiped = localStorage.getItem("wc_wiped_v7");
  if (!isWiped) {
    console.warn("[WagerWallet] Performing hard wipe of corrupted WalletConnect databases...");
    
    // Dynamically find and destroy all WalletConnect/HashConnect related keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.toLowerCase().includes("walletconnect") || key.toLowerCase().includes("hashconnect") || key.toLowerCase().includes("wc@"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    try {
      indexedDB.deleteDatabase("walletconnect-v2.db");
    } catch (e) {}
    localStorage.setItem("wc_wiped_v7", "true");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}


// ─── Constants ────────────────────────────────────────────────────────────────
const WC_PROJECT_ID = "0d8e72911e581a9079dd13f03f7ffb53";

const WAGER_TOKEN_ID = "0.0.8818191";
const USDT_TOKEN_ID = (process.env.NEXT_PUBLIC_USDT_TOKEN_ID || "0.0.12345").trim();
const USDC_TOKEN_ID = (process.env.NEXT_PUBLIC_USDC_TOKEN_ID || "0.0.67890").trim();
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
  usdt: string;
  usdc: string;
}

export interface WalletContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  isInitialized: boolean;
  walletType: "HASHPACK" | "METAMASK" | null;
  accountId: string | null;
  network: string | null;
  wagerPoints: number;
  wagerCredits: number;
  balances: WalletBalances;
  error: string | null;
  connect: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  disconnect: () => Promise<void>;
  addWagerPoints: (amount: number) => void;
  executeTransaction: (
    transaction: Transaction
  ) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMTransfer: (tokenAddress: string, toAddress: string, amountTokens: string) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMHbarTransfer: (toAddress: string, amountHbar: string) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMSmartContract: (contractAddress: string, abi: any[], functionName: string, args: any[], value?: string) => Promise<{ txId: string | null; status: string | null } | null>;
  refreshBalances: () => Promise<void>;
}

// ─── Context defaults ─────────────────────────────────────────────────────────
const defaultBalances: WalletBalances = { hbar: "0.00", wager: "0.00", usdt: "0.00", usdc: "0.00" };

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  isConnecting: true,
  isInitialized: false,
  walletType: null,
  accountId: null,
  network: null,
  wagerPoints: 0,
  wagerCredits: 0,
  balances: defaultBalances,
  error: null,
  connect: async () => {},
  connectMetaMask: async () => {},
  disconnect: async () => {},
  addWagerPoints: () => {},
  executeTransaction: async () => null,
  executeEVMTransfer: async () => null,
  executeEVMHbarTransfer: async () => null,
  executeEVMSmartContract: async () => null,
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

async function fetchTokenBalance(accountId: string, tokenId: string, expectedDecimals: number = 8): Promise<string> {
  try {
    const url = `${MIRROR_NODE_BASE}/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mirror Node token HTTP ${res.status}`);
    const data = await res.json();
    const entry = data?.tokens?.[0];
    if (!entry) return "0.00";
    const raw: number = entry.balance ?? 0;
    const decimals: number = entry.decimals ?? expectedDecimals;
    return (raw / Math.pow(10, decimals)).toFixed(2);
  } catch (e) {
    console.warn(`[WagerWallet] fetchTokenBalance (${tokenId}) error:`, e);
    return "0.00";
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletType, setWalletType] = useState<"HASHPACK" | "METAMASK" | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [network] = useState<string | null>("testnet");
  const [wagerPoints, setWagerPoints] = useState<number>(0);
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
  const isConnectLocked = useRef(false); // Lock to prevent double-clicks from calling openPairingModal twice
  const initErrorRef = useRef<string | null>(null);

  // Load WagerPoints and WagerCredits from localStorage on mount
  useEffect(() => {
    try {
      // Clear legacy wagerHub_credits to force a fresh start per user request
      localStorage.removeItem("wagerHub_credits");

      const storedPoints = localStorage.getItem("wagerHub_points");
      const storedCredits = localStorage.getItem("wagerHub_lifetime_credits");
      
      if (storedPoints) setWagerPoints(parseInt(storedPoints, 10));
      if (storedCredits) setWagerCredits(parseFloat(storedCredits));
    } catch (e) {
      console.warn("[WagerWallet] Could not read local storage points/credits:", e);
    }
  }, []);

  // ── Bootstrap HashConnect (listeners FIRST, then init — once only) ────────
  useEffect(() => {
    let isMounted = true;

    const onPairing = (pairingData: any) => {
      if (!isMounted) return;
      if (pairingData.accountIds?.length > 0) {
        setAccountId(pairingData.accountIds[0].toString());
        setIsConnected(true);
        setError(null);
      }
    };

    const onDisconnect = () => {
      if (!isMounted) return;
      setAccountId(null);
      setIsConnected(false);
      setBalances(defaultBalances);
      setError(null);
    };

    const onConnectionStatus = (state: HashConnectConnectionState) => {
      if (!isMounted) return;
      setIsConnecting(state === HashConnectConnectionState.Connecting);
    };

    hashconnect.pairingEvent.on(onPairing);
    hashconnect.disconnectionEvent.on(onDisconnect);
    hashconnect.connectionStatusChangeEvent.on(onConnectionStatus);

    // ── INITIALIZATION LOCK ───────────────────────────────────────────────────
    if (!isInitStarted.current) {
      isInitStarted.current = true;

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
    }

    return () => {
      isMounted = false;
      hashconnect.pairingEvent.off(onPairing);
      hashconnect.disconnectionEvent.off(onDisconnect);
      hashconnect.connectionStatusChangeEvent.off(onConnectionStatus);
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
    if (isConnectLocked.current) return;
    isConnectLocked.current = true;
    try {
      if (isConnected) return;
      setIsConnecting(true);
      setError(null);

      // If HashConnect is not yet fully initialized, wait for it to generate the pairing string.
      let attempts = 0;
      while (!hashconnect.pairingString && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!hashconnect.pairingString) {
        throw new Error("WalletConnect took too long to initialize. Please refresh the page and try again.");
      }

      // Use the official public API to open the WalletConnect modal.
      try {
        await hashconnect.openPairingModal("dark", "#0b121c", "#00ffff", "#00ffff", "16px");
      } catch (modalErr: any) {
        console.error("[WagerWallet] openPairingModal failed:", modalErr);
        
        // If HashPack says "Pairing already exists", the cache is corrupted. We must clear it.
        if (modalErr?.message?.includes("Pairing already exists") || modalErr?.message?.includes("URI Missing")) {
          try {
            localStorage.removeItem("hashconnectData");
            localStorage.removeItem("walletconnect");
            if (typeof indexedDB !== "undefined") {
              indexedDB.deleteDatabase("walletconnect-v2.db");
            }
          } catch (_) {}
          throw new Error("Stale session detected and cleared. Please refresh the page (Ctrl+F5) and try connecting again.");
        }

        if (initErrorRef.current) {
          throw new Error(`WalletConnect Initialization Error: ${initErrorRef.current}`);
        } else {
          throw new Error(`WalletConnect error: ${modalErr?.message || "Unknown error opening pairing modal"}`);
        }
      }

      // HashConnect's openPairingModal resolves sometimes before it even connects
      // We should not eagerly throw if pairingString is undefined because it might
      // be populated asynchronously by the iframe modal a second later.
      // We will only throw if it explicitly contains the broken "undefined testnet" string
      // AND we are certain no connection is happening.
      if (hashconnect.pairingString && hashconnect.pairingString.trim() === "undefined testnet") {
        try {
          localStorage.removeItem("hashconnectData");
          localStorage.removeItem("walletconnect");
          if (typeof indexedDB !== "undefined") {
            indexedDB.deleteDatabase("walletconnect-v2.db");
          }
        } catch (_) {}
        throw new Error("WalletConnect session cache is corrupted (URI Missing). We have automatically cleared the cache. Please refresh the page (Ctrl+F5) to connect.");
      }
    } catch (err: any) {
      console.error("[WagerWallet] Connection error:", err);
      setError(err.message || "Failed to connect to HashPack.");
      setIsConnecting(false);
      // If we failed to connect completely, clear the local cache just in case
      try {
        localStorage.removeItem("hashconnectData");
        localStorage.removeItem("walletconnect");
        if (typeof indexedDB !== "undefined") {
          indexedDB.deleteDatabase("walletconnect-v2.db");
        }
      } catch (_) {}
    } finally {
      isConnectLocked.current = false;
    }
  };

  const connectMetaMask = async () => {
    if (isConnectLocked.current) return;
    isConnectLocked.current = true;
    try {
      setIsConnecting(true);
      setError(null);
      if (!(window as any).ethereum) {
        throw new Error("MetaMask is not installed.");
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const evmAddress = accounts[0];

      // Switch to Hedera Testnet
      try {
        await provider.send("wallet_switchEthereumChain", [{ chainId: HEDERA_TESTNET_CHAIN_ID }]);
      } catch (switchError: any) {
        const errorMsg = switchError?.message?.toLowerCase() || "";
        const errorCode = switchError?.code || switchError?.error?.code || switchError?.info?.error?.code;
        
        if (errorCode === 4902 || errorMsg.includes("4902") || errorMsg.includes("unrecognized chain id")) {
          await provider.send("wallet_addEthereumChain", [{
            chainId: HEDERA_TESTNET_CHAIN_ID,
            chainName: "Hedera Testnet",
            nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
            rpcUrls: ["https://testnet.hashio.io/api"],
            blockExplorerUrls: ["https://hashscan.io/testnet/"]
          }]);
        } else {
          throw switchError;
        }
      }

      // Mirror node lookup to get 0.0.xyz
      try {
        const res = await fetch(`${MIRROR_NODE_BASE}/accounts/${evmAddress}`);
        if (res.ok) {
          const data = await res.json();
          setAccountId(data.account);
        } else {
          setAccountId(evmAddress);
        }
      } catch (e) {
        setAccountId(evmAddress);
      }
      
      setWalletType("METAMASK");
      setIsConnected(true);
    } catch (err: any) {
      console.error("[WagerWallet] MetaMask connection error:", err);
      setError(err.message || "Failed to connect MetaMask.");
    } finally {
      setIsConnecting(false);
      isConnectLocked.current = false;
    }
  };


  const disconnect = async () => {
    try {
      await hashconnect.disconnect();
      setAccountId(null);
      setIsConnected(false);
      setBalances(defaultBalances);

      // Aggressively clear cache on disconnect to prevent future "Pairing already exists" bugs
      try {
        localStorage.removeItem("hashconnectData");
        localStorage.removeItem("walletconnect");
        if (typeof indexedDB !== "undefined") {
          indexedDB.deleteDatabase("walletconnect-v2.db");
        }
      } catch (_) {}

    } catch (err: any) {
      console.warn("[WagerWallet] Disconnect error:", err);
    }
  };

  const addWagerPoints = (amount: number) => {
    setWagerPoints((prev) => {
      const newPoints = prev + amount;
      try {
        localStorage.setItem("wagerHub_points", newPoints.toString());
      } catch (_) {}
      
      // Enforce programmatic backend rule: exactly 5% of earned points goes to lifetime credits
      const creditBonus = amount * 0.05;
      setWagerCredits((prevCredits) => {
        const newCredits = prevCredits + creditBonus;
        try {
          localStorage.setItem("wagerHub_lifetime_credits", newCredits.toString());
        } catch (_) {}
        return newCredits;
      });

      if (accountId) {
        fetch("/api/log-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, pointsEarned: amount, totalPoints: newPoints }),
        }).catch((err) => console.warn("[WagerWallet] HCS sync failed:", err));
      }
      return newPoints;
    });
  };

  const refreshBalances = async () => {
    if (!accountId) {
      setBalances(defaultBalances);
      return;
    }
    const [h, w, usdt, usdc] = await Promise.all([
      fetchHbarBalance(accountId),
      fetchTokenBalance(accountId, WAGER_TOKEN_ID, 8),
      fetchTokenBalance(accountId, USDT_TOKEN_ID, 6),
      fetchTokenBalance(accountId, USDC_TOKEN_ID, 6),
    ]);
    setBalances({ hbar: h, wager: w, usdt, usdc });
  };

  const executeEVMTransfer = async (tokenAddress: string, toAddress: string, amountTokens: string) => {
    try {
      if (!(window as any).ethereum) throw new Error("MetaMask not found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      const tx = await contract.transfer(toAddress, amountTokens);
      const receipt = await tx.wait();
      
      return { txId: receipt?.hash || tx.hash, status: receipt?.status === 1 ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      console.error("[WagerWallet] executeEVMTransfer error:", e);
      return { txId: null, status: "FAIL" };
    }
  };

  const executeEVMHbarTransfer = async (toAddress: string, amountHbar: string) => {
    try {
      if (!(window as any).ethereum) throw new Error("MetaMask not found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountHbar)
      });
      const receipt = await tx.wait();
      
      return { txId: receipt?.hash || tx.hash, status: receipt?.status === 1 ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      console.error("[WagerWallet] executeEVMHbarTransfer error:", e);
      return { txId: null, status: "FAIL" };
    }
  };

  const executeEVMSmartContract = async (contractAddress: string, abi: any[], functionName: string, args: any[], value: string = "0") => {
    try {
      // HashPack injects window.ethereum just like MetaMask.
      // We use it here to call smart contracts on the Hedera EVM directly,
      // bypassing the Hedera SDK's ContractExecuteTransaction protobuf issues.
      const injectedProvider = (window as any).ethereum;
      if (!injectedProvider) throw new Error("No EVM provider found. Please ensure HashPack or MetaMask is installed and connected.");
      
      const provider = new ethers.BrowserProvider(injectedProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      
      // On Hedera EVM, 1 HBAR = 10^18 weibars (same ratio as ETH/wei on Ethereum)
      // so ethers.parseEther("100") correctly represents 100 HBAR
      const txOptions = value && value !== "0" ? { value: ethers.parseEther(value) } : {};
      const tx = await contract[functionName](...args, txOptions);
      const receipt = await tx.wait();
      
      return { txId: receipt?.hash || tx.hash, status: receipt?.status === 1 ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      const msg: string = e?.message || e?.reason || String(e);
      const code = e?.code || e?._code;
      console.error("[WagerWallet] executeEVMSmartContract error:", { msg, code, e });
      
      // DUPLICATE_TRANSACTION (_code 11) means the same tx was already accepted
      // by the network — treat it as success so the payout flow continues.
      if (code === 11 || msg.toLowerCase().includes("duplicate")) {
        console.warn("[WagerWallet] DUPLICATE_TRANSACTION — treating as SUCCESS.");
        return { txId: null, status: "SUCCESS" };
      }
      
      // Rethrow with human-readable message so the swap catch block can display it
      throw new Error(msg || "Smart contract call failed.");
    }
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

      // Prepare the transaction for HashConnect v3 sendTransaction.
      // We MUST set TransactionId and nodeAccountIds before freezing —
      // hashconnect.sendTransaction() skips populate if already frozen,
      // so we ensure correct values are set here from the SDK directly.
      if (!transaction.isFrozen()) {
        transaction
          .setTransactionId(TransactionId.generate(accountIdObj))
          .setNodeAccountIds([
            AccountId.fromString("0.0.3"),
            AccountId.fromString("0.0.4"),
            AccountId.fromString("0.0.5"),
          ])
          .setMaxTransactionFee(new Hbar(10))
          .freeze();
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
        return null;
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
        walletType,
        accountId,
        network,
        wagerPoints,
        wagerCredits,
        balances,
        error,
        connect,
        connectMetaMask,
        disconnect,
        addWagerPoints,
        executeTransaction,
        executeEVMTransfer,
        executeEVMHbarTransfer,
        executeEVMSmartContract,
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
