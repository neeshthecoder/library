/**
 * The leaderboard's progress store, set at build time with VITE_LEADERBOARD_URL.
 * Empty when not configured: the acorns then stay plain decoration.
 */
export const LEADERBOARD_URL: string = String(import.meta.env.VITE_LEADERBOARD_URL ?? '').trim().replace(/\/+$/, '')
