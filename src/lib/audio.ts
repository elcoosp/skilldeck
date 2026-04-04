// src/lib/audio.ts
import { useSettingsStore } from '@/store/settings'

const sounds = {
  messageSent: new Audio('/sounds/send.mp3'),
  messageReceived: new Audio('/sounds/receive.mp3'),
  toolApproved: new Audio('/sounds/approve.mp3'),
} as const

export type SoundName = keyof typeof sounds

export function playSound(name: SoundName) {
  const { audioEnabled, audioVolume } = useSettingsStore.getState()
  if (!audioEnabled) return

  const sound = sounds[name]
  sound.volume = audioVolume
  sound.currentTime = 0
  sound.play().catch(() => {
    // Silently fail — browsers block autoplay before user interaction
  })
}

export function setSoundVolume(volume: number) {
  for (const sound of Object.values(sounds)) {
    sound.volume = volume
  }
}
