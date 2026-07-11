"use client";

import React, { useEffect, useState } from 'react';
import { Terminal, ArrowRightLeft, Gamepad2, Trophy, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getRandomAccountId = () => {
  const num = Math.floor(Math.random() * 900000) + 100000;
  return `0.0.${num}`;
};

const MOCK_TEMPLATES = [
  // Swaps
  () => ({
    type: 'swap',
    message: <span>swapped <span className="text-white font-bold">50 HBAR</span> for <span className="text-white font-bold">500 $WAGER</span></span>,
    icon: <ArrowRightLeft size={16} className="text-cyan-400" />
  }),
  () => ({
    type: 'swap',
    message: <span>swapped <span className="text-white font-bold">20 USDT</span> for <span className="text-white font-bold">200 $WAGER</span></span>,
    icon: <ArrowRightLeft size={16} className="text-cyan-400" />
  }),
  () => ({
    type: 'swap',
    message: <span>swapped <span className="text-white font-bold">100 USDC</span> for <span className="text-white font-bold">1000 $WAGER</span></span>,
    icon: <ArrowRightLeft size={16} className="text-cyan-400" />
  }),
  // Arcade
  () => ({
    type: 'arcade',
    message: <span>played Trend Rider and won <span className="text-amber-400 font-bold">800 WagerPoints!</span></span>,
    icon: <Gamepad2 size={16} className="text-purple-400" />
  }),
  () => ({
    type: 'arcade',
    message: <span>placed a <span className="text-wager-lime font-bold">10 $WAGER</span> bet</span>,
    icon: <Gamepad2 size={16} className="text-purple-400" />
  }),
  () => ({
    type: 'arcade',
    message: <span>unlocked a Mystery Field crate for <span className="text-amber-400 font-bold">800 WagerPoints!</span></span>,
    icon: <Gamepad2 size={16} className="text-purple-400" />
  }),
  // Milestones
  () => ({
    type: 'milestone',
    message: <span>claimed the <span className="text-pink-400 font-bold">12-Hour Bonus!</span></span>,
    icon: <Trophy size={16} className="text-pink-400" />
  }),
  () => ({
    type: 'milestone',
    message: <span>hit a <span className="text-orange-400 font-bold">5-day streak!</span></span>,
    icon: <Flame size={16} className="text-orange-400" />
  }),
];

interface FeedItem {
  id: string;
  time: string;
  accountId: string;
  type: string;
  message: React.ReactNode;
  icon: React.ReactNode;
}

export const HCSLiveFeed = () => {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const generateNextEvent = () => {
      if (!isMounted) return;

      const template = MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)]();
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      
      const newItem: FeedItem = {
        id: Math.random().toString(36).substr(2, 9),
        time: timeStr,
        accountId: getRandomAccountId(),
        type: template.type,
        message: template.message,
        icon: template.icon,
      };

      setFeed(prev => {
        const newFeed = [newItem, ...prev];
        return newFeed.slice(0, 5); // Maximize item limit to top 5 recent events
      });

      // Random delay between 3 and 6 seconds
      const nextDelay = Math.floor(Math.random() * 3000) + 3000;
      timerId = setTimeout(generateNextEvent, nextDelay);
    };

    // Start loop immediately
    generateNextEvent();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  return (
    <div className="mt-8 w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/70 text-xs font-mono uppercase tracking-wider">
          <Terminal size={14} className="text-cyan-400" />
          Simulated Platform Feed
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">Simulated Feed</span>
        </div>
      </div>
      
      <div className="p-4 space-y-3 h-[320px] overflow-hidden relative">
        <AnimatePresence initial={false}>
          {feed.length > 0 ? feed.map((msg) => (
            <motion.div 
              key={msg.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="w-full bg-wager-black/50 border border-white/5 rounded-xl p-3 hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                    msg.type === 'swap' ? 'bg-cyan-500/10 border-cyan-500/30' : 
                    msg.type === 'arcade' ? 'bg-purple-500/10 border-purple-500/30' : 
                    'bg-pink-500/10 border-pink-500/30'
                  }`}>
                     {msg.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono font-bold text-sm">{msg.accountId}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${
                        msg.type === 'swap' ? 'bg-cyan-500/20 text-cyan-400' :
                        msg.type === 'arcade' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-pink-500/20 text-pink-400'
                      }`}>
                        {msg.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 tracking-wide">
                      {msg.message}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-600 font-mono text-right shrink-0">
                  {msg.time}
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="text-white/20 italic flex items-center justify-center h-full gap-3 font-mono text-xs">
              <div className="w-4 h-4 border-2 border-white/10 border-t-cyan-500 rounded-full animate-spin" />
              Connecting to live feed stream...
            </div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="px-4 py-1.5 bg-cyan-500/5 text-[9px] text-cyan-500/50 font-mono flex justify-between items-center border-t border-white/5">
        <span>STATUS: CONNECTED</span>
        <span className="uppercase">Simulated WebSocket</span>
      </div>
    </div>
  );
};
