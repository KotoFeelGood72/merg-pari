import { onUnmounted, ref, watch, type Ref } from 'vue'

import { adsPlaying, msUntilInterstitialReady, setAdBreakBlocking, showScheduledGameplayInterstitialThen } from '@/ads/ads'
import { pauseMusic, resumeMusic } from '@/audio/sounds'
import { gameplayPause, gameplayResume, getServerTime } from '@/yandex/sdk'

const INTERVAL_MS = 120_000
const COUNTDOWN_SECONDS = 3
const TICK_MS = 250

export function useGameplayInterstitialSchedule(isPlaying: Ref<boolean>) {
  const showCountdown = ref(false)
  const countdown = ref(0)
  const isGameplayBlocked = ref(false)

  let scheduleTimer: ReturnType<typeof setTimeout> | null = null
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  let nextAdAt = 0
  let countdownEndsAt = 0

  function clearScheduleTimer(): void {
    if (scheduleTimer !== null) {
      clearTimeout(scheduleTimer)
      scheduleTimer = null
    }
  }

  function clearCountdownTimer(): void {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function releaseInterstitialGameplayPause(): void {
    if (!isGameplayBlocked.value) return
    isGameplayBlocked.value = false
    gameplayResume()
  }

  function finishBreak(): void {
    showCountdown.value = false
    countdown.value = 0
    countdownEndsAt = 0
    releaseInterstitialGameplayPause()

    if (isPlaying.value) {
      resumeMusic()
    }
  }

  function armScheduleTimer(): void {
    clearScheduleTimer()
    if (nextAdAt <= 0 || !isPlaying.value || isGameplayBlocked.value) return

    const tick = (): void => {
      if (!isPlaying.value || isGameplayBlocked.value) return

      const remaining = nextAdAt - getServerTime()
      if (remaining <= 0) {
        scheduleTimer = null
        startCountdown()
        return
      }

      scheduleTimer = setTimeout(tick, Math.min(TICK_MS, remaining))
    }

    tick()
  }

  function scheduleNext(): void {
    clearScheduleTimer()
    if (!isPlaying.value || isGameplayBlocked.value) return

    const cooldownWait = msUntilInterstitialReady({ scheduled: true })
    nextAdAt = getServerTime() + Math.max(INTERVAL_MS, cooldownWait)
    armScheduleTimer()
  }

  function deferUntilCooldownReady(): boolean {
    const cooldownWait = msUntilInterstitialReady({ scheduled: true })
    if (cooldownWait > 0) {
      nextAdAt = getServerTime() + cooldownWait
      armScheduleTimer()
      return true
    }
    return false
  }

  function showAdAfterCountdown(): void {
    showCountdown.value = false
    countdown.value = 0
    countdownEndsAt = 0
    clearCountdownTimer()

    showScheduledGameplayInterstitialThen(() => {
      finishBreak()
      scheduleNext()
    })
  }

  function syncCountdownFromServerTime(): void {
    if (countdownEndsAt <= 0) return

    const remaining = Math.ceil((countdownEndsAt - getServerTime()) / 1000)
    if (remaining > 0) {
      countdown.value = remaining
      return
    }

    clearCountdownTimer()
    showAdAfterCountdown()
  }

  function startCountdown(): void {
    if (!isPlaying.value) {
      if (nextAdAt > 0) {
        armScheduleTimer()
      } else {
        scheduleNext()
      }
      return
    }

    if (adsPlaying()) {
      window.addEventListener('ads:resume', () => startCountdown(), { once: true })
      return
    }

    if (isGameplayBlocked.value) return

    if (deferUntilCooldownReady()) return

    isGameplayBlocked.value = true
    showCountdown.value = true
    countdown.value = COUNTDOWN_SECONDS
    countdownEndsAt = getServerTime() + COUNTDOWN_SECONDS * 1000
    pauseMusic()
    gameplayPause()

    syncCountdownFromServerTime()
    countdownTimer = setInterval(syncCountdownFromServerTime, TICK_MS)
  }

  function resetSchedule(): void {
    clearScheduleTimer()
    clearCountdownTimer()
    showCountdown.value = false
    countdown.value = 0
    countdownEndsAt = 0

    const wasBlocked = isGameplayBlocked.value
    releaseInterstitialGameplayPause()
    if (wasBlocked && isPlaying.value) {
      resumeMusic()
    }

    scheduleNext()
  }

  function stopSchedule(): void {
    clearScheduleTimer()
    clearCountdownTimer()
    showCountdown.value = false
    countdown.value = 0
    countdownEndsAt = 0
    nextAdAt = 0
    releaseInterstitialGameplayPause()
  }

  function pauseSchedule(): void {
    clearScheduleTimer()
    clearCountdownTimer()
    showCountdown.value = false
    countdown.value = 0
    countdownEndsAt = 0
    releaseInterstitialGameplayPause()
  }

  watch(isPlaying, (playing, wasPlaying) => {
    if (playing) {
      if (wasPlaying === false) {
        if (nextAdAt > 0) {
          armScheduleTimer()
        } else {
          scheduleNext()
        }
      }
      return
    }

    pauseSchedule()
  })

  watch(
    isGameplayBlocked,
    (blocked) => {
      setAdBreakBlocking(blocked)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    setAdBreakBlocking(false)
    stopSchedule()
  })

  return {
    showCountdown,
    countdown,
    isGameplayBlocked,
    resetSchedule,
  }
}
