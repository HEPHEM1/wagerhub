"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "viem";
import { WagmiProvider, useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers } from "ethers";
import { getWalletClient } from "@wagmi/core";
import { EVM_WAGER_TOKEN_ADDRESS, ERC20_ABI, HEDERA_TESTNET_CHAIN_ID } from "../evm";

// ─── Constants & Configuration ────────────────────────────────────────────────
const WC_PROJECT_ID = "0d8e72911e581a9079dd13f03f7ffb53";
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
  const { switchChain } = useSwitchChain();

  // Force-switch network if the wallet is reporting the wrong chain (e.g. HashPack returning 295 instead of 296)
  useEffect(() => {
    if (isConnected && chainId && chainId !== 296 && switchChain) {
      console.log(`[WalletContext] Detected chain mismatch (wallet is on ${chainId}). Forcing switch to 296...`);
      switchChain({ chainId: 296 });
    }
  }, [isConnected, chainId, switchChain]);

  const [wagerPoints, setWagerPoints] = useState<number>(0);
  const [wagerCredits, setWagerCredits] = useState<number>(0);
  const [balances, setBalances] = useState<WalletBalances>(defaultBalances);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedPoints = localStorage.getItem("wagerHub_points");
      const storedCredits = localStorage.getItem("wagerHub_lifetime_credits");
      if (storedPoints) setWagerPoints(parseInt(storedPoints, 10));
      if (storedCredits) setWagerCredits(parseFloat(storedCredits));
    } catch (e) {}
  }, []);

  const refreshBalances = async () => {
    if (!address) return;
    const [hbar, wager] = await Promise.all([
      fetchHbarBalance(address),
      fetchTokenBalance(address, "0.0.8818191", 8)
    ]);
    setBalances({ hbar, wager, usdt: "0.00", usdc: "0.00" });
  };

  useEffect(() => {
    if (isConnected && address) refreshBalances();
    else setBalances(defaultBalances);
  }, [isConnected, address]);

  const addWagerPoints = (amount: number) => {
    setWagerPoints((prev) => {
      const nw = prev + amount;
      localStorage.setItem("wagerHub_points", nw.toString());
      return nw;
    });
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
    return new ethers.JsonRpcSigner(provider, walletClient.account.address);
  };

  const executeEVMSmartContract = async (contractAddress: string, abi: any[], functionName: string, args: any[], value: string = "0") => {
    try {
      const signer = await getEthersSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      
      const txOptions: any = { gasLimit: 5000000 };
      if (value && value !== "0") {
        txOptions.value = ethers.parseEther(value);
      }
      
      const tx = await contract[functionName](...args, txOptions);
      const receipt = await tx.wait();
      return { txId: receipt?.hash || tx.hash, status: receipt?.status === 1 ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      const msg: string = e?.message || e?.reason || String(e);
      const code = e?.code || e?._code;
      if (code === 11 || msg.toLowerCase().includes("duplicate")) {
        return { txId: null, status: "SUCCESS" };
      }
      throw new Error(msg || "Smart contract call failed.");
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
        gasLimit: 100000,
      });
      const receipt = await tx.wait();
      return { txId: receipt?.hash || tx.hash, status: receipt?.status === 1 ? "SUCCESS" : "FAIL" };
    } catch (e: any) {
      throw new Error(e?.message || "Transfer failed");
    }
  };

  const executeTransaction = async () => {
    throw new Error("Native Hedera transactions are no longer supported. Please use EVM methods.");
  };

  const connect = async () => {
    // We do not programmatically open the modal here, we let the <appkit-button> handle it.
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
        network: "testnet",
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
