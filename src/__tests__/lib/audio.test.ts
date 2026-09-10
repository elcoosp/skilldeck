// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const FakeAudio = vi.hoisted(() => {
  class FakeAudio {
    static instances: FakeAudio[] = []
    volume = 1
    currentTime = 0
    play = vi.fn().mockResolvedValue(undefined)
    constructor() {
      FakeAudio.instances.push(this)
    }
  }
  return FakeAudio
})

vi.stubGlobal('Audio', FakeAudio)

const { playSound, setSoundVolume } = await import('@/lib/audio')
const { useSettingsStore } = await import('@/store/settings')

const initialSettings = useSettingsStore.getState()

function reset() {
  useSettingsStore.setState(initialSettings, true)
  for (const sound of FakeAudio.instances) {
    sound.play.mockClear()
    sound.volume = 1
    sound.currentTime = 0
  }
}

beforeEach(reset)

describe('playSound', () => {
  it('no-ops when audio is disabled', () => {
    useSettingsStore.getState().setAudioEnabled(false)
    playSound('messageSent')
    for (const sound of FakeAudio.instances) {
      expect(sound.play).not.toHaveBeenCalled()
    }
  })

  it('plays with the stored volume and resets currentTime when enabled', () => {
    useSettingsStore.getState().setAudioEnabled(true)
    useSettingsStore.getState().setAudioVolume(0.4)
    playSound('messageSent')
    const sound = FakeAudio.instances[0]
    expect(sound.volume).toBe(0.4)
    expect(sound.currentTime).toBe(0)
    expect(sound.play).toHaveBeenCalledTimes(1)
  })

  it('targets the named sound only', () => {
    useSettingsStore.getState().setAudioEnabled(true)
    playSound('toolApproved')
    expect(FakeAudio.instances[2].play).toHaveBeenCalledTimes(1)
    expect(FakeAudio.instances[0].play).not.toHaveBeenCalled()
  })

  it('swallows play() rejections', async () => {
    useSettingsStore.getState().setAudioEnabled(true)
    FakeAudio.instances[0].play.mockRejectedValue(
      new Error('autoplay was blocked')
    )
    playSound('messageSent')
    await vi.waitFor(() => {
      expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(1)
    })
  })
})

describe('setSoundVolume', () => {
  it('sets the volume on all three sounds', () => {
    setSoundVolume(0.4)
    for (const sound of FakeAudio.instances) {
      expect(sound.volume).toBe(0.4)
    }
  })
})