import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  Twitter,
  Rocket,
  Coins,
  Wallet,
  Users,
  Zap,
} from 'lucide-react';

interface HowItWorksPopupProps {
  isVisible: boolean;
  onClose: () => void;
}

const HowItWorksPopup: React.FC<HowItWorksPopupProps> = ({ isVisible, onClose }) => {
  const steps = [
    {
      icon: Twitter,
      text: (
          <>
            Post on X: <span className="text-white font-medium">Tag @coinlaunchnow with <code>$SYMBOL</code></span>
          </>
      ),
    },
    {
      icon: Rocket,
      text: (
          <>
            Token gets launched instantly on <span className="text-white font-medium">EVM</span>
          </>
      ),
    },
    {
      icon: Coins,
      text: (
          <>
            Early users can <span className="text-white font-medium">trade with zero slippage</span>
          </>
      ),
    },
    {
      icon: Wallet,
      text: (
          <>
            Creator connects X to <span className="text-white font-medium">redeem volume fees</span>
          </>
      ),
    }
  ];

  if (!isVisible) return null;

  return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--card)] rounded-xl relative w-full max-w-xl shadow-lg">
          <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          <div className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Launch Coins with a Tweet
            </h2>

            <p className="text-gray-400 text-center mb-6">
              Tag <code>@coinlaunchnow</code> on X with your <code>$SYMBOL</code> to auto-deploy your token on-chain.
              No code. No insiders. Full transparency.
            </p>

            <div className="space-y-5">
              {steps.map((step, idx) => (
                  <div key={idx} className="flex items-start sm:items-center gap-4">
                    <div className="bg-[var(--card2)] p-3 rounded-lg">
                      <step.icon className="h-6 w-6 text-[var(--primary)]" />
                    </div>
                    <div className="text-sm text-gray-300 leading-snug">{step.text}</div>
                  </div>
              ))}
            </div>

            <button
                onClick={onClose}
                className="w-full mt-8 py-3 bg-[var(--primary)] text-black rounded-lg font-semibold hover:bg-[var(--primary-hover)] transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
  );
};

export default HowItWorksPopup;
