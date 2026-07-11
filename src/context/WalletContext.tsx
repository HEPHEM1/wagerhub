"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createAppKit, useAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "viem";
import { WagmiProvider, useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers } from "ethers";
import { getWalletClient, waitForTransactionReceipt } from "@wagmi/core";
import { EVM_WAGER_TOKEN_ADDRESS, ERC20_ABI, HEDERA_TESTNET_CHAIN_ID } from "../evm";

// ─── Constants & Configuration ──────────────────────────────────────────────────────────────────────────
const WC_PROJECT_ID = (process.env.NEXT_PUBLIC_WC_PROJECT_ID || "0d8e72911e581a9079dd13f03f7ffb53").trim();
const MIRROR_NODE_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

const hederaTestnet = defineChain({
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hashio.io/api"] },
  },
  blockExplorers: {
    default: { name: "Hashscan", url: "https://hashscan.io/testnet" },
  },
});

const queryClient = new QueryClient();

const wagmiAdapter = new WagmiAdapter({
  networks: [hederaTestnet],
  projectId: WC_PROJECT_ID,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [hederaTestnet],
  defaultNetwork: hederaTestnet,
  projectId: WC_PROJECT_ID,
  metadata: {
    name: "WagerHub",
    description: "Universal Web3 Arcade and DeFi Terminal on Hedera.",
    icons: ["https://wagerhub.vercel.app/logo.png"],
    url: typeof window !== "undefined" ? window.location.origin : "https://wagerhub.vercel.app",
  },
  features: {
    analytics: true,
  },
});

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
  walletType: "EVM" | null;
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
  executeTransaction: (transaction: any) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMTransfer: (tokenAddress: string, toAddress: string, amountTokens: string) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMHbarTransfer: (toAddress: string, amountHbar: string) => Promise<{ txId: string | null; status: string | null } | null>;
  executeEVMSmartContract: (contractAddress: string, abi: any[], functionName: string, args: any[], value?: string) => Promise<{ txId: string | null; status: string | null } | null>;
  refreshBalances: () => Promise<void>;
}

const defaultBalances: WalletBalances = { hbar: "0.00", wager: "0.00", usdt: "0.00", usdc: "0.00" };

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  isConnecting: false,
  isInitialized: true,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchHbarBalance(accountId: string): Promise<string> {
  try {
    const res = await fetch(`${MIRROR_NODE_BASE}/accounts/${accountId}`);
    if (!res.ok) throw new Error(`Mirror Node HTTP ${res.status}`);
    const data = await res.json();
    const tinybars: number = data?.balance?.balance ?? 0;
    return (tinybars / 1e8).toFixed(2);
  } catch (e) {
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
    return "0.00";
  }
}

// ─── Inner Provider logic ─────────────────────────────────────────────────────
function WalletProviderInner({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, chainId } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();

  // NOTE: We intentionally do NOT auto-call switchChain on mount.
  // HashPack sometimes briefly reports chainId 295 (Mainnet) even when the user
  // is on Testnet. Firing switchChain immediately causes a ConnectorChainMismatchError
  // that shows a false "Network Mismatch" banner on every first interaction.

  const [wagerPoints, setWagerPoints] = useState<number>(0);
  const wagerCredits = Math.floor(wagerPoints * 0.05);
  
  const [balances, setBalances] = useState<WalletBalances>(defaultBalances);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedPoints = localStorage.getItem("wagerHub_points");
      if (storedPoints) setWagerPoints(parseInt(storedPoints, 10));
    } catch (e) {}
  }, []);

  const refreshBalances = async () => {
    if (!address) return;
    const [hbar, wager, usdc, usdt] = await Promise.all([
      fetchHbarBalance(address),
      fetchTokenBalance(address, "0.0.8818191", 8),
      fetchTokenBalance(address, "0.0.9388818", 6), // Mock USDC
      fetchTokenBalance(address, "0.0.9388816", 6)  // Mock USDT
    ]);
    setBalances({ hbar, wager, usdt, usdc });
  };

  useEffect(() => {
    if (isConnected && address) refreshBalances();
    else setBalances(defaultBalances);
  }, [isConnected, address]);

  const addWagerPoints = (amount: number) => {
    // Compute new total synchronously from current state so the HCS fetch has the right value
    const newTotal = wagerPoints + amount;
    localStorage.setItem("wagerHub_points", newTotal.toString());
    setWagerPoints(newTotal);

    // Fire off the HCS Log Score API call in the background
    if (address) {
      fetch("/api/log-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: address,
          pointsEarned: amount,
          totalPoints: newTotal,
          event: "swap"
        })
      }).catch(err => console.error("[WalletContext] Failed to log score to HCS:", err));
    }
  };

  // Wagmi/viem provider to ethers.js Signer
  const getEthersSigner = async () => {
    const walletClient = await getWalletClient(wagmiAdapter.wagmiConfig);
    if (!walletClient) throw new Error("Wallet not connected");
    
    const network = {
      chainId: walletClient.chain.id,
      name: walletClient.chain.name,
    };
    
    // Convert Viem custom transport to an Ethers provider
    const provider = new ethers.BrowserProvider(walletClient.transport as any, network);
    // Use the native getSigner() method which properly binds the provider's execution capabilities
    return await provider.getSigner(walletClient.account.address);
  };

  const executeEVMSmartContract = async (contractAddress: string, abi: any[], functionName: string, args: any[], value: string = "0") => {
    // Inner attempt — no preemptive chain switch (HashPack briefly mis-reports chainId on first connect)
    const attempt = async () => {
      const signer = await getEthersSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      const txOptions: any = {};
      if (value && value !== "0") {
        txOptions.value = ethers.parseEther(value);
      }
      const tx = await contract[functionName](...args, txOptions);
      const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, {
        hash: tx.hash as `0x${string}`
      });
      return { txId: receipt.transactionHash, status: receipt.status === "success" ? "SUCCESS" : "FAIL" };
    };

    try {
      return await attempt();
    } catch (e: any) {
      const msg: string = e?.message || "";

      // HashPack sometimes reports chain 295 on first connect even though the user is on Testnet.
      // When Wagmi detects the mismatch it throws ConnectorChainMismatchError.
      // Solution: silently ask HashPack to align to 296 and immediately retry — no banner shown.
      const isChainMismatch =
        msg.includes("ConnectorChainMismatchError") ||
        (msg.includes("chain") && msg.includes("295"));

      if (isChainMismatch) {
        console.warn("[Wagmi] ConnectorChainMismatchError detected — silently requesting chain 296 and retrying...");
        try {
          if (switchChainAsync) await switchChainAsync({ chainId: 296 });
        } catch {
          // ignore — HashPack may reject the programmatic switch but still execute on testnet
        }
        // Small delay to let HashPack settle its reported chainId
        await new Promise(resolve => setTimeout(resolve, 400));
        try {
          return await attempt();
        } catch (retryErr: any) {
          // Retry also failed — now surface a clean error
          throw new Error(retryErr?.info?.error?.message || retryErr?.reason || retryErr?.message || "Transaction failed.");
        }
      }

      // Any other error — surface cleanly
      const friendly = e?.info?.error?.message || e?.reason || msg;
      throw new Error(friendly || "Smart contract call failed.");
    }
  };

  const executeEVMTransfer = async (tokenAddress: string, toAddress: string, amountTokens: string) => {
    return executeEVMSmartContract(tokenAddress, ERC20_ABI, "transfer", [toAddress, amountTokens]);
  };

  const executeEVMHbarTransfer = async (toAddress: string, amountHbar: string) => {
    try {
      const signer = await getEthersSigner();
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountHbar),
        // CRITICAL FIX: Bypass eth_estimateGas which throws LOCAL_CALL_MODIFICATION_EXCEPTION on Hedera RPC
        // Must be EXACTLY 21000 for native transfers on Hedera, otherwise it fails precheck (-32000)
        gasLimit: 21000,
      });
      // Use Wagmi's waitForTransactionReceipt (consistent with executeEVMSmartContract)
      const receipt = await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, {
        hash: tx.hash as `0x${string}`
      });
      return { txId: receipt.transactionHash, status: receipt.status === "success" ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      throw new Error(e?.message || "Transfer failed");
    }
  };

  const executeTransaction = async () => {
    throw new Error("Native Hedera transactions are no longer supported. Please use EVM methods.");
  };

  const connect = async () => {
    await open();
  };

  const disconnectWallet = async () => {
    await disconnectAsync();
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isConnecting,
        isInitialized: true,
        walletType: "EVM",
        accountId: address || null,
        network: chainId === 296 ? "testnet" : (chainId === 295 ? "mainnet" : "unknown"),
        wagerPoints,
        wagerCredits,
        balances,
        error,
        connect,
        connectMetaMask: connect,
        disconnect: disconnectWallet,
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

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>
        <WalletProviderInner>{children}</WalletProviderInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWagerWallet() {
  return useContext(WalletContext);
}

// ── Backward-compatibility alias (game components still import this) ──────────
export const useWalletContext = useWagerWallet;
