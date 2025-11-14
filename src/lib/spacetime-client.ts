// Real SpacetimeDB client connection using official SDK
import { DbConnection, type RemoteTables, type RemoteReducers } from '@/spacetime_module_bindings'

// SpacetimeDB connection settings
// IMPORTANT: Module must be published to testnet first using SpacetimeDB CLI
// Instructions: See DEPLOYMENT_GUIDE.md
const SPACETIME_HOST = process.env.NEXT_PUBLIC_SPACETIME_HOST || 'wss://testnet.spacetimedb.com'
const SPACETIME_DB_NAME = process.env.NEXT_PUBLIC_SPACETIME_DB_NAME || 'bitcoin-blocks'

let dbConnection: DbConnection | null = null
let isConnecting = false
let connectionError: string | null = null
let retryCount = 0
const MAX_RETRIES = 3

export async function connectToSpacetime(): Promise<DbConnection> {
  // Return existing connection if available
  if (dbConnection) {
    console.log('♻️ Reusing existing SpacetimeDB connection')
    return dbConnection
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('⏳ Connection already in progress, waiting...')
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (dbConnection) return dbConnection
    if (connectionError) throw new Error(connectionError)
  }

  try {
    isConnecting = true
    connectionError = null
    console.log('🔌 Connecting to SpacetimeDB...')
    console.log('Host:', SPACETIME_HOST)
    console.log('Database:', SPACETIME_DB_NAME)
    console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)
    
    // Set timeout for connection
    const connectionTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    })

    const connectionPromise = DbConnection.builder()
      .withUri(SPACETIME_HOST)
      .withModuleName(SPACETIME_DB_NAME)
      .onConnect((token, identity, address) => {
        console.log('✅ Connected to SpacetimeDB')
        console.log('Identity:', identity)
        console.log('Address:', address)
        retryCount = 0 // Reset retry count on successful connection
        connectionError = null
      })
      .onDisconnect((closeCode, closeReason) => {
        console.log('❌ Disconnected from SpacetimeDB')
        console.log('Code:', closeCode, 'Reason:', closeReason)
        dbConnection = null
        
        // Attempt to reconnect if not a clean disconnect
        if (closeCode !== 1000 && retryCount < MAX_RETRIES) {
          console.log('🔄 Attempting to reconnect...')
          setTimeout(() => {
            retryCount++
            connectToSpacetime().catch(err => {
              console.error('Reconnection failed:', err)
            })
          }, 2000 * (retryCount + 1)) // Exponential backoff
        }
      })
      .onError((error) => {
        console.error('⚠️ SpacetimeDB Error:', error)
        connectionError = error instanceof Error ? error.message : 'Unknown error'
      })
      .build()
    
    const conn = await Promise.race([connectionPromise, connectionTimeout])
    
    dbConnection = conn
    console.log('🎉 SpacetimeDB connection established!')
    console.log('📊 Module info:', {
      host: SPACETIME_HOST,
      database: SPACETIME_DB_NAME
    })
    return conn
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    connectionError = errorMsg
    
    console.error('❌ Failed to connect to SpacetimeDB:', error)
    
    // Provide helpful error messages
    if (errorMsg.includes('timeout')) {
      console.error('\n⚠️ CONNECTION TIMEOUT')
      console.error('The SpacetimeDB module may not be published to testnet.')
    } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      console.error('\n⚠️ MODULE NOT FOUND')
      console.error(`Module "${SPACETIME_DB_NAME}" does not exist on ${SPACETIME_HOST}`)
    } else if (errorMsg.includes('WebSocket')) {
      console.error('\n⚠️ WEBSOCKET ERROR')
      console.error('Unable to establish WebSocket connection to SpacetimeDB')
    }
    
    console.error('\n📖 TO FIX THIS:')
    console.error('1. Install SpacetimeDB CLI: curl --proto \'=https\' --tlsv1.2 -sSf https://install.spacetimedb.com | sh')
    console.error('2. Publish module: cd spacetime-server && spacetime publish', SPACETIME_DB_NAME)
    console.error('3. Or use a local instance: spacetime start')
    console.error('\nFor more info, see: DEPLOYMENT_GUIDE.md\n')
    
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    
    throw new Error(`SpacetimeDB connection failed: ${errorMsg}`)
  } finally {
    isConnecting = false
  }
}

export function getDbConnection(): DbConnection | null {
  return dbConnection
}

export function getConnectionError(): string | null {
  return connectionError
}

export function isConnectionReady(): boolean {
  return dbConnection !== null && !isConnecting
}

export type { DbConnection, RemoteTables, RemoteReducers }
