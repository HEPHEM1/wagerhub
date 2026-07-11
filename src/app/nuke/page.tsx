"use client";

import { useEffect, useState } from "react";

export default function NukePage() {
  const [status, setStatus] = useState("Waiting for confirmation...");
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    if (!hasConfirmed) return;

    async function wipeAll() {
      setStatus("Wiping localStorage...");
      localStorage.clear();

      setStatus("Wiping sessionStorage...");
      sessionStorage.clear();

      setStatus("Wiping cookies...");
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      setStatus("Wiping IndexedDB...");
      const dbs = ["walletconnect-v2.db", "WALLET_CONNECT_V2_INDEXED_DB", "hashconnect"];
      for (const dbName of dbs) {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(dbName);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => {
            console.warn(`DB ${dbName} blocked from deletion`);
            resolve();
          };
        });
      }

      setStatus("Nuke complete! Redirecting in 2 seconds...");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }

    wipeAll();
  }, [hasConfirmed]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-green-500 font-mono text-xl space-y-8">
      <div>{status}</div>
      {!hasConfirmed && (
        <button 
          onClick={() => setHasConfirmed(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors"
        >
          CONFIRM NUKE
        </button>
      )}
    </div>
  );
}
