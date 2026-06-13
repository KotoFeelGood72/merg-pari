<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import ComboCalloutOverlay from '@/components/ComboCalloutOverlay.vue'
import LoseLineOverlay from '@/components/LoseLineOverlay.vue'
import { preloadCatSprites } from '@/game/assets/catSprites'
import { fallEffectPlayer } from '@/game/effects/fallEffectPlayer'
import {
  getGameHeight,
  getGameWidth,
  initGameViewport,
  isMobileGameLayout,
} from '@/game/config/gameViewport'
import { GameEngine } from '@/game/engine/GameEngine'
import type { ComboCallout } from '@/game/types/game.types'
import { useGameStore } from '@/stores/game'

const props = defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  engineReady: [engine: GameEngine]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const playSlotRef = ref<HTMLDivElement | null>(null)
const frameRef = ref<HTMLDivElement | null>(null)
const store = useGameStore()
const loseProgress = ref(0)
const displayWidth = ref(0)
const displayHeight = ref(0)
const gameWorldHeight = ref(720)
const comboCallout = ref<ComboCallout | null>(null)

let engine: GameEngine | null = null
let renderFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null
let resizeFrameId: number | null = null
let relayoutTimeouts: number[] = []

function getCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: ((clientX - rect.left) / rect.width) * getGameWidth(),
    y: ((clientY - rect.top) / rect.height) * getGameHeight(),
  }
}

function onPointerDown(e: PointerEvent): void {
  if (!engine || !props.active) return
  const pt = getCanvasPoint(e.clientX, e.clientY)
  if (!pt) return
  engine.handlePointerDown(pt.x, pt.y)
  canvasRef.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!engine || !props.active) return
  const pt = getCanvasPoint(e.clientX, e.clientY)
  if (!pt) return
  engine.handlePointerMove(pt.x)
}

function onPointerEnter(e: PointerEvent): void {
  onPointerMove(e)
}

function onPointerUp(e: PointerEvent): void {
  if (!engine || !props.active) return
  engine.handlePointerUp()
  try {
    canvasRef.value?.releasePointerCapture(e.pointerId)
  } catch {}
}

function setupCanvasContext(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const worldWidth = getGameWidth()
  const worldHeight = getGameHeight()
  const dpr = Math.min(window.devicePixelRatio || 1, 3)

  canvas.width = Math.round(worldWidth * dpr)
  canvas.height = Math.round(worldHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

function applyCanvasLayout(): void {
  const slot = playSlotRef.value
  const frame = frameRef.value
  const canvas = canvasRef.value
  if (!slot || !frame || !canvas) return

  const width = slot.clientWidth
  const height = slot.clientHeight
  if (width <= 0 || height <= 0) return

  const worldWidth = getGameWidth()
  const worldHeight = getGameHeight()

  let w = width
  let h = Math.round((w / worldWidth) * worldHeight)
  if (h > height) {
    h = height
    w = Math.round((h / worldHeight) * worldWidth)
  }

  displayWidth.value = w
  displayHeight.value = h

  frame.style.width = `${w}px`
  frame.style.height = `${h}px`
  frame.style.maxHeight = 'none'

  const ctx = canvas.getContext('2d')
  if (ctx) {
    setupCanvasContext(canvas, ctx)
    if (engine) {
      engine.render(ctx)
    }
  }
}

function scheduleCanvasLayout(): void {
  if (resizeFrameId !== null) cancelAnimationFrame(resizeFrameId)
  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = null
    applyCanvasLayout()
  })
}

function scheduleCanvasLayoutAfterAd(): void {
  scheduleCanvasLayout()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scheduleCanvasLayout())
  })
  for (const id of relayoutTimeouts) window.clearTimeout(id)
  relayoutTimeouts = [120, 320].map((delay) =>
    window.setTimeout(() => scheduleCanvasLayout(), delay),
  )
}

function onAdsResume(): void {
  scheduleCanvasLayoutAfterAd()
}

function bindResizeObserver(): void {
  const slot = playSlotRef.value
  if (!slot) return

  applyCanvasLayout()
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => scheduleCanvasLayout())
  resizeObserver.observe(slot)
  const container = slot.parentElement
  if (container) resizeObserver.observe(container)
  const column = container?.parentElement
  if (column) resizeObserver.observe(column)
}

function onViewportResize(): void {
  scheduleCanvasLayout()
}

function renderLoop(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (ctx && engine) {
    engine.render(ctx)
    loseProgress.value = engine.getLoseProgress(performance.now())
  }
  renderFrameId = requestAnimationFrame(renderLoop)
}

function createEngine(): GameEngine {
  return new GameEngine(
    {
      onScore: (points, combo) => store.addScore(points, combo),
      onCoins: (amount) => store.addCoins(amount),
      onGameOver: () => store.gameOver(),
      onVictory: (level) => store.showVictory(level),
      onLevelUnlocked: (level, combo) => store.unlockLevel(level, combo),
      onBoosterFail: (msg) => store.showToast(msg),
      onBoosterUsed: () => store.onBoosterApplied(),
      onFieldObjectCount: (count) => store.setFieldObjectCount(count),
      onComboCallout: (callout) => {
        comboCallout.value = callout
      },
    },
    getGameHeight(),
  )
}

onMounted(async () => {
  const canvas = canvasRef.value
  if (!canvas) return

  await nextTick()

  const slot = playSlotRef.value
  initGameViewport(slot?.clientWidth, slot?.clientHeight)
  gameWorldHeight.value = getGameHeight()

  await Promise.all([preloadCatSprites(), fallEffectPlayer.preload()])

  engine = createEngine()
  engine.setMaxUnlockedLevel(store.maxUnlockedLevel)
  emit('engineReady', engine)

  bindResizeObserver()
  window.addEventListener('resize', onViewportResize, { passive: true })
  window.addEventListener('orientationchange', onViewportResize, { passive: true })
  window.visualViewport?.addEventListener('resize', onViewportResize, { passive: true })
  window.addEventListener('ads:resume', onAdsResume)
  renderLoop()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', onViewportResize)
  window.removeEventListener('orientationchange', onViewportResize)
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  window.removeEventListener('ads:resume', onAdsResume)
  for (const id of relayoutTimeouts) window.clearTimeout(id)
  relayoutTimeouts = []
  if (resizeFrameId !== null) cancelAnimationFrame(resizeFrameId)
  if (renderFrameId !== null) cancelAnimationFrame(renderFrameId)
  engine?.stop()
  engine = null
})

watch(
  () => props.active,
  (active) => {
    if (!engine) return
    if (active) {
      engine.resumePhysics()
      scheduleCanvasLayoutAfterAd()
    } else {
      engine.pausePhysics()
    }
  },
)

watch(
  () => store.maxUnlockedLevel,
  (level) => engine?.setMaxUnlockedLevel(level),
)

defineExpose({
  getEngine: () => engine,
  relayout: scheduleCanvasLayout,
})
</script>

<template>
  <div ref="playSlotRef" class="game-play-slot game-screen__playfield">
    <div ref="frameRef" class="game-frame">
      <div class="game-frame__inner game-canvas__viewport">
        <canvas
          ref="canvasRef"
          class="game-canvas__canvas"
          @pointerdown.prevent="onPointerDown"
          @pointerenter="onPointerEnter"
          @pointermove.prevent="onPointerMove"
          @pointerup.prevent="onPointerUp"
          @pointercancel.prevent="onPointerUp"
        />
        <ComboCalloutOverlay
          :callout="comboCallout"
          :display-width="displayWidth"
          :display-height="displayHeight"
          :game-world-height="gameWorldHeight"
        />
        <LoseLineOverlay
          :progress="loseProgress"
          :display-width="displayWidth"
          :display-height="displayHeight"
          :game-world-height="gameWorldHeight"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-play-slot {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

@media (max-width: 767px) {
  .game-play-slot {
    align-items: center;
    justify-content: stretch;
  }

  .game-frame {
    margin-inline: auto;
  }
}

.game-frame {
  flex-shrink: 0;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 767px) {
  .game-frame {
    width: 100%;
    max-width: 100%;
  }
}

.game-frame__inner {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.game-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.game-canvas__canvas:active {
  cursor: grabbing;
}
</style>
