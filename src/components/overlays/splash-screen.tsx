import React from 'react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#0F172A] flex items-center justify-center z-50">
      <div className="relative w-[400px] h-[400px]">
        {/* Three animated cards */}
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-gradient-to-br from-blue-500 to-blue-800 animate-slide-primary" />
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-gradient-to-br from-gray-700 to-gray-900 opacity-90 animate-slide-secondary" />
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-blue-600 opacity-70 animate-slide-third" />

        {/* Sparkle effect */}
        <div className="absolute top-[110px] left-[90px] w-[30px] h-[30px] opacity-0 animate-sparkle-flash pointer-events-none filter drop-shadow-[0_0_6px_#FFD966]">
          <div className="absolute w-[3px] h-[18px] bg-white rounded-sm left-[13px] top-[6px]" />
          <div className="absolute w-[18px] h-[3px] bg-white rounded-sm left-[6px] top-[13px]" />
        </div>

        {/* Wordmark */}
        <div className="absolute bottom-[60px] left-0 w-full text-center text-white text-4xl font-bold tracking-wide font-poppins opacity-0 animate-fade-in-up delay-1200">
          SkillDeck
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-orange-400 animate-fill-progress" />
      </div>
    </div>
  );
};
