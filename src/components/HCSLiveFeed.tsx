"use client";

import React, { useEffect, useState } from 'react';
import { Terminal, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ParsedMessage {
  id: string;
  time: string;
  accountId: string;
  credits: number;
  event: string;
  raw: string;
  isParsed: boolean;
}

export const HCSLiveFeed = () => {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
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
          const parsedMessages = data.messages.map((m: any) => {
            let rawStr = "Binary message received";
            try {
              rawStr = atob(m.message);
            } catch {}

            let parsed = null;
            try {
              // Convert Python dict string to JSON if necessary
              const jsonStr = rawStr.replace(/'/g, '"');
              parsed = JSON.parse(jsonStr);
            } catch (e) {
              // Fallback if it's genuinely not JSON
            }

            const d = new Date(parseFloat(m.consensus_timestamp) * 1000);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            return {
              id: m.sequence_number.toString(),
              time: timeStr,
              accountId: parsed?.accountId || "Unknown",
              credits: parsed?.creditsEarned || 0,
              event: parsed?.event || "unknown",
              raw: rawStr,
              isParsed: !!parsed && !!parsed.accountId
            };
          });
          setMessages(parsedMessages);
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
      
      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.length > 0 ? messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              className="w-full bg-wager-black/50 border border-white/5 rounded-xl p-3 hover:bg-white/5 hover:border-cyan-500/30 transition-all group overflow-hidden"
            >
              {msg.isParsed ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                       <ArrowRightLeft size={16} className="text-cyan-400 group-hover:rotate-180 transition-transform duration-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono font-bold text-sm">{msg.accountId}</span>
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-[0_0_10px_rgba(74,222,128,0.2)]">Swapped</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-1 uppercase tracking-wider">
                        Earned <span className="text-amber-400 font-bold ml-1">{msg.credits} WagerCredits</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-600 font-mono text-right shrink-0">
                    {msg.time}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 text-white/60 hover:text-cyan-200/90 transition-colors border-l-2 border-cyan-500/20 pl-3 font-mono text-xs">
                  <span className="text-white/20 shrink-0">{msg.time}</span>
                  <span className="text-cyan-400/80 font-bold">::</span>
                  <span className="truncate">{msg.raw}</span>
                </div>
              )}
            </motion.div>
          )) : (
            <div className="text-white/20 italic flex items-center justify-center py-8 gap-3 font-mono text-xs">
              <div className="w-4 h-4 border-2 border-white/10 border-t-cyan-500 rounded-full animate-spin" />
              Listening to Hedera Consensus Service...
            </div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="px-4 py-1.5 bg-cyan-500/5 text-[9px] text-cyan-500/50 font-mono flex justify-between items-center border-t border-white/5">
        <span>TOPIC_ID: {topicId}</span>
        <span className="uppercase">Real-time Consensus</span>
      </div>
    </div>
  );
};
