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
            The WagerHub platform features a dynamic dual-metric economy designed to reward active engagement across the DApp.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">WagerPoints (Monthly Leaderboard Score):</strong> WagerPoints are your active seasonal score. They determine your rank on the global leaderboard, which automatically resets to 0 at Midnight UTC on the 1st of every calendar month. Grind hard each month to top the chart.</li>
            <li><strong className="text-white">WagerCredits (Lifetime Vault):</strong> WagerCredits are your permanent platform currency and <em>never reset</em>. Every time your wallet earns WagerPoints, the backend automatically computes exactly <strong>5% of that WagerPoints award</strong> and permanently adds it to your WagerCredits balance. WagerCredits are displayed in the top header at all times.</li>
            <li><strong className="text-white">Welcome Gift — 70 $WAGER:</strong> Every new wallet that connects to WagerHub receives a one-time welcome gift of <strong>70 $WAGER</strong> directly from the house treasury. This is a real on-chain transfer and can only be claimed once per wallet address.</li>
            <li><strong className="text-white">12-Hour Loyalty Claim — 100 WagerPoints:</strong> After claiming your Welcome Gift, a recurring 12-hour bonus timer activates. Every 12 hours you may claim <strong>100 WagerPoints</strong> as a loyalty reward — keeping you on the leaderboard even between sessions.</li>
            <li><strong className="text-white">Earning via WagerSwap:</strong> Every swap you execute through the Universal Router earns points based on the exact live USD volume of that swap. A standard swap earns <strong>250 WagerPoints per $1.00 USD equivalent</strong>. Your first qualifying swap of the day (≥ $10.00 USD) earns a massive <strong>5,000 WagerPoint daily bonus</strong>!</li>
            <li><strong className="text-white">Arcade Minimum Qualifying Bet:</strong> All Arcade games enforce a minimum bet threshold of <strong>10 $WAGER</strong> (or 1.0 HBAR equivalent). Submitting a valid on-chain game transaction at or above this threshold instantly awards you a flat <strong>800 WagerPoints per round</strong>, regardless of whether you win or lose. Bets below 10 $WAGER earn 0 WagerPoints.</li>
          </ul>
          <p className="text-amber-400/80 text-xs border border-amber-400/20 rounded-xl px-4 py-3 bg-amber-400/5">
            ⚠️ <strong>Testnet Notice:</strong> WagerHub is currently live on the Hedera Testnet. All $WAGER tokens, HBAR, USDC, and USDT used within the platform are testnet assets with no real-world monetary value.
          </p>
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
            The Universal Router is WagerHub's flagship multi-token decentralized exchange interface, built on Hedera. It allows you to seamlessly swap between any combination of the four core platform assets with zero hidden fees.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Supported Tokens:</strong> HBAR, $WAGER, USDC, and USDT. Any of the 12 possible pair combinations can be executed in a single transaction.</li>
            <li><strong className="text-white">Live Oracle Pricing:</strong> Exchange rates are sourced in real-time from the SaucerSwap REST API, with an automatic CoinGecko fallback and a static safety net. Prices refresh silently every 30 seconds. A pulsing green dot on the rate ticker confirms live data is active; an amber dot indicates fallback pricing is in use.</li>
            <li><strong className="text-white">$WAGER Rate Rule:</strong> The $WAGER token is a custom platform asset not listed on external price feeds. Its rate is always enforced as a strict internal constant: <strong>1 HBAR = 10 $WAGER</strong>, derived mathematically from the live HBAR/USD price.</li>
            <li><strong className="text-white">Blocked Routes:</strong> Direct swaps between $WAGER and stablecoins (USDC / USDT) are intentionally blocked by the router. To convert between them, route via HBAR as an intermediary (e.g. $WAGER → HBAR → USDC).</li>
            <li><strong className="text-white">Token Association:</strong> Before any HTS token swap is executed, the router automatically checks whether your wallet is associated with the receiving token. If not, it batches all required <code>TokenAssociateTransaction</code>s into a single wallet prompt — so you never need to manually associate tokens.</li>
            <li><strong className="text-white">WagerPoints on Swaps:</strong> Every swap earns <strong>250 WagerPoints per $1.00 USD equivalent</strong>. Your first qualifying swap of the day (≥ $10.00 USD) earns a <strong>5,000 WagerPoint daily bonus</strong>.</li>
          </ul>
        </div>
      )
    },
    {
      id: "live-feed",
      title: "Simulated Platform Feed",
      icon: <Radio size={32} className="text-green-400" />,
      color: "text-green-400 border-green-400/30 bg-green-400/10",
      content: (
        <div className="space-y-4 text-zinc-300 font-mono leading-relaxed">
          <p>
            The Simulated Platform Feed is an animated activity stream displayed on the WagerSwap dashboard, designed to replicate the feel of a live WebSocket event feed showing platform-wide activity.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">What it Shows:</strong> Simulated swap events, arcade game outcomes (wins and WagerPoint milestones), and 12-hour loyalty claim events — all attributed to randomly generated Hedera-format wallet IDs.</li>
            <li><strong className="text-white">Cadence:</strong> A new activity event slides into the feed every 3 to 6 seconds, creating a dynamic and active platform feel.</li>
            <li><strong className="text-white">Smooth Animations:</strong> Each new event slides in from the top with a spring fade-in transition, shifting older events down the list gracefully. A maximum of 5 events are displayed at any time.</li>
            <li><strong className="text-white">Transparency:</strong> The feed is explicitly labelled <em>Simulated Feed</em> to make clear these are not live on-chain events. It serves as a visual activity indicator for the testnet phase.</li>
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
            Trend Rider is a high-volatility, 5-second market prediction simulation. Place your wager, pick a direction, and ride a candlestick chart to your fortune.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select your wager amount, then predict whether the asset price will go <strong>LONG (Up)</strong> or <strong>SHORT (Down)</strong> within the 5-second candle window.</li>
            <li><strong className="text-white">Take Profit & Stop Loss:</strong> Set precise absolute price targets before confirming your position. If the volatile price hits your Take Profit target, you automatically secure the win. If it hits your Stop Loss, the position closes to limit further losses.</li>
            <li><strong className="text-white">500x Synthetic Leverage:</strong> Your final payout multiplier scales dynamically based on how far the price moves in your direction during the candle. If the multiplier drops to zero before expiry, your position is instantly liquidated.</li>
            <li><strong className="text-white">WagerPoints:</strong> Every valid wager of ≥ 10 $WAGER awards <strong>800 WagerPoints</strong> immediately upon transaction confirmation, win or lose.</li>
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
            Mystery Field is a strategic grid-based hazard game where compounding multipliers reward the bold — but a single mine ends everything.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select a difficulty level (Easy to Extreme) which dictates the number of hidden mines on the 5×5 grid, then submit your wager on-chain to begin.</li>
            <li><strong className="text-white">Clicking Tiles:</strong> Click on tiles to reveal them. Safe tiles compound your total potential payout multiplier. Every additional safe tile you reveal increases the risk — and the reward.</li>
            <li><strong className="text-white">Cash Out:</strong> At any point before hitting a mine, click <strong>Cash Out</strong> to secure your compounded multiplier as a real on-chain payout. If you hit a mine, your wager is lost.</li>
            <li><strong className="text-white">Difficulty Levels:</strong> Easy (fewer mines, lower multipliers) through Extreme (many mines, massive multipliers). Choose your risk tolerance wisely.</li>
            <li><strong className="text-white">WagerPoints:</strong> Every valid wager of ≥ 10 $WAGER awards <strong>800 WagerPoints</strong> per round regardless of outcome.</li>
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
            A physics-based Plinko-style game where gravity dictates your fortune. Drop the ball and watch it bounce through a field of pegs toward its fate.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Set your wager (<strong>minimum 50 $WAGER</strong>), choose your number of peg rows, and select a risk level. Then drop the ball from the top of the peg board.</li>
            <li><strong className="text-white">Physics Engine:</strong> The ball realistically bounces off pegs, with each collision randomly altering its trajectory left or right as it falls.</li>
            <li><strong className="text-white">Multipliers:</strong> The ball lands in one of the bottom slots, each carrying a specific payout multiplier. Slots near the outer edges carry higher jackpot multipliers; centre slots carry lower-risk but lower-reward multipliers.</li>
            <li><strong className="text-white">Risk Levels:</strong> Higher risk settings increase the spread of multiplier values — pushing both jackpot peaks and loss troughs further apart.</li>
            <li><strong className="text-white">WagerPoints:</strong> Every valid wager of ≥ 10 $WAGER awards <strong>800 WagerPoints</strong> per drop.</li>
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
            A tense, 6-zone penalty shootout against a randomized AI goalkeeper. Pick your zones, lock your shot, and hope the keeper dives the wrong way.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select <strong>at least 2 target zones</strong> in the net where you want to aim your shot, then submit your wager on-chain to lock the decision.</li>
            <li><strong className="text-white">The Dive:</strong> Once your shot is locked, the AI Keeper randomly dives to cover <strong>exactly 2 of the 6 zones</strong>.</li>
            <li><strong className="text-white">Resolution:</strong> If the Keeper dives into <em>any</em> of your selected zones, your shot is saved and you lose your wager. If they miss all your zones, you score a <strong>GOAL</strong> and receive a <strong>2x payout</strong> (double your wager) from the treasury.</li>
            <li><strong className="text-white">Strategy:</strong> Selecting more zones increases your chance of scoring but does not change the payout multiplier — it remains 2x. Balance coverage vs. risk carefully.</li>
            <li><strong className="text-white">WagerPoints:</strong> Every valid wager of ≥ 10 $WAGER awards <strong>800 WagerPoints</strong> per round, win or lose.</li>
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
            Blind Loot is a high-stakes loot box experience stripped of all logic, leaving only pure, brutal luck. Two paths — Blessed or Cursed — diverge before you.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Fixed Wager:</strong> Unlike other games, Blind Loot uses a <strong>fixed wager of 100 $WAGER</strong> per round. There is no variable bet — every player stakes the same amount.</li>
            <li><strong className="text-white">Choose Your Path:</strong> Select either the <strong>Blessed Path</strong> (standard risk, standard reward) or the <strong>Cursed Path</strong> (higher risk, cursed multiplier) before revealing your fate.</li>
            <li><strong className="text-white">No Clues:</strong> Unlike traditional minesweeper, there are no numbers, no patterns, and no hints. You must rely entirely on intuition and chance.</li>
            <li><strong className="text-white">Cash Out:</strong> Cash out your accumulated multiplier at any time before selecting a deadly tile to lock in a real on-chain payout.</li>
            <li><strong className="text-white">WagerPoints:</strong> The fixed 100 $WAGER wager exceeds the 10 $WAGER threshold, so every round automatically awards <strong>800 WagerPoints</strong>.</li>
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
            A cryptographically committed execution of Rock, Paper, Scissors. The opponent's move is generated on-chain before your wager is confirmed — ensuring provably fair outcomes.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">How to Play:</strong> Select your wager amount (minimum 10 $WAGER), choose Rock, Paper, or Scissors, and lock your wager on-chain.</li>
            <li><strong className="text-white">Provably Fair:</strong> The house commitment (SHA-256 hash of the opponent's move) is published on-screen <em>before</em> your transaction is submitted. After the round resolves, you can verify the pre-commitment matches the revealed move. Standard RPS rules apply: Rock beats Scissors, Scissors beats Paper, Paper beats Rock.</li>
            <li><strong className="text-white">Resolution:</strong> <strong>Win</strong> — receive a <strong>2x payout</strong> (double your wager). <strong>Lose</strong> — forfeit your wager. <strong>Draw</strong> — your wager is refunded in full.</li>
            <li><strong className="text-white">WagerPoints:</strong> Every valid wager of ≥ 10 $WAGER awards <strong>800 WagerPoints</strong> per round, regardless of outcome.</li>
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
