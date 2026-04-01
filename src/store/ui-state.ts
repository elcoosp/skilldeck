import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UIPersistentState {
  unlockStage: number
  setUnlockStage: (stage: number) => void
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void
  platformFeaturesEnabled: boolean
  setPlatformFeaturesEnabled: (enabled: boolean) => void
}

export const useUIPersistentStore = create<UIPersistentState>()(
  persist(
    (set) => ({
      unlockStage: 0,
      setUnlockStage: (stage) => set({ unlockStage: stage }),
      onboardingComplete: (() => {
        try {
          return (
            localStorage.getItem('skilldeck-onboarding-complete') === 'true'
          )
        } catch {
          return false
        }
      })(),
      setOnboardingComplete: (complete) => {
        try {
          localStorage.setItem(
            'skilldeck-onboarding-complete',
            String(complete)
          )
        } catch {}
        set({ onboardingComplete: complete })
      },
      platformFeaturesEnabled: (() => {
        try {
          const stored = localStorage.getItem(
            'skilldeck-platform-features-enabled'
          )
          return stored !== 'false'
        } catch {
          return true
        }
      })(),
      setPlatformFeaturesEnabled: (enabled) => {
        try {
          localStorage.setItem(
            'skilldeck-platform-features-enabled',
            String(enabled)
          )
        } catch {}
        set({ platformFeaturesEnabled: enabled })
      }
    }),
    {
      name: 'skilldeck-ui-persistent',
      partialize: (state) => ({
        unlockStage: state.unlockStage
      })
    }
  )
)
