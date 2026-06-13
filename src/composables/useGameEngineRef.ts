import { inject, shallowRef, type InjectionKey, type Ref } from 'vue'

import type { GameEngine } from '@/game/engine/GameEngine'

export const gameEngineKey: InjectionKey<Ref<GameEngine | null>> = Symbol('gameEngine')

export function useGameEngineRef(): Ref<GameEngine | null> {
  return inject(gameEngineKey, shallowRef<GameEngine | null>(null))
}
