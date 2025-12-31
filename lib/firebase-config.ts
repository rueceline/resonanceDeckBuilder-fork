// lib/firebase-config.ts
// Phase 1: Firebase 제거 버전 (no-op)

export const db = null
export const analytics = null

export const logEventWrapper = (eventName: string, eventParams?: Record<string, any>) => {
  // 개발 중에는 필요하면 로그만
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] Event: ${eventName}`, eventParams)
  }
}
