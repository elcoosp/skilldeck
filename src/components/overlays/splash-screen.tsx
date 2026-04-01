import type React from 'react'

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="relative w-[400px] h-[400px]">
        {/* Three animated cards – dark gradients (original logo style) */}
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-gradient-to-br from-blue-500 to-blue-800 animate-slide-primary" />
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-gradient-to-br from-gray-700 to-gray-900 animate-slide-secondary" />
        <div className="absolute w-[200px] h-[200px] rounded-[48px] shadow-lg bg-blue-600 animate-slide-third" />

        {/* Sparkle effect – accent orange */}
        <div className="absolute top-[110px] left-[90px] w-[30px] h-[30px] opacity-0 animate-sparkle-flash pointer-events-none filter drop-shadow-[0_0_6px_#FF8A4C]">
          <div className="absolute w-[3px] h-[18px] bg-[#FF8A4C] rounded-sm left-[13px] top-[6px]" />
          <div className="absolute w-[18px] h-[3px] bg-[#FF8A4C] rounded-sm left-[6px] top-[13px]" />
        </div>

        {/* Wordmark – white text */}
        <div className="absolute bottom-[60px] left-0 w-full text-center text-white text-2xl font-bold tracking-wide font-sans opacity-0 animate-fade-in-up delay-1200">
          SkillDeck
        </div>

        {/* Progress bar – brand accent */}
        <div className="absolute bottom-0 left-0 h-1 bg-[#FF8A4C] animate-fill-progress" />
      </div>
    </div>
  )
}
