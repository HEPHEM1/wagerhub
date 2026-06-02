"use client";

import React, { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';

interface HCSMessage {
  sequence_number: number;
  message: string;
  consensus_timestamp: string;
}

export const HCSLiveFeed = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const topicId = (process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "0.0.5284340").trim();

  useEffect(() => {
    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const fetchMessages = async () => {
      if (!isMounted) return;
      if (!topicId || topicId === "undefined" || topicId.includes("NEXT_PUBLIC")) return;
      
      try {
        const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=5&order=desc`);
        if (!res.ok) {
          if (res.status === 400 || res.status === 404) {
            console.error(`[HCSLiveFeed] Fatal error: Topic ${topicId} is invalid or not found (HTTP ${res.status}). Halting polling.`);
            return; // Stop polling completely
          }
          throw new Error(`HTTP error ${res.status}`);
        }
        
        const data = await res.json();
        if (data.messages) {
          const decodedMessages = data.messages.map((m: any) => {
            try {
              return atob(m.message);
            } catch {
              return "Binary message received";
            }
          });
          setMessages(decodedMessages);
        }

        // Continue polling normally
        if (isMounted) {
          timerId = setTimeout(fetchMessages, 5000);
        }
      } catch (err) {
        // Implement 15-second backoff on generic network failures
        if (isMounted) {
          timerId = setTimeout(fetchMessages, 15000);
        }
      }
    };

    fetchMessages();
    
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [topicId]);

  return (
    <div className="mt-8 w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/70 text-xs font-mono uppercase tracking-wider">
          <Terminal size={14} className="text-cyan-400" />
          HCS Live Swap Feed
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">Live Feed</span>
        </div>
      </div>
      
      <div className="p-4 font-mono text-xs md:text-sm space-y-3 max-h-[250px] overflow-y-auto">
        {messages.length > 0 ? messages.map((msg, i) => (
          <div key={i} className="flex gap-3 text-white/60 hover:text-cyan-200/90 transition-colors border-l-2 border-cyan-500/20 pl-3 group">
            <span className="text-white/20 group-hover:text-cyan-500/40 shrink-0">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <span className="text-cyan-400/80 font-bold">::</span>
            <span className="truncate">{msg}</span>
          </div>
        )) : (
          <div className="text-white/20 italic flex items-center justify-center py-4 gap-3">
            <div className="w-4 h-4 border-2 border-white/10 border-t-cyan-500 rounded-full animate-spin" />
            Waiting for live swaps...
          </div>
        )}
      </div>
      
      <div className="px-4 py-1.5 bg-cyan-500/5 text-[9px] text-cyan-500/50 font-mono flex justify-between items-center border-t border-white/5">
        <span>TOPIC_ID: {topicId}</span>
        <span className="uppercase">Real-time Consensus</span>
      </div>
    </div>
  );
};
