import {
  GAME_HEIGHT,
  GAME_WIDTH,
  MOBILE_GAME_HEIGHT,
  MOBILE_LAYOUT_MAX_WIDTH,
  MOBILE_MIN_GAME_HEIGHT,
} from '@/game/config/gameConfig'

let activeGameHeight = GAME_HEIGHT

export function isMobileGameLayout(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`).matches
}


export function resolveSlotGameHeight(slotWidth: number, slotHeight: number): number {
  if (slotWidth <= 0 || slotHeight <= 0) {
    return isMobileGameLayout() ? MOBILE_GAME_HEIGHT : GAME_HEIGHT
  }

  const scale = slotWidth / GAME_WIDTH
  const maxWorldHeight = Math.floor(slotHeight / scale)
  const cap = isMobileGameLayout() ? MOBILE_GAME_HEIGHT : GAME_HEIGHT

  if (isMobileGameLayout()) {
    if (maxWorldHeight < MOBILE_MIN_GAME_HEIGHT) {
      return Math.min(MOBILE_GAME_HEIGHT, maxWorldHeight)
    }
    return Math.min(MOBILE_GAME_HEIGHT, Math.max(maxWorldHeight, MOBILE_MIN_GAME_HEIGHT))
  }

  return Math.min(cap, maxWorldHeight)
}

export function initGameViewport(slotWidth?: number, slotHeight?: number): void {
  if (slotWidth !== undefined && slotHeight !== undefined && slotWidth > 0 && slotHeight > 0) {
    activeGameHeight = resolveSlotGameHeight(slotWidth, slotHeight)
    return
  }

  activeGameHeight = isMobileGameLayout() ? MOBILE_GAME_HEIGHT : GAME_HEIGHT
}

export function getGameWidth(): number {
  return GAME_WIDTH
}

export function getGameHeight(): number {
  return activeGameHeight
}
