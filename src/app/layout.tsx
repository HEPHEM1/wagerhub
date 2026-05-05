import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WAGERHUB | Desktop Command Center",
  description: "Modern, high-stakes Web3 arcade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning={true}
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body suppressHydrationWarning={true} className="h-[100dvh] w-full bg-slate-950 flex flex-col overflow-hidden relative">
        {/* Background Glowing Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-wager-cyan/20 blur-[120px] rounded-full animate-pulse pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-wager-lime/20 blur-[120px] rounded-full animate-pulse pointer-events-none z-0" />

        {/*
          ClientProviders is a "use client" component that internally uses
          dynamic(ssr:false) to load WalletProvider only in the browser,
          preventing WalletConnect from touching localStorage during SSR.
        */}
        <ClientProviders>
          <div className="flex flex-col flex-1 w-full overflow-hidden relative">
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
