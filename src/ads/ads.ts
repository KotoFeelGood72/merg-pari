// Ads orchestration: cooldowns, dev stubs, pause / mute lifecycle.
// Game loop pause + audio mute are dispatched via window CustomEvents so
// non-Vue code (this module) doesn't need to import the game/store.

import { ref, readonly } from 'vue'
import { getServerTime, getSessionStartMs, getYsdk } from '@/yandex/sdk'

const FIRST_AD_GAP = 60_000 // no interstitial in first minute (Yandex requirement)
const INTERSTITIAL_MIN_GAP = 90_000 // our cooldown — 30s stricter than SDK
const INTER_TO_REWARD_GAP = 30_000 // don't pile ads back-to-back

export interface InterstitialOptions {
  /** Явный клик игрока (новая игра, рестарт) — не блокировать FIRST_AD_GAP */
  userInitiated?: boolean
  /** Плановая реклама в геймплее (каждые 2 мин) */
  scheduled?: boolean
  /** Всегда вызывать SDK, без клиентских кулдаунов (рестарт и т.п.) */
  forceAttempt?: boolean
}

let lastInterstitialAt = 0
let lastAnyAdAt = 0
let startupAdShown = false
const adPlaying = ref(false)
let adBreakBlocking = false

/** Блокировка UI во время отсчёта перед плановой рекламой. */
export function setAdBreakBlocking(blocked: boolean): void {
  adBreakBlocking = blocked
}

export function isAdBreakBlocking(): boolean {
  return adBreakBlocking
}

function overlaySafeFromAds(): boolean {
  return !adPlaying.value && !adBreakBlocking
}

function emitPause() {
  adPlaying.value = true
  window.dispatchEvent(new CustomEvent('ads:pause'))
}
function emitResume() {
  adPlaying.value = false
  window.dispatchEvent(new CustomEvent('ads:resume'))
}

export const adPlayingRef = readonly(adPlaying)

export function adsPlaying(): boolean {
  return adPlaying.value
}

/** Минимальная пауза после любой рекламы перед UI (оценка, подсказки). */
const UI_AFTER_AD_GAP = 5_000

export function msSinceLastAd(): number {
  if (lastAnyAdAt === 0) return Number.POSITIVE_INFINITY
  return getServerTime() - lastAnyAdAt
}

/** Сколько мс ждать до следующего interstitial по общим кулдаунам. */
export function msUntilInterstitialReady(options?: InterstitialOptions): number {
  if (adPlaying.value) return 500

  const userInitiated = options?.userInitiated === true
  if (userInitiated) return 0

  const now = getServerTime()
  let wait = 0

  const untilFirstAd = FIRST_AD_GAP - (now - getSessionStartMs())
  if (untilFirstAd > 0) wait = Math.max(wait, untilFirstAd)

  if (lastInterstitialAt > 0) {
    const untilInterstitial = INTERSTITIAL_MIN_GAP - (now - lastInterstitialAt)
    if (untilInterstitial > 0) wait = Math.max(wait, untilInterstitial)
  }

  if (lastAnyAdAt > 0) {
    const untilAnyAd = INTER_TO_REWARD_GAP - (now - lastAnyAdAt)
    if (untilAnyAd > 0) wait = Math.max(wait, untilAnyAd)
  }

  return wait
}

/**
 * Выполнить callback, когда реклама не идёт и прошёл буфер после последнего показа.
 */
export function runWhenSafeFromAds(fn: () => void): void {
  const attempt = () => {
    if (!overlaySafeFromAds()) {
      if (adsPlaying()) {
        window.addEventListener(
          'ads:resume',
          () => window.setTimeout(attempt, UI_AFTER_AD_GAP),
          { once: true },
        )
      } else {
        window.setTimeout(attempt, 500)
      }
      return
    }
    const elapsed = msSinceLastAd()
    if (elapsed < UI_AFTER_AD_GAP) {
      window.setTimeout(attempt, UI_AFTER_AD_GAP - elapsed)
      return
    }
    fn()
  }
  attempt()
}

export function canShowInterstitial(options?: InterstitialOptions): boolean {
  if (adPlaying.value) return false

  const userInitiated = options?.userInitiated === true
  if (import.meta.env.DEV && userInitiated) return true
  if (userInitiated) return true

  return msUntilInterstitialReady(options) <= 0
}

function markInterstitialShown(): void {
  lastInterstitialAt = getServerTime()
  lastAnyAdAt = lastInterstitialAt
}

function createFullscreenCallbacks(onDone: () => void) {
  let pauseEmitted = false
  let tracked = false

  const trackShow = (): void => {
    if (tracked) return
    tracked = true
    markInterstitialShown()
  }

  const pauseOnce = () => {
    if (pauseEmitted) return
    pauseEmitted = true
    emitPause()
  }
  const resumeOnce = () => {
    if (pauseEmitted) emitResume()
  }
  const finish = () => {
    resumeOnce()
    try {
      onDone()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[ads] interstitial onDone failed', err)
    }
  }

  return {
    onOpen: () => {
      trackShow()
      pauseOnce()
    },
    onClose: (wasShown = false) => {
      if (wasShown) trackShow()
      finish()
    },
    onError: () => finish(),
    onOffline: () => finish(),
  }
}

/**
 * Полноэкранная реклама при первом открытии игры в сессии.
 * Не ждёт минутный кулдаун — показывается сразу после загрузки.
 */
export function showStartupInterstitial(onDone?: () => void): void {
  const finish = () => {
    try {
      onDone?.()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[ads] startup onDone failed', err)
    }
  }

  if (startupAdShown || adPlaying.value) {
    finish()
    return
  }

  startupAdShown = true
  markInterstitialShown()

  const ysdk = getYsdk()
  if (!ysdk) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[ads] startup interstitial (dev stub)')
    }
    finish()
    return
  }

  try {
    ysdk.adv.showFullscreenAdv({
      callbacks: createFullscreenCallbacks(finish),
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ads] startup interstitial failed', err)
    finish()
  }
}

/**
 * Try to show a fullscreen interstitial. No-op if cooldown is not satisfied
 * or the SDK is unavailable. Always safe to call.
 */
export function showInterstitial(_reason?: string, options?: InterstitialOptions): void {
  showInterstitialThen(() => {}, _reason, options)
}

/**
 * Показать полноэкранную рекламу, затем выполнить callback.
 * forceAttempt / userInitiated — всегда вызывают SDK (частоту решает платформа).
 */
export function showInterstitialThen(
  onDone: () => void,
  reason?: string,
  options?: InterstitialOptions,
): void {
  const finish = () => {
    try {
      onDone()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[ads] interstitial onDone failed', err)
    }
  }

  const forceAttempt = options?.forceAttempt === true || options?.userInitiated === true

  if (adPlaying.value) {
    window.addEventListener(
      'ads:resume',
      () => showInterstitialThen(onDone, reason, options),
      { once: true },
    )
    return
  }

  if (!forceAttempt && !canShowInterstitial(options)) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[ads] interstitial skipped (cooldown)', reason)
    }
    finish()
    return
  }

  invokeFullscreenInterstitial(finish, reason)
}

/** Всегда вызывает SDK: без клиентских кулдаунов, с паузой до ответа платформы. */
function showForcedInterstitialThen(onDone: () => void, reason?: string): void {
  const finish = () => {
    try {
      onDone()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[ads] forced interstitial onDone failed', err)
    }
  }

  if (adPlaying.value) {
    window.addEventListener(
      'ads:resume',
      () => showForcedInterstitialThen(onDone, reason),
      { once: true },
    )
    return
  }

  let paused = false
  const pause = (): void => {
    if (paused) return
    paused = true
    emitPause()
  }
  const resume = (): void => {
    if (!paused) return
    paused = false
    emitResume()
  }
  const done = (): void => {
    resume()
    finish()
  }

  pause()

  const ysdk = getYsdk()
  if (!ysdk) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[ads] forced interstitial (dev stub)', reason)
      window.setTimeout(() => {
        markInterstitialShown()
        done()
      }, 1200)
      return
    }
    done()
    return
  }

  let tracked = false
  try {
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => {
          if (!tracked) {
            tracked = true
            markInterstitialShown()
          }
        },
        onClose: (wasShown = false) => {
          if (wasShown && !tracked) {
            tracked = true
            markInterstitialShown()
          }
          done()
        },
        onError: () => done(),
        onOffline: () => done(),
      },
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ads] forced interstitial failed', err)
    done()
  }
}

/** Реклама перед рестартом — SDK вызывается каждый раз. */
export function showRestartInterstitialThen(onDone: () => void): void {
  showForcedInterstitialThen(onDone, 'restart')
}

/** Реклама перед получением награды — SDK вызывается при каждом «Забрать». */
export function showRewardClaimInterstitialThen(
  onDone: () => void,
  reason: 'quest_reward' | 'daily_reward' = 'quest_reward',
): void {
  showForcedInterstitialThen(onDone, reason)
}

/** Плановая реклама в геймплее — через общий кулдаун, с ожиданием готовности. */
export function showScheduledGameplayInterstitialThen(onDone: () => void): void {
  const attempt = (): void => {
    if (adPlaying.value) {
      window.addEventListener('ads:resume', attempt, { once: true })
      return
    }

    const wait = msUntilInterstitialReady({ scheduled: true })
    if (wait > 0) {
      window.setTimeout(attempt, wait)
      return
    }

    showInterstitialThen(onDone, 'scheduled_gameplay', { scheduled: true })
  }

  attempt()
}

function invokeFullscreenInterstitial(finish: () => void, reason?: string): void {
  const ysdk = getYsdk()
  if (!ysdk) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[ads] interstitial (dev stub)', reason)
      emitPause()
      window.setTimeout(() => {
        markInterstitialShown()
        emitResume()
        finish()
      }, 1200)
      return
    }
    finish()
    return
  }

  try {
    ysdk.adv.showFullscreenAdv({
      callbacks: createFullscreenCallbacks(finish),
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ads] interstitial failed', err)
    finish()
  }
}

/**
 * Show a rewarded video. Reward is delivered ONLY if onRewarded fires.
 * In dev (no SDK), reward is granted immediately for testing.
 */
export function showRewarded(onReward: () => void): void {
  if (adPlaying.value) return
  lastAnyAdAt = getServerTime()

  const ysdk = getYsdk()
  if (!ysdk) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[ads] rewarded (dev stub) — granting immediately')
      onReward()
    }
    return
  }

  let granted = false
  let pauseEmitted = false
  const pauseOnce = () => {
    if (pauseEmitted) return
    pauseEmitted = true
    emitPause()
  }
  const resumeOnce = () => {
    if (pauseEmitted) emitResume()
  }

  try {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: pauseOnce,
        onRewarded: () => {
          granted = true
        },
        onClose: () => {
          resumeOnce()
          if (granted) onReward()
        },
        onError: () => {
          resumeOnce()
        },
      },
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ads] rewarded failed', err)
    resumeOnce()
  }
}
