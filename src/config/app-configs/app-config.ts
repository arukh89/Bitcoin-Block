// Application Configuration
// Switch between mock and real-time mode

export type AppMode = 'mock' | 'realtime'

export const APP_CONFIG = {
  // Current mode: 'mock' or 'realtime'
  // Set to 'mock' for testing with mock data
  // Set to 'realtime' for production with real SpacetimeDB
  mode: (process.env.NEXT_PUBLIC_USE_MOCK === 'false' ? 'realtime' : 'mock') as AppMode,
  
  // Mock mode settings
  mock: {
    autoLogin: true, // Auto-login as admin in mock mode
    adminAddress: '0x09D02D25D0D082f7F2E04b4838cEfe271b2daB09',
    initialRound: {
      prize: '5,000 $SECOND',
      blockNumber: 875420,
      duration: 24 * 60 * 60 * 1000 // 24 hours
    }
  },
  
  // Real-time mode settings
  realtime: {
    spacetimeHost: process.env.NEXT_PUBLIC_SPACETIME_HOST || 'wss://testnet.spacetimedb.com',
    spacetimeDbName: process.env.NEXT_PUBLIC_SPACETIME_DB_NAME || 'bitcoin-blocks',
    bitcoinApiInterval: 10000, // Fetch Bitcoin data every 10 seconds
    mempoolApiUrl: 'https://mempool.space/api'
  }
} as const

export function isMockMode(): boolean {
  return APP_CONFIG.mode === 'mock'
}

export function isRealtimeMode(): boolean {
  return APP_CONFIG.mode === 'realtime'
}
