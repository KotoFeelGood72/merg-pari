<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, shallowRef, watch } from 'vue'
import gsap from 'gsap'

import AdCountdownModal from '@/components/AdCountdownModal.vue'
import BoosterPanel from '@/components/BoosterPanel.vue'
import GameCanvas from '@/components/GameCanvas.vue'
import GameHud from '@/components/GameHud.vue'
import GameOverModal from '@/components/GameOverModal.vue'
import GameToast from '@/components/GameToast.vue'
import CollectionScreen from '@/components/screens/CollectionScreen.vue'
import HomeScreen from '@/components/screens/HomeScreen.vue'
import ShopScreen from '@/components/screens/ShopScreen.vue'
import TasksScreen from '@/components/screens/TasksScreen.vue'
import PauseModal from '@/components/PauseModal.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import TutorialModal from '@/components/TutorialModal.vue'
import VictoryModal from '@/components/VictoryModal.vue'
import type { GameEngine } from '@/game/engine/GameEngine'
import { useGameplayInterstitialSchedule } from '@/composables/useGameplayInterstitialSchedule'
import { gameEngineKey } from '@/composables/useGameEngineRef'
import {
  showClickInterstitialThen,
  showRestartInterstitialThen,
  showRewarded,
  showStartupInterstitial,
} from '@/ads/ads'
import { pauseMusic, resumeMusic } from '@/audio/sounds'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/playerStore'
import { gameplayPause, gameplayResume } from '@/yandex/sdk'
import { tryShowPlatformReviewWhenSafe } from '@/yandex/reviewPrompt'

const store = useGameStore()
const player = usePlayerStore()

const showSettings = ref(false)
const engineRef = shallowRef<GameEngine | null>(null)
const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)
const gameScreenRef = ref<HTMLElement | null>(null)

provide(gameEngineKey, engineRef)

const isPlaying = computed(() => store.gameState === 'playing')
const { showCountdown, countdown, isGameplayBlocked, resetSchedule } =
  useGameplayInterstitialSchedule(isPlaying)
const isCanvasActive = computed(() => isPlaying.value && !isGameplayBlocked.value)
const showGameScreen = computed(() =>
  ['playing', 'paused', 'gameOver', 'victory'].includes(store.gameState),
)

const MUSIC_PAUSE_STATES = ['paused', 'gameOver', 'victory', 'tutorial'] as const

function syncMusicWithGameState(state: typeof store.gameState): void {
  if (MUSIC_PAUSE_STATES.includes(state as (typeof MUSIC_PAUSE_STATES)[number])) {
    pauseMusic()
  } else {
    resumeMusic()
  }
}

onMounted(() => {
  syncMusicWithGameState(store.gameState)
  showStartupInterstitial()

  window.addEventListener('resize', onGameViewportResize, { passive: true })
  window.addEventListener('orientationchange', onGameViewportResize, { passive: true })
  window.visualViewport?.addEventListener('resize', onGameViewportResize, { passive: true })
})

function onEngineReady(engine: GameEngine): void {
  engineRef.value = engine
  if (store.gameState === 'playing') {
    engine.start()
  }
}

watch(
  () => store.gameState,
  (state, prev) => {
    syncMusicWithGameState(state)

    if (state === 'playing' && prev !== 'paused') {
      resetSchedule()
    }

    const engine = engineRef.value
    if (engine) {
      if (state === 'playing') {
        if (prev === 'paused' || prev === 'victory' || prev === 'gameOver') {
          engine.resumePhysics()
        }
      } else if (state === 'paused' || state === 'gameOver' || state === 'victory') {
        engine.pausePhysics()
      }
    }

    const wasPlaying = prev === 'playing'
    const isPlayingNow = state === 'playing'
    if (isPlayingNow && !wasPlaying) {
      gameplayResume()
    } else if (!isPlayingNow && wasPlaying) {
      gameplayPause()
    }
  },
)

function onPause(): void {
  store.pauseGame()
}

function onResume(): void {
  store.resumeGame()
}

function onRestart(): void {
  showRestartInterstitialThen(() => {
    engineRef.value?.start()
    store.restartGame()
    resetSchedule()
  })
}

function onMenu(): void {
  const askReviewAfterMenu = store.gameState === 'victory'
  showClickInterstitialThen(() => {
    engineRef.value?.stop()
    store.goToMenu()
    if (askReviewAfterMenu) {
      tryShowPlatformReviewWhenSafe()
    }
  }, 'menu')
}

function onContinueGameOver(): void {
  if (!store.canContinueWithAd) return
  showRewarded(() => {
    engineRef.value?.continueAfterGameOver()
    store.registerAdContinue()
  })
}

function onVictoryContinue(): void {
  store.continueAfterVictory()
  engineRef.value?.resumePhysics()
}

function onGameViewportResize(): void {
  nextTick(() => gameCanvasRef.value?.relayout())
}

watch(showGameScreen, async (show) => {
  if (!show) return

  await nextTick()
  gameCanvasRef.value?.relayout()
  if (gameScreenRef.value) {
    gsap.fromTo(
      gameScreenRef.value,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: 'power2.out' },
    )
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onGameViewportResize)
  window.removeEventListener('orientationchange', onGameViewportResize)
  window.visualViewport?.removeEventListener('resize', onGameViewportResize)
})
</script>

<template>
  <div class="app-shell">
    <HomeScreen v-if="store.gameState === 'menu'" @settings="showSettings = true" />
    <ShopScreen v-else-if="store.gameState === 'shop'" @settings="showSettings = true" />
    <CollectionScreen
      v-else-if="store.gameState === 'collection'"
      @settings="showSettings = true"
    />
    <TasksScreen v-else-if="store.gameState === 'tasks'" @settings="showSettings = true" />

    <div v-if="store.gameState === 'tutorial'" class="scene-bg tutorial-bg" aria-hidden="true" />

    <div v-else-if="showGameScreen" ref="gameScreenRef" class="game-screen scene-bg">
      <div class="scene-column game-screen__column">
        <div class="game-screen__container">
          <GameHud @pause="onPause" />
          <GameCanvas
            ref="gameCanvasRef"
            :active="isCanvasActive"
            @engine-ready="onEngineReady"
          />
          <BoosterPanel />
        </div>
      </div>
    </div>

    <PauseModal
      :show="store.gameState === 'paused'"
      @resume="onResume"
      @restart="onRestart"
      @menu="onMenu"
    />

    <GameOverModal
      :show="store.gameState === 'gameOver'"
      @continue="onContinueGameOver"
      @restart="onRestart"
      @menu="onMenu"
    />

    <VictoryModal
      :show="store.gameState === 'victory'"
      @continue="onVictoryContinue"
      @menu="onMenu"
    />

    <TutorialModal :show="store.gameState === 'tutorial'" />

    <SettingsModal :show="showSettings" @close="showSettings = false" />

    <AdCountdownModal :show="showCountdown" :countdown="countdown" />

    <GameToast />
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  overscroll-behavior: none;
}

.game-screen {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}

.game-screen__column {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  height: 100%;
  max-height: 100dvh;
  min-height: 0;
}

.game-screen__container {
  container-type: inline-size;
  container-name: game-ui;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  width: 100%;
  max-width: min(100%, var(--game-column-width));
  height: 100%;
  max-height: 100%;
  min-height: 0;
}

@media (min-width: 768px) {
  .game-screen__container {
    width: var(--game-column-width);
    max-width: var(--game-column-width);
  }
}

@media (max-width: 767px) {
  .game-screen__column {
    align-items: stretch;
    max-width: 100%;
  }

  .game-screen__container {
    max-width: 100%;
  }
}

.game-screen__container :deep(.game-hud) {
  flex-shrink: 0;
}

.game-screen__container :deep(.game-screen__playfield) {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}

.game-screen__container :deep(.booster-bar) {
  flex-shrink: 0;
}

.tutorial-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
}
</style>
