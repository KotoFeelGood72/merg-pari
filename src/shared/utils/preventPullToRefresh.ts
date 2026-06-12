const INTERNAL_SCROLL_SELECTOR = '.custom-scroll__viewport'

/**
 * Блокирует нативный pull-to-refresh и скролл страницы (требование платформы, п. 1.10).
 * Внутренний скролл — только через CustomScroll.
 */
export function bindPreventPullToRefresh(): void {
  if (typeof window === 'undefined' || !('ontouchstart' in window)) return

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault()
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest(INTERNAL_SCROLL_SELECTOR)) return

      event.preventDefault()
    },
    { passive: false },
  )
}
