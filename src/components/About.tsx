"use client";

import { useEffect, useRef } from "react";
import { Info, ArrowRightLeft, Gamepad2, Target, Swords, Dices, TrendingUp, HelpCircle, Radio, Zap, Grid3x3, Disc3, Lock } from "lucide-react";

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
      id: "points-and-credits",
      title: "WagerPoints & WagerCredits",
      icon: <Info size={32} className="text-wager-lime" />,
      color: "text-wager-lime border-wager-lime/30 bg-wager-lime/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            The WagerHub platform features a dynamic dual-metric economy designed to reward active engagement across the Dapp.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">WagerPoints (Leaderboard Status):</strong> WagerPoints are your active seasonal score. They determine your rank on the global leaderboard, which automatically resets to 0 at Midnight UTC on the 1st of every calendar month.</li>
            <li><strong className="text-white">WagerCredits (Lifetime Vault):</strong> WagerCredits are your permanent platform currency. They never reset. We enforce a strict programmatic rule: whenever your wallet earns WagerPoints, our backend spontaneously duplicates exactly 5% of that transaction and permanently adds it to your WagerCredits balance!</li>
            <li><strong className="text-white">Earning via WagerSwap:</strong> Every swap you make through the Universal Router earns points based on the exact live USD volume. A standard swap earns 250 Points per $1.00 USD equivalent. Your first swap of the day $\ge$ $10.00 USD earns a massive 5,000 WagerPoint bonus!</li>
            <li><strong className="text-white">Arcade Minimum Qualifying Bet:</strong> All Arcade games enforce a strict minimum bet threshold of exactly <strong>10 $WAGER</strong> (or 1.0 HBAR equivalent). Submitting a valid on-chain game transaction that meets this threshold will instantly award you a flat <strong>800 WagerPoints</strong> per round, regardless of whether you win or lose the game! If you bet less than 10 $WAGER, the game mechanics will process normally, but explicitly award 0 WagerPoints.</li>
          </ul>
        </div>
      )
    },
    {
      id: "wager-swap",
      title: "Universal Router",
      icon: <ArrowRightLeft size={32} className="text-wager-cyan" />,
      color: "text-wager-cyan border-wager-cyan/30 bg-wager-cyan/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            The Universal Router is WagerHub's flagship multi-token decentralized exchange interface. It allows you to seamlessly swap between any combination of the four core platform assets with zero hidden fees.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Supported Tokens:</strong> HBAR, $WAGER, USDC, and USDT. Any of the 12 possible pair combinations can be executed in a single transaction.</li>
            <li><strong className="text-white">Live Oracle Pricing:</strong> Exchange rates are sourced in real-time from the SaucerSwap REST API, with an automatic CoinGecko fallback and a static safety net. Prices refresh silently every 30 seconds. A pulsing green dot on the rate ticker confirms live data is active.</li>
            <li><strong className="text-white">$WAGER Rate Rule:</strong> The $WAGER token is a custom platform asset not listed on external price feeds. Its rate is always enforced as a strict internal constant: <strong>1 HBAR = 10 $WAGER</strong>, derived mathematically from the live HBAR price.</li>
            <li><strong className="text-white">Token Association:</strong> Before any HTS token swap is executed, the router automatically checks whether your wallet is associated with the receiving token. If not, it batches all required <code>TokenAssociateTransaction</code>s into a single wallet prompt — so you never need to manually associate tokens.</li>
            <li><strong className="text-white">WagerPoints on Swaps:</strong> Every swap earns 250 WagerPoints per $1.00 USD equivalent. Your first qualifying swap of the day (≥ $10.00 USD) earns a 5,000 WagerPoint bonus!</li>
          </ul>
        </div>
      )
    },
    {
      id: "live-feed",
      title: "HCS Live Feed",
      icon: <Radio size={32} className="text-green-400" />,
      color: "text-green-400 border-green-400/30 bg-green-400/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            The HCS Live Feed is a real-time activity stream displayed on the WagerHub dashboard, simulating a live WebSocket event feed of platform-wide activity.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">What it Shows:</strong> Swap events, arcade game outcomes (wins and WagerPoint milestones), and leaderboard achievements — all attributed to realistic Hedera wallet IDs.</li>
            <li><strong className="text-white">Live Cadence:</strong> A new activity event slides into the feed every 3 to 6 seconds, creating a dynamic and active platform feel.</li>
            <li><strong className="text-white">Smooth Animations:</strong> Each new event slides in from the top with a fade-in transition, shifting older events down the list gracefully.</li>
          </ul>
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

  const comingSoonSections = [
    {
      id: "naughts-nodes",
      title: "Naughts & Nodes",
      icon: <Grid3x3 size={32} className="text-cyan-400" />,
      color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
      content: (
        <div className="space-y-4 text-zinc-400 font-mono leading-relaxed">
          <p>The ultimate 1v1 logic battle. Stake your $WAGER and outsmart your opponent directly on the chain.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-zinc-300">Game Type:</strong> 1v1 Player vs Player on-chain Tic-Tac-Toe.</li>
            <li><strong className="text-zinc-300">Stake Mechanics:</strong> Both players lock their $WAGER bet before the match begins. The winner takes the full pot.</li>
            <li><strong className="text-zinc-300">On-Chain Fairness:</strong> Every move is recorded on Hedera, making the outcome fully verifiable and trustless.</li>
          </ul>
        </div>
      )
    },
    {
      id: "bulls-bears",
      title: "Bulls & Bears",
      icon: <TrendingUp size={32} className="text-emerald-400" />,
      color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
      content: (
        <div className="space-y-4 text-zinc-400 font-mono leading-relaxed">
          <p>The classic trading showdown. Pick your side, place your bet, and ride the market momentum.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-zinc-300">Choose a Side:</strong> Go Bull (price goes up) or Bear (price goes down) on a live market feed.</li>
            <li><strong className="text-zinc-300">Momentum Windows:</strong> Bets are resolved over a fixed time window using real price data.</li>
            <li><strong className="text-zinc-300">Payouts:</strong> The winning side splits the losing side's pool proportionally to their stake size.</li>
          </ul>
        </div>
      )
    },
    {
      id: "whale-spin",
      title: "Whale Spin",
      icon: <Disc3 size={32} className="text-purple-400" />,
      color: "text-purple-400 border-purple-400/30 bg-purple-400/10",
      content: (
        <div className="space-y-4 text-zinc-400 font-mono leading-relaxed">
          <p>High-stakes wheel of fortune. Will you land the massive Whale jackpot?</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-zinc-300">The Wheel:</strong> A futuristic holographic roulette wheel with segments of varying multipliers.</li>
            <li><strong className="text-zinc-300">Whale Jackpot:</strong> One rare segment carries a massive jackpot multiplier — the Whale slot.</li>
            <li><strong className="text-zinc-300">Provably Fair:</strong> Spin results are determined by a verifiable on-chain random seed.</li>
          </ul>
        </div>
      )
    },
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

      {/* Active Game Sections */}
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

      {/* Coming Soon Divider */}
      <div className="flex items-center gap-4 pt-8">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 bg-wager-black border border-white/10 rounded-full">
          <Lock size={12} className="text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Coming Soon</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Coming Soon Sections */}
      <div className="space-y-8 opacity-70">
        {comingSoonSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-32 p-8 bg-wager-black/60 border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden"
          >
            {/* Coming Soon badge */}
            <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md">
              <Lock size={9} className="text-zinc-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Coming Soon</span>
            </div>

            <div className={`absolute top-0 right-0 w-64 h-64 ${section.color.replace('text-', 'bg-')} opacity-[0.03] blur-[100px] pointer-events-none`} />
            <div className="flex items-start gap-6 relative z-10">
              <div className={`p-4 rounded-2xl border ${section.color} opacity-60`}>
                {section.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-black text-white/60 uppercase tracking-wider mb-6">{section.title}</h2>
                {section.content}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
