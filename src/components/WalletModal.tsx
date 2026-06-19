import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useWalletContext } from '@/context/WalletContext';

export default function WalletModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { connect, connectMetaMask, isConnecting } = useWalletContext();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleHashPack = async () => {
    await connect();
    onClose();
  };

  const handleMetaMask = async () => {
    await connectMetaMask();
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-xl tracking-tight">Connect Wallet</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Wallet Options */}
            <div className="flex flex-col gap-3">
              {/* MetaMask - EVM Engine */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMetaMask}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-orange-500/30 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl p-2 shadow-inner">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-white font-semibold">MetaMask</span>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-orange-500/10 text-orange-500 rounded-md">EVM</span>
              </motion.button>

              {/* HashPack - Native Engine */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleHashPack}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-wager-cyan/30 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-950 rounded-xl p-1.5 shadow-inner">
                    <img src="https://global.discourse-cdn.com/standard14/uploads/hedera/original/2X/6/6f759c87d46816ea51fb782dece8a8537dbd111a.png" alt="HashPack" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-white font-semibold">HashPack</span>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-wager-cyan/10 text-wager-cyan rounded-md">NATIVE</span>
              </motion.button>

              {/* Phantom - Dummy */}
              <button
                disabled
                className="w-full flex items-center justify-between p-4 bg-slate-800/30 border border-white/5 rounded-2xl opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl p-2 shadow-inner flex items-center justify-center">
                    <img src="https://phantom.app/img/ghost.svg" alt="Phantom" className="w-6 h-6 object-contain filter brightness-0 invert" />
                  </div>
                  <span className="text-white font-semibold">Phantom</span>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-slate-700 text-slate-300 rounded-md">COMING SOON</span>
              </button>

              {/* WalletConnect - Dummy */}
              <button
                disabled
                className="w-full flex items-center justify-between p-4 bg-slate-800/30 border border-white/5 rounded-2xl opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl p-2 shadow-inner flex items-center justify-center">
                    <img src="https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.png" alt="WalletConnect" className="w-full h-full object-contain filter brightness-0 invert" />
                  </div>
                  <span className="text-white font-semibold">WalletConnect</span>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-slate-700 text-slate-300 rounded-md">COMING SOON</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                New to Hedera? <a href="https://hashpack.app" target="_blank" rel="noreferrer" className="text-wager-cyan hover:underline flex items-center gap-1">Get a Wallet <ExternalLink size={10} /></a>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  
  const { createPortal } = require('react-dom');
  return createPortal(modalContent, document.body);
}
