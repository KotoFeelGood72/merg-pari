import { runWhenSafeFromAds } from '@/ads/ads'
import { checkCanReview, openPlatformReview } from '@/yandex/sdk'

export function tryShowPlatformReviewWhenSafe(): void {
  runWhenSafeFromAds(() => {
    void tryShowPlatformReviewNow()
  })
}

export async function tryShowPlatformReviewNow(): Promise<boolean> {
  if (!(await checkCanReview())) return false
  return openPlatformReview()
}
