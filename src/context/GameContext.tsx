'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Round, Guess, Log, User, ChatMessage, PrizeConfiguration } from '@/types/game'
import { APP_CONFIG, isMockMode, isRealtimeMode } from '@/config/app-config'
import sdk from '@farcaster/miniapp-sdk'

// Real-time client import
import { connectToSpacetime, type DbConnection } from '@/lib/spacetime-client'

// Mock client import (for fallback)
import { connectToMockSpacetime, type MockDbConnection } from '@/lib/mock-spacetime-client'

import type { 
  Round as STDBRound, 
  Guess as STDBGuess, 
  LogEvent as STDBLog,
  ChatMessage as STDBChatMsg,
  PrizeConfig as STDBPrizeConfig 
} from '@/spacetime_module_bindings'

interface GameContextType {
  user: User | null
  setUser: (user: User | null) => void
  rounds: Round[]
  guesses: Guess[]
  logs: Log[]
  chatMessages: ChatMessage[]
  activeRound: Round | null
  prizeConfig: PrizeConfiguration | null
  createRound: (roundNumber: number, startTime: number, endTime: number, prize: string, blockNumber?: number, duration?: number) => Promise<void>
  submitGuess: (roundId: string, address: string, username: string, guess: number, pfpUrl: string) => Promise<boolean>
  endRound: (roundId: string) => Promise<boolean>
  updateRoundResult: (roundId: string, actualTxCount: number, blockHash: string, winningAddress: string) => Promise<void>
  getGuessesForRound: (roundId: string) => Guess[]
  hasUserGuessed: (roundId: string, address: string) => boolean
  addChatMessage: (message: ChatMessage) => void
  connected: boolean
  mode: 'mock' | 'realtime'
  client: MockDbConnection | DbConnection | null
  userFid: number | null
}

const GameContext = createContext<GameContextType | undefined>(undefined)

// Admin Farcaster FIDs
export const ADMIN_FIDS = [
  250704,  // ukhy89
  1107084  // miggles.eth
]

export function isAdminFid(fid: number): boolean {
  return ADMIN_FIDS.includes(fid)
}

// Legacy function for backward compatibility - now checks FID from fid-prefixed address
export function isDevAddress(address: string): boolean {
  if (address.startsWith('fid-')) {
    const fid = parseInt(address.replace('fid-', ''))
    return isAdminFid(fid)
  }
  return false
}

// Convert SpacetimeDB bigint timestamps to JS milliseconds
function toMillis(bigintSeconds: bigint): number {
  return Number(bigintSeconds) * 1000
}

function convertRound(r: STDBRound): Round {
  return {
    id: String(r.roundId),
    roundNumber: Number(r.roundNumber),
    startTime: toMillis(r.startTime),
    endTime: toMillis(r.endTime),
    prize: r.prize,
    status: r.status as 'open' | 'closed' | 'finished',
    blockNumber: r.blockNumber ? Number(r.blockNumber) : undefined,
    actualTxCount: r.actualTxCount ? Number(r.actualTxCount) : undefined,
    winningAddress: r.winningFid ? `0x${r.winningFid.toString(16).padStart(40, '0')}` : undefined,
    blockHash: r.blockHash || undefined,
    createdAt: toMillis(r.createdAt),
    duration: Number(r.durationMinutes)
  }
}

function convertGuess(g: STDBGuess): Guess {
  return {
    id: String(g.guessId),
    roundId: String(g.roundId),
    address: `0x${g.fid.toString(16).padStart(40, '0')}`,
    username: g.username,
    guess: Number(g.guess),
    pfpUrl: g.pfpUrl || '',
    submittedAt: toMillis(g.submittedAt)
  }
}

function convertLog(l: STDBLog): Log {
  return {
    id: String(l.logId),
    eventType: l.eventType,
    details: l.details,
    timestamp: toMillis(l.timestamp)
  }
}

function convertChatMsg(c: STDBChatMsg): ChatMessage {
  return {
    id: String(c.chatId),
    roundId: c.roundId,
    address: c.address,
    username: c.username,
    message: c.message,
    pfpUrl: c.pfpUrl,
    timestamp: toMillis(c.timestamp),
    type: c.msgType as 'guess' | 'system' | 'winner' | 'chat'
  }
}

function convertPrizeConfig(p: STDBPrizeConfig): PrizeConfiguration {
  return {
    id: p.configId,
    jackpotAmount: String(p.jackpotAmount),
    firstPlaceAmount: String(p.firstPlaceAmount),
    secondPlaceAmount: String(p.secondPlaceAmount),
    currencyType: p.currencyType,
    tokenContractAddress: p.tokenContractAddress,
    updatedAt: toMillis(p.updatedAt)
  }
}

export function GameProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [prizeConfig, setPrizeConfig] = useState<PrizeConfiguration | null>(null)
  const [client, setClient] = useState<MockDbConnection | DbConnection | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  const [farcasterContext, setFarcasterContext] = useState<any>(null)

  const mode = APP_CONFIG.mode
  const activeRound = rounds.find(r => r.status === 'open') || null

  // ===========================================
  // FARCASTER SDK INITIALIZATION
  // ===========================================
  useEffect(() => {
    const initFarcaster = async (): Promise<void> => {
      try {
        console.log('🟣 Initializing Farcaster SDK...')
        await sdk.actions.ready()
        const context = await sdk.context
        console.log('✅ Farcaster SDK ready:', context)
        setFarcasterContext(context)
        
        // Auto-login with Farcaster user data
        if (context.user) {
          const fid = context.user.fid
          const isAdmin = isAdminFid(fid)
          
          console.log('👤 Processing Farcaster user:', {
            fid,
            username: context.user.username,
            isAdminFid: isAdmin,
            adminFids: ADMIN_FIDS
          })
          
          const farcasterUser: User = {
            address: `fid-${fid}`,
            username: context.user.username || `user${fid}`,
            displayName: context.user.displayName || context.user.username || 'Anonymous',
            pfpUrl: context.user.pfpUrl || 'https://i.imgur.com/placeholder.jpg',
            isAdmin
          }
          setUser(farcasterUser)
          setUserFid(fid)
          console.log('✅ Auto-logged in with Farcaster user:', {
            address: farcasterUser.address,
            username: farcasterUser.username,
            isAdmin: farcasterUser.isAdmin,
            fid
          })
        }
      } catch (error) {
        console.warn('⚠️ Farcaster SDK not available (might be outside mini app):', error)
      }
    }

    initFarcaster()
  }, [])

  // ===========================================
  // DATABASE CONNECTION
  // ===========================================
  useEffect(() => {
    let mounted = true

    const initConnection = async (): Promise<void> => {
      try {
        console.log(`🟢 Initializing ${mode.toUpperCase()} mode...`)
        setConnected(false)
        
        let conn: MockDbConnection | DbConnection
        
        if (isRealtimeMode()) {
          console.log('🔌 Connecting to real SpacetimeDB...')
          conn = await connectToSpacetime()
        } else {
          console.log('🧪 Connecting to mock SpacetimeDB...')
          conn = await connectToMockSpacetime()
        }
        
        if (mounted) {
          setClient(conn)
          console.log(`✅ ${mode.toUpperCase()} Client connected`)
          setConnected(true)
          console.log(`✅ ${mode.toUpperCase()} Connection established!`)
          console.log('🟢 Database connection ready for admin operations')
        }
      } catch (error) {
        console.error(`❌ ${mode.toUpperCase()} Failed to connect:`, error)
        setConnected(false)
      }
    }

    initConnection()

    return () => {
      mounted = false
    }
  }, [mode])

  // ===========================================
  // Subscribe to rounds table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${mode.toUpperCase()}] Subscribing to rounds table...`)

    const unsubscribe = client.db.rounds.onInsert((ctx, row) => {
      const converted = convertRound(row)
      console.log(`➕ [${mode.toUpperCase()}] New round inserted:`, converted)
      setRounds(prev => {
        const exists = prev.find(r => r.id === converted.id)
        if (exists) return prev
        return [...prev, converted]
      })
    })

    const unsubscribeUpdate = client.db.rounds.onUpdate((ctx, oldRow, newRow) => {
      const converted = convertRound(newRow)
      console.log(`🔄 [${mode.toUpperCase()}] Round updated:`, converted)
      setRounds(prev => prev.map(r => r.id === converted.id ? converted : r))
    })

    // Load initial data
    const initialRounds = Array.from(client.db.rounds.iter()).map(convertRound)
    console.log(`📥 [${mode.toUpperCase()}] Initial rounds loaded:`, initialRounds)
    setRounds(initialRounds)

    return () => {
      unsubscribe()
      unsubscribeUpdate()
    }
  }, [client, mode])

  // ===========================================
  // Subscribe to guesses table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${mode.toUpperCase()}] Subscribing to guesses table...`)

    const unsubscribe = client.db.guesses.onInsert((ctx, row) => {
      const converted = convertGuess(row)
      console.log(`➕ [${mode.toUpperCase()}] New guess inserted:`, converted)
      setGuesses(prev => {
        const exists = prev.find(g => g.id === converted.id)
        if (exists) return prev
        return [...prev, converted]
      })
    })

    // Load initial data
    const initialGuesses = Array.from(client.db.guesses.iter()).map(convertGuess)
    console.log(`📥 [${mode.toUpperCase()}] Initial guesses loaded:`, initialGuesses.length, 'guesses')
    setGuesses(initialGuesses)

    return unsubscribe
  }, [client, mode])

  // ===========================================
  // Subscribe to logs table
  // ===========================================
  useEffect(() => {
    if (!client) return

    const unsubscribe = client.db.logs.onInsert((ctx, row) => {
      const converted = convertLog(row)
      setLogs(prev => {
        const exists = prev.find(l => l.id === converted.id)
        if (exists) return prev
        return [...prev, converted]
      })
    })

    // Load initial data
    const initialLogs = Array.from(client.db.logs.iter()).map(convertLog)
    setLogs(initialLogs)

    return unsubscribe
  }, [client])

  // ===========================================
  // Subscribe to chat messages table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${mode.toUpperCase()}] Subscribing to chat messages table...`)

    const unsubscribe = client.db.chatMessages.onInsert((ctx, row) => {
      const converted = convertChatMsg(row)
      console.log(`➕ [${mode.toUpperCase()}] New chat message:`, converted)
      setChatMessages(prev => {
        const exists = prev.find(c => c.id === converted.id)
        if (exists) return prev
        return [converted, ...prev].slice(0, 100)
      })
    })

    // Load initial data
    const initialChat = Array.from(client.db.chatMessages.iter()).map(convertChatMsg)
    console.log(`📥 [${mode.toUpperCase()}] Initial chat messages loaded:`, initialChat.length, 'messages')
    setChatMessages(initialChat.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100))

    return unsubscribe
  }, [client, mode])

  // ===========================================
  // Subscribe to prize config table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${mode.toUpperCase()}] Subscribing to prize config table...`)

    const unsubscribe = client.db.prizeConfigs.onInsert((ctx, row) => {
      const converted = convertPrizeConfig(row)
      console.log(`➕ [${mode.toUpperCase()}] New prize config:`, converted)
      setPrizeConfig(converted)
    })

    const unsubscribeUpdate = client.db.prizeConfigs.onUpdate((ctx, oldRow, newRow) => {
      const converted = convertPrizeConfig(newRow)
      console.log(`🔄 [${mode.toUpperCase()}] Prize config updated:`, converted)
      setPrizeConfig(converted)
    })

    // Load initial data
    const initialConfigs = Array.from(client.db.prizeConfigs.iter()).map(convertPrizeConfig)
    if (initialConfigs.length > 0) {
      console.log(`📥 [${mode.toUpperCase()}] Initial prize config loaded:`, initialConfigs[0])
      setPrizeConfig(initialConfigs[0])
    }

    return () => {
      unsubscribe()
      unsubscribeUpdate()
    }
  }, [client, mode])

  // ===========================================
  // REDUCERS / ACTIONS
  // ===========================================

  const createRound = useCallback(async (roundNumber: number, startTime: number, endTime: number, prize: string, blockNumber?: number, duration?: number): Promise<void> => {
    console.log(`🎮 [${mode.toUpperCase()}] createRound called`, { roundNumber, startTime, endTime, prize, blockNumber, duration, connected, hasClient: !!client })
    
    if (!client || !connected) {
      const error = 'Not connected to database'
      console.error('❌', error)
      throw new Error(error)
    }
    
    try {
      const roundNumBigInt = BigInt(roundNumber)
      const durationMinutes = BigInt(duration || 10)
      const blockNumBigInt = blockNumber !== undefined ? BigInt(blockNumber) : null
      
      console.log(`📤 [${mode.toUpperCase()}] Creating round...`, { roundNumber, durationMinutes: durationMinutes.toString(), prize, blockNumber })
      client.reducers.createRound(roundNumBigInt, durationMinutes, prize, blockNumBigInt)
      console.log(`✅ [${mode.toUpperCase()}] Round created successfully!`)
    } catch (error) {
      console.error(`❌ [${mode.toUpperCase()}] Failed to create round:`, error)
      throw error
    }
  }, [client, connected, mode])

  const submitGuess = useCallback(async (
    roundId: string, 
    address: string, 
    username: string, 
    guess: number, 
    pfpUrl: string
  ): Promise<boolean> => {
    if (!client || !connected) {
      console.warn(`⚠️ [${mode.toUpperCase()}] Not connected`)
      return false
    }

    const round = rounds.find(r => r.id === roundId)
    if (!round || round.status !== 'open') {
      console.warn(`⚠️ [${mode.toUpperCase()}] Round not open:`, { roundId, status: round?.status })
      return false
    }

    const now = Date.now()
    if (now >= round.endTime) {
      console.warn(`⚠️ [${mode.toUpperCase()}] Round time expired`)
      return false
    }

    const hasGuessed = guesses.some(g => g.roundId === roundId && g.address.toLowerCase() === address.toLowerCase())
    if (hasGuessed) {
      console.warn(`⚠️ [${mode.toUpperCase()}] User already guessed`)
      return false
    }

    try {
      // Convert hex address to BigInt (remove 0x prefix first)
      const addressHex = address.toLowerCase().startsWith('0x') ? address.slice(2) : address
      const addressBigInt = BigInt('0x' + addressHex)
      
      client.reducers.submitGuess(
        BigInt(roundId),
        addressBigInt,
        username,
        BigInt(guess),
        pfpUrl || undefined
      )
      
      console.log(`✅ [${mode.toUpperCase()}] Guess submitted!`)
      return true
    } catch (error) {
      console.error(`❌ [${mode.toUpperCase()}] Failed to submit guess:`, error)
      return false
    }
  }, [client, connected, rounds, guesses, mode])

  const endRound = useCallback(async (roundId: string): Promise<boolean> => {
    if (!client || !connected) {
      console.warn(`⚠️ [${mode.toUpperCase()}] Not connected`)
      return false
    }

    const round = rounds.find(r => r.id === roundId)
    if (!round || round.status !== 'open') {
      console.warn(`⚠️ [${mode.toUpperCase()}] Round not open:`, { roundId, status: round?.status })
      return false
    }

    try {
      client.reducers.endRoundManually(BigInt(roundId))
      console.log(`✅ [${mode.toUpperCase()}] Round ended!`)
      return true
    } catch (error) {
      console.error(`❌ [${mode.toUpperCase()}] Failed to end round:`, error)
      return false
    }
  }, [client, connected, rounds, mode])

  const updateRoundResult = useCallback(async (
    roundId: string, 
    actualTxCount: number, 
    blockHash: string, 
    winningAddress: string
  ): Promise<void> => {
    if (!client || !connected) {
      throw new Error('Not connected to database')
    }
    
    // Convert hex address to BigInt (remove 0x prefix first)
    const addressHex = winningAddress.toLowerCase().startsWith('0x') ? winningAddress.slice(2) : winningAddress
    const winningAddressBigInt = BigInt('0x' + addressHex)
    
    client.reducers.updateRoundResult(
      BigInt(roundId),
      BigInt(actualTxCount),
      blockHash,
      winningAddressBigInt
    )
    
    console.log(`✅ [${mode.toUpperCase()}] Round result updated!`)
  }, [client, connected, mode])

  const getGuessesForRound = useCallback((roundId: string): Guess[] => {
    return guesses.filter(g => g.roundId === roundId)
  }, [guesses])

  const hasUserGuessed = useCallback((roundId: string, address: string): boolean => {
    return guesses.some(g => g.roundId === roundId && g.address.toLowerCase() === address.toLowerCase())
  }, [guesses])

  const addChatMessage = useCallback(async (message: ChatMessage): Promise<void> => {
    console.log(`💬 [${mode.toUpperCase()}] addChatMessage called`, { message, connected, hasClient: !!client })
    
    if (!client || !connected) {
      const warning = 'Not connected to database'
      console.warn(`⚠️ [${mode.toUpperCase()}]`, warning)
      throw new Error(warning)
    }
    
    try {
      console.log(`📤 [${mode.toUpperCase()}] Sending chat message...`)
      
      client.reducers.sendChatMessage(
        message.roundId,
        message.address,
        message.username,
        message.message,
        message.pfpUrl || '',
        message.type
      )
      console.log(`✅ [${mode.toUpperCase()}] Chat message sent!`)
    } catch (error) {
      console.error(`❌ [${mode.toUpperCase()}] Failed to send chat message:`, error)
      throw error
    }
  }, [client, connected, mode])

  // Auto-close rounds when end time is reached
  useEffect(() => {
    if (!activeRound || !client || !connected) return

    const checkRoundEnd = (): void => {
      const now = Date.now()
      if (activeRound.status === 'open' && now >= activeRound.endTime) {
        endRound(activeRound.id).catch(console.error)
      }
    }

    const interval = setInterval(checkRoundEnd, 1000)
    return () => clearInterval(interval)
  }, [activeRound, client, connected, endRound])

  const value: GameContextType = {
    user,
    setUser,
    rounds,
    guesses,
    logs,
    chatMessages,
    activeRound,
    prizeConfig,
    createRound,
    submitGuess,
    endRound,
    updateRoundResult,
    getGuessesForRound,
    hasUserGuessed,
    addChatMessage,
    connected,
    mode,
    client,
    userFid
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextType {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
