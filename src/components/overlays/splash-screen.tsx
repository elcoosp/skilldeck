import type React from 'react'

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#14171c] flex items-center justify-center z-50">
      <div className="relative w-[400px] h-[400px]">
        {/* Three animated cards – the dealt hand, night cabin */}
        <div className="absolute w-[200px] h-[200px] rounded-[28px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] bg-gradient-to-br from-[#ff8a5b] to-[#e04f16] animate-slide-primary" />
        <div className="absolute w-[200px] h-[200px] rounded-[28px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] bg-gradient-to-br from-[#2a303b] to-[#1d2128] animate-slide-secondary" />
        <div className="absolute w-[200px] h-[200px] rounded-[28px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] bg-[#f6f7f9] animate-slide-third" />

        {/* Sparkle mark – safety orange */}
        <div className="absolute top-[110px] left-[90px] w-[30px] h-[30px] opacity-0 animate-sparkle-flash pointer-events-none">
          <div className="absolute w-[3px] h-[18px] bg-[#f4622a] rounded-sm left-[13px] top-[6px]" />
          <div className="absolute w-[18px] h-[3px] bg-[#f4622a] rounded-sm left-[6px] top-[13px]" />
        </div>

        {/* Wordmark – paper white */}
        <div className="absolute bottom-[60px] left-0 w-full text-center text-[#f6f7f9] text-2xl font-bold tracking-wide font-sans opacity-0 animate-fade-in-up delay-1200">
          SkillDeck
        </div>

        {/* Progress bar – safety orange */}
        <div className="absolute bottom-0 left-0 h-1 bg-[#f4622a] animate-fill-progress" />
      </div>
    </div>
  )
}
