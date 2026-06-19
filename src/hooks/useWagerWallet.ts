/**
 * useWagerWallet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The primary consumer hook for WAGERHUB wallet state and actions.
 *
 * Usage:
 *   const { isConnected, accountId, balances, connect, disconnect,
 *           signWagerTransaction, refreshBalances } = useWagerWallet();
 *
 * Must be used inside a component that is a descendant of <WalletProvider>.
 */

import { useCallback } from "react";
import { useWalletContext } from "@/context/WalletContext";
import type { Transaction } from "@hashgraph/sdk";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWagerWallet() {
  const {
    isConnected,
    isConnecting,
    accountId,
    network,
    wagerPoints,
    wagerCredits,
    balances,
    error,
    isInitialized,
    walletType,
    connect,
    connectMetaMask,
    disconnect,
    addWagerPoints,
    executeTransaction: contextExecuteTransaction,
    executeEVMTransfer,
    executeEVMHbarTransfer,
    executeEVMSmartContract,
    refreshBalances,
  } = useWalletContext();

  /**
   * Returns a truncated version of the account ID for display purposes.
   * e.g. "0.0.123456" → "0.0.123•••"
   */
  const shortAccountId = useCallback((): string | null => {
    if (!accountId) return null;
    if (accountId.length <= 10) return accountId;
    return `${accountId.slice(0, 7)}•••`;
  }, [accountId]);

  /**
   * Convenience: sign and execute a Hedera Transaction via the wallet.
   * Wraps contextExecuteTransaction with friendlier error surface.
   *
   * @returns An object containing txId and status, or null if rejected.
   */
  const executeTransaction = useCallback(
    async (transaction: Transaction): Promise<{ txId: string | null; status: string | null } | null> => {
      if (!isConnected) {
        console.warn("[useWagerWallet] Cannot execute transaction: wallet not connected.");
        return null;
      }
      return contextExecuteTransaction(transaction);
    },
    [isConnected, contextExecuteTransaction]
  );

  return {
    /** Whether a wallet session is active. */
    isConnected,

    /** True while the connect modal is open / handshake in progress. */
    isConnecting,

    /** Full Hedera account ID, e.g. "0.0.123456". Null if not connected. */
    accountId,

    /** The network the wallet is connected to, e.g. "testnet" or "mainnet" */
    network,

    /** Seasonal Leaderboard Points */
    wagerPoints,

    /** Lifetime WagerCredits balance */
    wagerCredits,

    /** Truncated account ID for UI display. */
    shortAccountId: shortAccountId(),

    /** Live balances fetched from the Hedera testnet Mirror Node. */
    balances,

    /** Whether the wallet provider has fully finished its background initialization */
    isInitialized,

    /** The type of wallet currently connected */
    walletType,

    /** Latest error message, if any. Cleared on next successful action. */
    error,

    /** Open the WalletConnect modal (QR or browser extension). */
    connect,

    /** Open the MetaMask connection flow */
    connectMetaMask,

    /** Disconnect all active WalletConnect sessions and clear state. */
    disconnect,

    /** Add WagerPoints (which automatically adds 5% to WagerCredits) */
    addWagerPoints,

    /**
     * Sign and execute any @hashgraph/sdk Transaction using the connected wallet.
     * Triggers a wallet approval UI (HashPack popup / Blade sheet / WC modal).
     */
    executeTransaction,
    executeEVMTransfer,
    executeEVMHbarTransfer,

    /**
     * Re-fetch HBAR and $WAGER balances from the Mirror Node.
     * Call this after a game round to reflect updated balances instantly.
     */
    refreshBalances,
  } as const;
}
