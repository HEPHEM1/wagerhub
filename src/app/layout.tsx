import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-geist-mono",
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
      className={`${inter.variable} ${spaceMono.variable} h-full antialiased dark`}
    >
      <body suppressHydrationWarning={true} className="h-[100dvh] w-full bg-wager-black flex flex-col overflow-hidden">
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
