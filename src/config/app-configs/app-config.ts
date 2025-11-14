// Application Configuration (Realtime-only)

export const APP_CONFIG = {
  spacetimeHost: process.env.NEXT_PUBLIC_SPACETIME_HOST || '',
  spacetimeDbName: process.env.NEXT_PUBLIC_SPACETIME_DB_NAME || '',
  bitcoinApiInterval: 10000, // Fetch Bitcoin data every 10 seconds
  // Use env override if provided; default to public mempool.space API
  mempoolApiUrl: process.env.NEXT_PUBLIC_MEMPOOL_API_URL || 'https://mempool.space/api'
} as const
