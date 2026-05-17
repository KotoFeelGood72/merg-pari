<script setup lang="ts">
import GameModal from './GameModal.vue'
import { useGameStore } from '@/stores/game'
import iconCoin from '@/assets/coin.png'
import iconStone from '@/assets/stone.png'
import iconClover from '@/assets/clever.png'
import iconChest1 from '@/assets/sunduk-1.png'
import iconChest2 from '@/assets/sunduk-2.png'
import iconChest3 from '@/assets/sunduk-3.png'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const game = useGameStore()

interface Booster {
  id: string
  title: string
  desc: string
  emoji: string
  image?: string
  iconBg: string
  cost: number
  apply: () => void
}
const BOOSTERS: Booster[] = [
  {
    id: 'goldx2',
    title: 'x2 Монеты',
    desc: 'на 5 минут',
    emoji: '🪙',
    image: iconCoin,
    iconBg: 'linear-gradient(180deg, #ffe680, #c89030)',
    cost: 20,
    apply: () => {
      game.goldX2Until = Math.max(Date.now(), game.goldX2Until) + 300_000
    },
  },
  {
    id: 'speedx2',
    title: 'x2 Скорость',
    desc: 'на 5 минут',
    emoji: '⚡',
    image: iconCoin,
    iconBg: 'linear-gradient(180deg, #ffe680, #c89030)',
    cost: 20,
    apply: () => {
      game.autoClickUntil = Math.max(Date.now(), game.autoClickUntil) + 300_000
    },
  },
  {
    id: 'luckx2',
    title: 'x2 Удача',
    desc: 'на 5 минут',
    emoji: '🍀',
    image: iconClover,
    iconBg: 'linear-gradient(180deg, #8af070, #2e8b3a)',
    cost: 20,
    apply: () => {
      game.critX2Until = Math.max(Date.now(), game.critX2Until) + 300_000
    },
  },
]

interface Bundle {
  id: string
  title: string
  gems: number
  gold: number
  image: string
  price: number
}
const BUNDLES: Bundle[] = [
  { id: 'starter', title: 'Стартовый', gems: 200,  gold: 10_000,  image: iconChest1, price: 129 },
  { id: 'big',     title: 'Большой',   gems: 550,  gold: 50_000,  image: iconChest2, price: 299 },
  { id: 'huge',    title: 'Огромный',  gems: 1200, gold: 120_000, image: iconChest3, price: 599 },
]

function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toString()
  const units = ['', 'K', 'M', 'B']
  let i = 0
  let v = n
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return v.toFixed(v < 10 ? 1 : 0) + units[i]
}

function buyBooster(b: Booster) {
  if (game.diamonds < b.cost) return
  game.diamonds -= b.cost
  b.apply()
}
function buyBundle(b: Bundle) {
  if (game.diamonds < b.price) return
  game.diamonds -= b.price
  game.diamonds += b.gems
  game.addGold(b.gold)
}
</script>

<template>
  <GameModal :open="open" title="Магазин" @close="emit('close')">
    <!-- Boosters -->
    <div class="section">
      <div class="section-title">Бустеры</div>
      <div class="grid-3">
        <button
          v-for="b in BOOSTERS"
          :key="b.id"
          class="card booster"
          :disabled="game.diamonds < b.cost"
          @click="buyBooster(b)"
        >
          <div class="card-icon" :style="{ background: b.iconBg }">
            <img v-if="b.image" :src="b.image" alt="" class="card-img" />
            <span v-else class="card-emoji">{{ b.emoji }}</span>
          </div>
          <div class="card-title">{{ b.title }}</div>
          <div class="card-desc">{{ b.desc }}</div>
          <div class="card-price">
            <img :src="iconStone" alt="" class="gem" />
            <span>{{ b.cost }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Bundles -->
    <div class="section">
      <div class="section-title">Наборы</div>
      <div class="grid-3">
        <button
          v-for="b in BUNDLES"
          :key="b.id"
          class="card bundle"
          :disabled="game.diamonds < b.price"
          @click="buyBundle(b)"
        >
          <div class="bundle-head">
            <img :src="iconStone" alt="" class="gem" />
            <span>{{ b.gems }}</span>
          </div>
          <div class="card-art">
            <img :src="b.image" alt="" class="chest-img" />
          </div>
          <div class="bundle-loot">
            <img :src="iconCoin" alt="" class="coin-mini" />
            <span>{{ fmt(b.gold) }}</span>
          </div>
          <div class="card-price">
            <img :src="iconStone" alt="" class="gem" />
            <span>{{ b.price }}</span>
          </div>
        </button>
      </div>
    </div>

  </GameModal>
</template>

<style scoped>
.section {
  margin-bottom: 12px;
}
.section:last-child { margin-bottom: 0; }
.section-title {
  font-size: 14px;
  font-weight: 900;
  color: #fff5d0;
  margin-bottom: 6px;
  padding-left: 4px;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

/* Generic card */
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #4a8cd8 0%, #1f5fa8 50%, #103e7a 100%);
  border: 2px solid #0a2a5a;
  font-family: inherit;
  color: #fff5d0;
  cursor: pointer;
  text-align: center;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.3),
    inset 0 -2px 0 rgba(0, 0, 0, 0.3),
    0 3px 0 #0a1f4a,
    0 5px 8px rgba(0, 0, 0, 0.5);
  transition: transform 0.08s, box-shadow 0.08s;
}
.card:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.25),
    inset 0 -2px 0 rgba(0, 0, 0, 0.3),
    0 1px 0 #0a1f4a;
}
.card:disabled {
  filter: grayscale(0.6) brightness(0.7);
  cursor: not-allowed;
}

/* Booster icon circle */
.card-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid #2a1408;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.4),
    inset 0 -2px 0 rgba(0, 0, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.5);
}
.card-emoji {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}
.card-emoji.big {
  font-size: 38px;
}
.card-img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}
.chest-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.card-title {
  font-size: 12px;
  font-weight: 900;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.card-desc {
  font-size: 10px;
  color: #c4d8f8;
  margin-bottom: 4px;
}

/* Price chip */
.card-price {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.45);
  border: 1.5px solid rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  padding: 3px 10px;
  font-size: 13px;
  font-weight: 900;
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.gem {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7));
}

/* Bundle cards */
.bundle-head {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 13px;
  font-weight: 900;
}
.card-art {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2px 0;
}
.bundle-loot {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  color: #ffd95a;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.coin-mini {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

</style>
