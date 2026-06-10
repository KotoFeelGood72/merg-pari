<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import adIcon from '@/assets/ui/modals/ad.webp'
import { useGsapModal } from '@/composables/useGsapModal'

const props = defineProps<{
  show: boolean
  countdown: number
}>()

const overlayRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

const ringCircumference = 2 * Math.PI * 52
const ringOffset = computed(
  () => ringCircumference * (1 - props.countdown / 3),
)

useGsapModal(toRef(props, 'show'), overlayRef, panelRef, {
  staggerSelector: '.ad-countdown-modal__text, .ad-countdown-modal__hint',
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="overlayRef"
      class="ad-countdown-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ad-countdown-title"
      aria-describedby="ad-countdown-desc"
    >
      <div ref="panelRef" class="ad-countdown-modal">
        <div class="ad-countdown-modal__glow" aria-hidden="true" />

        <div class="ad-countdown-modal__icon-wrap">
          <span class="ad-countdown-modal__icon-ring" aria-hidden="true" />
          <img :src="adIcon" alt="" class="ad-countdown-modal__icon" aria-hidden="true" />
        </div>

        <header class="ad-countdown-modal__header">
          <span class="ad-countdown-modal__badge">Перерыв</span>
          <h2 id="ad-countdown-title" class="ad-countdown-modal__title">Скоро реклама</h2>
        </header>

        <p id="ad-countdown-desc" class="ad-countdown-modal__text">
          Сейчас будет показана короткая реклама
        </p>

        <div class="ad-countdown-modal__timer" aria-hidden="true">
          <svg class="ad-countdown-modal__timer-ring" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="ad-countdown-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffb347" />
                <stop offset="55%" stop-color="#e86a1a" />
                <stop offset="100%" stop-color="#c94e0f" />
              </linearGradient>
            </defs>
            <circle class="ad-countdown-modal__timer-track" cx="60" cy="60" r="52" />
            <circle
              class="ad-countdown-modal__timer-progress"
              cx="60"
              cy="60"
              r="52"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <p
            :key="countdown"
            class="ad-countdown-modal__number"
            aria-live="assertive"
            aria-atomic="true"
          >
            {{ countdown }}
          </p>
        </div>

        <p class="ad-countdown-modal__hint">Игра продолжится автоматически</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ad-countdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(16px, var(--app-safe-top))
    max(16px, var(--app-safe-right))
    max(16px, var(--app-safe-bottom))
    max(16px, var(--app-safe-left));
  background:
    radial-gradient(circle at 50% 38%, rgba(74, 158, 240, 0.14) 0%, transparent 52%),
    rgba(12, 8, 6, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: all;
  touch-action: none;
  user-select: none;
}

.ad-countdown-modal {
  position: relative;
  width: min(100%, 320px);
  padding: 28px 24px 26px;
  border-radius: 30px;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(180deg, #fff9ef 0%, #f5e6c8 52%, #edd9b0 100%);
  border: 4px solid #c49a6c;
  box-shadow:
    0 20px 56px rgba(40, 24, 10, 0.48),
    inset 0 2px 8px rgba(255, 255, 255, 0.88);
}

.ad-countdown-modal__glow {
  position: absolute;
  top: -40px;
  left: 50%;
  width: 220px;
  height: 220px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 158, 240, 0.28) 0%, transparent 68%);
  pointer-events: none;
}

.ad-countdown-modal__icon-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin: 0 auto 14px;
}

.ad-countdown-modal__icon-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #ffffff 0%, #e8f2ff 55%, #cfe4ff 100%);
  border: 3px solid rgba(255, 255, 255, 0.95);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.9),
    inset 0 -3px 6px rgba(42, 111, 200, 0.12),
    0 8px 22px rgba(42, 111, 200, 0.28);
  animation: ad-countdown-ring-pulse 1.6s ease-in-out infinite;
}

.ad-countdown-modal__icon {
  position: relative;
  z-index: 1;
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(42, 111, 200, 0.35));
  animation: ad-countdown-icon-float 2.4s ease-in-out infinite;
}

.ad-countdown-modal__header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.ad-countdown-modal__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2a6fc8;
  background: linear-gradient(180deg, #eef6ff 0%, #d6ebff 100%);
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 2px 8px rgba(42, 111, 200, 0.18);
}

.ad-countdown-modal__title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: #5c3a1e;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
}

.ad-countdown-modal__text {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  padding: 0 8px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #7a5a3a;
}

.ad-countdown-modal__timer {
  position: relative;
  z-index: 1;
  width: 120px;
  height: 120px;
  margin: 0 auto 14px;
}

.ad-countdown-modal__timer-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ad-countdown-modal__timer-track {
  fill: none;
  stroke: rgba(196, 154, 108, 0.35);
  stroke-width: 8;
}

.ad-countdown-modal__timer-progress {
  fill: none;
  stroke: url(#ad-countdown-gradient);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 326.73;
  transition: stroke-dashoffset 0.35s ease;
  filter: drop-shadow(0 0 6px rgba(232, 106, 26, 0.35));
}

.ad-countdown-modal__number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
  color: #e86a1a;
  text-shadow:
    0 2px 0 rgba(120, 52, 8, 0.22),
    0 4px 14px rgba(232, 106, 26, 0.28);
  animation: ad-countdown-pop 0.35s ease-out;
}

.ad-countdown-modal__hint {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #9a7a5a;
  opacity: 0.92;
}

@keyframes ad-countdown-pop {
  0% {
    transform: scale(0.55);
    opacity: 0.35;
  }
  60% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes ad-countdown-ring-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow:
      inset 0 2px 5px rgba(255, 255, 255, 0.9),
      inset 0 -3px 6px rgba(42, 111, 200, 0.12),
      0 8px 22px rgba(42, 111, 200, 0.28);
  }
  50% {
    transform: scale(1.04);
    box-shadow:
      inset 0 2px 5px rgba(255, 255, 255, 0.9),
      inset 0 -3px 6px rgba(42, 111, 200, 0.12),
      0 10px 28px rgba(42, 111, 200, 0.38);
  }
}

@keyframes ad-countdown-icon-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
