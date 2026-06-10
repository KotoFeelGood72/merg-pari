import { MAX_LEVEL } from '@/game/config/objectLevels'

/** Файлы в assets/game/cats: 1.webp … 30.webp ↔ игровые уровни 1 … 30 */
export const CAT_SPRITE_FIRST = 1
export const CAT_SPRITE_LAST = MAX_LEVEL

const sprites = new Map<number, HTMLImageElement>()
let circleFrame: HTMLImageElement | null = null
let gameFieldBackground: HTMLImageElement | null = null
let loadPromise: Promise<void> | null = null

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function getCatSpriteAssetId(level: number): number {
  return level
}

export function getCatSpriteUrl(level: number): string {
  return new URL(`../../assets/game/cats/${level}.webp`, import.meta.url).href
}

export function preloadCatSprites(): Promise<void> {
  if (loadPromise) return loadPromise

  const circleUrl = new URL('../../assets/game/circle.webp', import.meta.url).href
  const fieldBgUrl = new URL('../../assets/backgrounds/gamebg.jpg', import.meta.url).href

  loadPromise = Promise.all([
    loadImage(circleUrl).then((img) => {
      circleFrame = img
    }),
    loadImage(fieldBgUrl).then((img) => {
      gameFieldBackground = img
    }),
    ...Array.from({ length: MAX_LEVEL }, async (_, index) => {
      const level = index + 1
      const url = new URL(`../../assets/game/cats/${level}.webp`, import.meta.url).href
      const img = await loadImage(url)
      if (img) sprites.set(level, img)
    }),
  ]).then(() => undefined)

  return loadPromise
}

export function getCatSprite(level: number): HTMLImageElement | undefined {
  return sprites.get(level)
}

export function getCircleFrame(): HTMLImageElement | null {
  return circleFrame
}

export function getGameFieldBackground(): HTMLImageElement | null {
  return gameFieldBackground
}
