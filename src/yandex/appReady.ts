import { getLang, getYsdk, gameplayInit } from '@/yandex/sdk'

let readyCalled = false


export function markAppReady(): void {
  if (readyCalled) return
  readyCalled = true

  document.documentElement.lang = getLang()

  try {
    getYsdk()?.features?.LoadingAPI?.ready()
  } catch {
    
  }

  gameplayInit()
}

export function isAppReady(): boolean {
  return readyCalled
}
