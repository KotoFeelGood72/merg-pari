// Thin wrapper around the Yandex Games SDK.
// In dev (or any page without window.YaGames) returns null and we fall back
// to dev stubs in the ads module.

export interface YsdkFullscreenCallbacks {
  onOpen?: () => void
  onClose?: (wasShown: boolean) => void
  onError?: (err: unknown) => void
  onOffline?: () => void
}

export interface YsdkRewardedCallbacks {
  onOpen?: () => void
  onRewarded?: () => void
  onClose?: () => void
  onError?: (err: unknown) => void
}

export interface YsdkAdv {
  showFullscreenAdv(opts: { callbacks?: YsdkFullscreenCallbacks }): void
  showRewardedVideo(opts: { callbacks?: YsdkRewardedCallbacks }): void
}

export interface Ysdk {
  adv: YsdkAdv
  features?: {
    LoadingAPI?: { ready: () => void }
  }
}

let ysdk: Ysdk | null = null
let initPromise: Promise<Ysdk | null> | null = null

/**
 * Wait for `window.YaGames` to become available. The SDK <script> tag is
 * synchronous in index.html, so it should be ready by the time this runs,
 * but we poll briefly to be resilient against slow networks / CDN hiccups.
 */
function waitForYaGames(timeoutMs = 5000): Promise<unknown | null> {
  if ((window as any).YaGames) return Promise.resolve((window as any).YaGames)
  return new Promise((resolve) => {
    const start = Date.now()
    const id = window.setInterval(() => {
      if ((window as any).YaGames) {
        clearInterval(id)
        resolve((window as any).YaGames)
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id)
        resolve(null)
      }
    }, 50)
  })
}

export function initYandex(): Promise<Ysdk | null> {
  if (initPromise) return initPromise

  const p: Promise<Ysdk | null> = waitForYaGames().then((YaGames: any) => {
    if (!YaGames || typeof YaGames.init !== 'function') {
      // Local dev or platform without SDK — caller falls back to dev stubs.
      console.info('[yandex sdk] YaGames not present — running without SDK (dev mode ok)')
      return null
    }
    return YaGames.init()
      .then((sdk: Ysdk) => {
        ysdk = sdk
        console.info('[yandex sdk] initialized', sdk)
        // Tell the platform the game is ready — hides the platform loading screen.
        // Wrapped because not every SDK version exposes LoadingAPI.
        try {
          sdk.features?.LoadingAPI?.ready()
        } catch (err) {
          console.warn('[yandex sdk] LoadingAPI.ready() failed', err)
        }
        return sdk
      })
      .catch((err: unknown) => {
        console.warn('[yandex sdk] init failed', err)
        return null
      })
  })

  initPromise = p
  return p
}

export function getYsdk(): Ysdk | null {
  return ysdk
}

export function isYsdkReady(): boolean {
  return ysdk !== null
}
