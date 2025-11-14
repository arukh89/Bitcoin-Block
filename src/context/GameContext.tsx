'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Round, Guess, Log, User, ChatMessage, PrizeConfiguration } from '@/types/game'
// Realtime-only mode
import sdk from '@farcaster/miniapp-sdk'

// Real-time client import
import { connectToSpacetime, type DbConnection } from '@/lib/spacetime-client'

// Mock mode removed

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
  client: DbConnection | null
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
  const [client, setClient] = useState<DbConnection | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  const [farcasterContext, setFarcasterContext] = useState<any>(null)

  const modeLabel = 'REALTIME'
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
          
          const addressHex = '0x' + fid.toString(16).padStart(40, '0')
          const farcasterUser: User = {
            address: addressHex,
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
        console.log('🟢 Initializing REALTIME mode...')
        setConnected(false)
        
        const conn: DbConnection = await connectToSpacetime()
        
        if (mounted) {
          setClient(conn)
          console.log('✅ REALTIME Client connected')
          setConnected(true)
          console.log('✅ REALTIME Connection established!')
          console.log('🟢 Database connection ready for admin operations')
        }
      } catch (error) {
        console.error('❌ REALTIME Failed to connect:', error)
        setConnected(false)
      }
    }

    initConnection()

    return () => {
      mounted = false
    }
  }, [])

  // ===========================================
  // Subscribe to rounds table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${modeLabel}] Subscribing to rounds table...`)

    const unsubscribe: (() => void) | undefined = client.db.rounds.onInsert((ctx, row) => {
      const converted = convertRound(row)
      console.log(`➕ [${modeLabel}] New round inserted:`, converted)
      setRounds(prev => {
        const exists = prev.find(r => r.id === converted.id)
        if (exists) return prev
        return [...prev, converted]
      })
    }) as unknown as () => void

    const unsubscribeUpdate: (() => void) | undefined = client.db.rounds.onUpdate((ctx, oldRow, newRow) => {
      const converted = convertRound(newRow)
      console.log(`🔄 [${modeLabel}] Round updated:`, converted)
      setRounds(prev => prev.map(r => r.id === converted.id ? converted : r))
    }) as unknown as () => void

    // Load initial data
    const initialRounds = Array.from(client.db.rounds.iter()).map(convertRound)
    console.log(`📥 [${modeLabel}] Initial rounds loaded:`, initialRounds)
    setRounds(initialRounds)

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate()
    }
  }, [client])

  // ===========================================
  // Subscribe to guesses table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${modeLabel}] Subscribing to guesses table...`)

    const unsubscribe: (() => void) | undefined = client.db.guesses.onInsert((ctx, row) => {
      const converted = convertGuess(row)
      console.log(`➕ [${modeLabel}] New guess inserted:`, converted)
      setGuesses(prev => {
        const exists = prev.find(g => g.id === converted.id)
        if (exists) return prev
        return [...prev, converted]
      })
    }) as unknown as () => void

    // Load initial data
    const initialGuesses = Array.from(client.db.guesses.iter()).map(convertGuess)
    console.log(`📥 [${modeLabel}] Initial guesses loaded:`, initialGuesses.length, 'guesses')
    setGuesses(initialGuesses)

    return typeof unsubscribe === 'function' ? unsubscribe : undefined
  }, [client])

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

    return typeof unsubscribe === 'function' ? unsubscribe : undefined
  }, [client])

  // ===========================================
  // Subscribe to chat messages table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${modeLabel}] Subscribing to chat messages table...`)

    const unsubscribe: (() => void) | undefined = client.db.chatMessages.onInsert((ctx, row) => {
      const converted = convertChatMsg(row)
      console.log(`➕ [${modeLabel}] New chat message:`, converted)
      setChatMessages(prev => {
        const exists = prev.find(c => c.id === converted.id)
        if (exists) return prev
        return [converted, ...prev].slice(0, 100)
      })
    }) as unknown as () => void

    // Load initial data
    const initialChat = Array.from(client.db.chatMessages.iter()).map(convertChatMsg)
    console.log(`📥 [${modeLabel}] Initial chat messages loaded:`, initialChat.length, 'messages')
    setChatMessages(initialChat.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100))

    return unsubscribe
  }, [client])

  // ===========================================
  // Subscribe to prize config table
  // ===========================================
  useEffect(() => {
    if (!client) return

    console.log(`📊 [${modeLabel}] Subscribing to prize config table...`)

    const unsubscribe: (() => void) | undefined = client.db.prizeConfig.onInsert((ctx, row) => {
      const converted = convertPrizeConfig(row)
      console.log(`➕ [${modeLabel}] New prize config:`, converted)
      setPrizeConfig(converted)
    }) as unknown as () => void

    const unsubscribeUpdate: (() => void) | undefined = client.db.prizeConfig.onUpdate((ctx, oldRow, newRow) => {
      const converted = convertPrizeConfig(newRow)
      console.log(`🔄 [${modeLabel}] Prize config updated:`, converted)
      setPrizeConfig(converted)
    }) as unknown as () => void

    // Load initial data
    const initialConfigs = Array.from(client.db.prizeConfig.iter()).map(convertPrizeConfig)
    if (initialConfigs.length > 0) {
      console.log(`📥 [${modeLabel}] Initial prize config loaded:`, initialConfigs[0])
      setPrizeConfig(initialConfigs[0])
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate()
    }
  }, [client])

  // ===========================================
  // REDUCERS / ACTIONS
  // ===========================================

  const createRound = useCallback(async (roundNumber: number, _startTime: number, _endTime: number, prize: string, blockNumber?: number, duration?: number): Promise<void> => {
    console.log(`🎮 [${modeLabel}] createRound called`, { roundNumber, prize, blockNumber, duration, connected, hasClient: !!client })

    if (!client || !connected) {
      const error = 'Not connected to database'
      console.error('❌', error)
      throw new Error(error)
    }

    try {
      const roundNumBigInt = BigInt(roundNumber)
      const durationMinutes = BigInt(duration || 10)
      const blockNumBigInt = blockNumber !== undefined ? BigInt(blockNumber) : undefined

      console.log(`📤 [${modeLabel}] Creating round...`, { roundNumber, durationMinutes: durationMinutes.toString(), prize, blockNumber })
      client.reducers.createRound(roundNumBigInt, durationMinutes, prize, blockNumBigInt)
      console.log(`✅ [${modeLabel}] Round created successfully!`)
    } catch (error) {
      console.error(`❌ [${modeLabel}] Failed to create round:`, error)
      throw error
    }
  }, [client, connected])

  const submitGuess = useCallback(async (
    roundId: string, 
    address: string, 
    username: string, 
    guess: number, 
    pfpUrl: string
  ): Promise<boolean> => {
    if (!client || !connected) {
      console.warn(`⚠️ [${modeLabel}] Not connected`)
      return false
    }

    const round = rounds.find(r => r.id === roundId)
    if (!round || round.status !== 'open') {
      console.warn(`⚠️ [${modeLabel}] Round not open:`, { roundId, status: round?.status })
      return false
    }

    const now = Date.now()
    if (now >= round.endTime) {
      console.warn(`⚠️ [${modeLabel}] Round time expired`)
      return false
    }

    const hasGuessed = guesses.some(g => g.roundId === roundId && g.address.toLowerCase() === address.toLowerCase())
    if (hasGuessed) {
      console.warn(`⚠️ [${modeLabel}] User already guessed`)
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
      
      console.log(`✅ [${modeLabel}] Guess submitted!`)
      return true
    } catch (error) {
      console.error(`❌ [${modeLabel}] Failed to submit guess:`, error)
      return false
    }
  }, [client, connected, rounds, guesses])

  const endRound = useCallback(async (roundId: string): Promise<boolean> => {
    if (!client || !connected) {
      console.warn(`⚠️ [${modeLabel}] Not connected`)
      return false
    }

    const round = rounds.find(r => r.id === roundId)
    if (!round || round.status !== 'open') {
      console.warn(`⚠️ [${modeLabel}] Round not open:`, { roundId, status: round?.status })
      return false
    }

    try {
      client.reducers.endRoundManually(BigInt(roundId))
      console.log(`✅ [${modeLabel}] Round ended!`)
      return true
    } catch (error) {
      console.error(`❌ [${modeLabel}] Failed to end round:`, error)
      return false
    }
  }, [client, connected, rounds])

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
    
    console.log(`✅ [${modeLabel}] Round result updated!`)
  }, [client, connected])

  const getGuessesForRound = useCallback((roundId: string): Guess[] => {
    return guesses.filter(g => g.roundId === roundId)
  }, [guesses])

  const hasUserGuessed = useCallback((roundId: string, address: string): boolean => {
    return guesses.some(g => g.roundId === roundId && g.address.toLowerCase() === address.toLowerCase())
  }, [guesses])

  const addChatMessage = useCallback(async (message: ChatMessage): Promise<void> => {
    console.log(`💬 [${modeLabel}] addChatMessage called`, { message, connected, hasClient: !!client })
    
    if (!client || !connected) {
      const warning = 'Not connected to database'
      console.warn(`⚠️ [${modeLabel}]`, warning)
      throw new Error(warning)
    }
    
    try {
      console.log(`📤 [${modeLabel}] Sending chat message...`)
      
      client.reducers.sendChatMessage(
        message.roundId,
        message.address,
        message.username,
        message.message,
        message.pfpUrl || '',
        message.type
      )
      console.log(`✅ [${modeLabel}] Chat message sent!`)
    } catch (error) {
      console.error(`❌ [${modeLabel}] Failed to send chat message:`, error)
      throw error
    }
  }, [client, connected])

  // Auto-close round when target block is mined (via mempool.space)
  useEffect(() => {
    if (!activeRound || !client || !connected) return
    if (activeRound.status !== 'open') return
    if (!activeRound.blockNumber) return

    let cancelled = false
    const target = activeRound.blockNumber
    const roundRef = activeRound

    const checkBlock = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/mempool?action=block-hash-by-height&height=${target}`)
        return res.ok
      } catch {
        return false
      }
    }

    const tick = async (): Promise<void> => {
      if (cancelled) return
      const found = await checkBlock()
      if (found) {
        try {
          // 1) End the round first
          await endRound(roundRef.id)
          
          // 2) Fetch results from mempool.space
          const bh = await fetch(`/api/mempool?action=block-hash-by-height&height=${target}`)
          if (!bh.ok) throw new Error('Failed to fetch block hash')
          const blockHash = await bh.text()

          const tx = await fetch(`/api/mempool?action=block-txids&blockHash=${blockHash}`)
          if (!tx.ok) throw new Error('Failed to fetch txids')
          const txids = (await tx.json()) as string[]
          const actualTxCount = txids.length

          // 3) Compute winner from existing guesses
          const roundGuesses = guesses.filter(g => g.roundId === roundRef.id)
          if (roundGuesses.length > 0) {
            const sorted = [...roundGuesses].sort((a, b) => {
              const da = Math.abs(a.guess - actualTxCount)
              const db = Math.abs(b.guess - actualTxCount)
              if (da !== db) return da - db
              return a.submittedAt - b.submittedAt
            })
            const winner = sorted[0]

            // 4) Persist results
            await updateRoundResult(roundRef.id, actualTxCount, blockHash, winner.address)

            // 5) Announce to Global Chat
            await addChatMessage({
              id: String(Date.now()),
              roundId: 'global',
              address: winner.address,
              username: winner.username,
              message: `👑 Winner: @${winner.username} — guess ${winner.guess.toLocaleString()} vs actual ${actualTxCount.toLocaleString()} tx • block #${target}`,
              pfpUrl: winner.pfpUrl || '',
              timestamp: Date.now(),
              type: 'winner'
            })
          } else {
            // No guesses: still store result without winner
            await updateRoundResult(roundRef.id, actualTxCount, blockHash, '0x0')
          }
        } catch (e) {
          console.error('Auto-post results failed:', e)
        } finally {
          clearInterval(interval)
        }
      }
    }

    // Initial check, then poll every 30s
    void tick()
    const interval = setInterval(() => { void tick() }, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
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
