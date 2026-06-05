"use client";

import { useEffect, useRef } from "react";
import { Info, ArrowRightLeft, Gamepad2, Target, Swords, Dices, TrendingUp, HelpCircle } from "lucide-react";

export default function About() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle hash navigation on mount
    const hash = window.location.hash;
    if (hash && containerRef.current) {
      setTimeout(() => {
        const element = document.getElementById(hash.replace('#', ''));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500); // Small delay to ensure render and transition
    }
  }, []);

  const sections = [
    {
      id: "wager-swap",
      title: "Wager Swap",
      icon: <ArrowRightLeft size={32} className="text-wager-cyan" />,
      color: "text-wager-cyan border-wager-cyan/30 bg-wager-cyan/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            Wager Swap is our flagship decentralized exchange interface. It allows you to seamlessly convert between $HBAR and $WAGER tokens with zero hidden fees. 
          </p>
          <p>
            Powered directly by the Hedera Smart Contract service, Wager Swap ensures absolute security and cryptographic finality. Connect your HashPack wallet, enter the amount you wish to swap, and execute the transaction directly on the network.
          </p>
        </div>
      )
    },
    {
      id: "trend-rider",
      title: "Trend Rider",
      icon: <TrendingUp size={32} className="text-wager-cyan" />,
      color: "text-wager-cyan border-wager-cyan/30 bg-wager-cyan/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            Trend Rider is a highly volatile, 5-second market prediction simulation. 
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Predict whether the asset price will go LONG (Up) or SHORT (Down).</li>
            <li><strong className="text-white">Take Profit & Stop Loss:</strong> Set precise absolute targets. If the volatile price hits your Take Profit, you automatically secure the win. If it hits Stop Loss, you minimize your risk.</li>
            <li><strong className="text-white">500x Synthetic Leverage:</strong> Your final payout multiplier scales dynamically based on how far the price moves in your direction. If the multiplier drops to zero, you are instantly liquidated.</li>
          </ul>
        </div>
      )
    },
    {
      id: "mystery-field",
      title: "Mystery Field",
      icon: <Target size={32} className="text-wager-cyan" />,
      color: "text-wager-cyan border-wager-cyan/30 bg-wager-cyan/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            Mystery Field is a strategic grid-based hazard game where compound multipliers reward the bold.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select a difficulty level (Easy to Extreme) which dictates the number of hidden mines on the grid.</li>
            <li><strong className="text-white">Clicking Tiles:</strong> Click on safe tiles to reveal multipliers. Every safe tile compounds your total potential payout.</li>
            <li><strong className="text-white">Cash Out:</strong> At any point before hitting a mine, you can click "Cash Out" to secure your compounded multiplier. If you hit a mine, your wager is lost.</li>
          </ul>
        </div>
      )
    },
    {
      id: "gravity-drop",
      title: "Gravity Drop",
      icon: <Target size={32} className="text-orange-500" />,
      color: "text-orange-500 border-orange-500/30 bg-orange-500/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            A physics-based plinko-style game where gravity dictates your fortune.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select your wager and drop the ball from the top of the peg board.</li>
            <li><strong className="text-white">Physics Engine:</strong> The ball realistically bounces off pegs, randomly altering its trajectory.</li>
            <li><strong className="text-white">Multipliers:</strong> The ball lands in one of the bottom slots, each containing a specific payout multiplier ranging from heavy losses in the center to massive jackpots on the outer edges.</li>
          </ul>
        </div>
      )
    },
    {
      id: "penalty-shootout",
      title: "The Penalty",
      icon: <Swords size={32} className="text-wager-cyan" />,
      color: "text-wager-cyan border-wager-cyan/30 bg-wager-cyan/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            A tense, 6-zone penalty shootout against a randomized AI goalkeeper.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select at least two target zones in the net where you want to shoot the ball.</li>
            <li><strong className="text-white">The Dive:</strong> Once locked, the AI Keeper randomly dives to cover specific zones.</li>
            <li><strong className="text-white">Resolution:</strong> If the Keeper dives into ANY of your selected zones, your shot is saved and you lose. If they miss, you score a GOAL and double your wager.</li>
          </ul>
        </div>
      )
    },
    {
      id: "blind-loot",
      title: "Blind Loot",
      icon: <Target size={32} className="text-wager-lime" />,
      color: "text-wager-lime border-wager-lime/30 bg-wager-lime/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            Minesweeper stripped of all logic, leaving only pure, brutal luck.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Click random tiles on the grid.</li>
            <li><strong className="text-white">No Clues:</strong> Unlike traditional minesweeper, there are no numbers or hints. You must rely entirely on intuition.</li>
            <li><strong className="text-white">Cash Out:</strong> Cash out your accumulated multiplier at any time before selecting a deadly tile.</li>
          </ul>
        </div>
      )
    },
    {
      id: "rps-zero-trust",
      title: "RPS: Zero Trust",
      icon: <Swords size={32} className="text-wager-purple" />,
      color: "text-wager-purple border-wager-purple/30 bg-purple-500/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            A cryptographically secure execution of Rock, Paper, Scissors.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select Rock, Paper, or Scissors and lock your wager.</li>
            <li><strong className="text-white">Provably Fair:</strong> The opponent's move is generated randomly. Standard RPS rules apply (Rock &gt; Scissors &gt; Paper &gt; Rock).</li>
            <li><strong className="text-white">Resolution:</strong> Win to double your wager, lose to forfeit, or draw to get your wager refunded.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto space-y-12 pb-32">
      {/* Header */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-full mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
          <HelpCircle size={48} className="text-white" />
        </div>
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 tracking-tighter uppercase">
          Knowledge Base
        </h1>
        <p className="text-xl text-zinc-400 font-mono max-w-2xl mx-auto">
          Comprehensive guides and mechanics for all WagerHub features.
        </p>
      </div>

      {/* Dynamic Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <section 
            key={section.id} 
            id={section.id} 
            className="scroll-mt-32 p-8 bg-wager-black border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all"
          >
            <div className={`absolute top-0 right-0 w-64 h-64 ${section.color.replace('text-', 'bg-')} opacity-5 blur-[100px] pointer-events-none transition-opacity group-hover:opacity-10`} />
            
            <div className="flex items-start gap-6 relative z-10">
              <div className={`p-4 rounded-2xl border ${section.color}`}>
                {section.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-6">{section.title}</h2>
                {section.content}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
