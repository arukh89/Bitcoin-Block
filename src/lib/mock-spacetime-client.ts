'use client'

import type { Round, Guess, ChatMessage as ChatMsg, LogEvent } from '@/spacetime_module_bindings'

// Prize Config interface - matches SpacetimeDB schema
export interface PrizeConfig {
  configId: number
  jackpotAmount: bigint
  firstPlaceAmount: bigint
  secondPlaceAmount: bigint
  currencyType: string
  tokenContractAddress: string
  updatedAt: bigint
}

// Mock database state - persisted in memory
class MockDatabase {
  private rounds: Map<bigint, Round> = new Map()
  private guesses: Map<bigint, Guess> = new Map()
  private chatMessages: Map<bigint, ChatMsg> = new Map()
  private logs: Map<bigint, LogEvent> = new Map()
  private prizeConfigs: Map<bigint, PrizeConfig> = new Map()
  
  private roundIdCounter = 1n
  private guessIdCounter = 1n
  private chatIdCounter = 1n
  private logIdCounter = 1n
  private configIdCounter = 1

  private roundsListeners: Set<(ctx: any, row: Round) => void> = new Set()
  private roundsUpdateListeners: Set<(ctx: any, oldRow: Round, newRow: Round) => void> = new Set()
  private guessesListeners: Set<(ctx: any, row: Guess) => void> = new Set()
  private chatListeners: Set<(ctx: any, row: ChatMsg) => void> = new Set()
  private logsListeners: Set<(ctx: any, row: LogEvent) => void> = new Set()
  private prizeConfigListeners: Set<(ctx: any, row: PrizeConfig) => void> = new Set()
  private prizeConfigUpdateListeners: Set<(ctx: any, oldRow: PrizeConfig, newRow: PrizeConfig) => void> = new Set()

  // Rounds table
  rounds_table = {
    iter: () => this.rounds.values(),
    onInsert: (callback: (ctx: any, row: Round) => void) => {
      this.roundsListeners.add(callback)
      return () => this.roundsListeners.delete(callback)
    },
    onUpdate: (callback: (ctx: any, oldRow: Round, newRow: Round) => void) => {
      this.roundsUpdateListeners.add(callback)
      return () => this.roundsUpdateListeners.delete(callback)
    }
  }

  // Guesses table
  guesses_table = {
    iter: () => this.guesses.values(),
    onInsert: (callback: (ctx: any, row: Guess) => void) => {
      this.guessesListeners.add(callback)
      return () => this.guessesListeners.delete(callback)
    }
  }

  // Chat messages table
  chatMessages_table = {
    iter: () => this.chatMessages.values(),
    onInsert: (callback: (ctx: any, row: ChatMsg) => void) => {
      this.chatListeners.add(callback)
      return () => this.chatListeners.delete(callback)
    }
  }

  // Logs table
  logs_table = {
    iter: () => this.logs.values(),
    onInsert: (callback: (ctx: any, row: LogEvent) => void) => {
      this.logsListeners.add(callback)
      return () => this.logsListeners.delete(callback)
    }
  }

  // Prize Config table
  prizeConfigs_table = {
    iter: () => this.prizeConfigs.values(),
    onInsert: (callback: (ctx: any, row: PrizeConfig) => void) => {
      this.prizeConfigListeners.add(callback)
      return () => this.prizeConfigListeners.delete(callback)
    },
    onUpdate: (callback: (ctx: any, oldRow: PrizeConfig, newRow: PrizeConfig) => void) => {
      this.prizeConfigUpdateListeners.add(callback)
      return () => this.prizeConfigUpdateListeners.delete(callback)
    },
    getLatest: (): PrizeConfig | null => {
      const configs = Array.from(this.prizeConfigs.values())
      if (configs.length === 0) return null
      return configs[configs.length - 1]
    }
  }

  // Reducer: Create Round
  createRound(roundNumber: bigint, durationMinutes: bigint, prize: string, blockNumber: bigint | null): void {
    const roundId = this.roundIdCounter++
    const now = BigInt(Math.floor(Date.now() / 1000))
    const startTime = now
    const endTime = now + (durationMinutes * 60n)
    
    const round: Round = {
      roundId,
      roundNumber,
      startTime,
      endTime,
      durationMinutes,
      prize,
      status: 'open',
      blockNumber,
      actualTxCount: null,
      winningFid: null,
      blockHash: null,
      createdAt: now
    }

    this.rounds.set(roundId, round)
    console.log('🎮 [MOCK] Round created:', round)

    // Notify listeners
    this.roundsListeners.forEach(listener => listener({}, round))

    // Create log entry
    const blockNumStr = blockNumber ? `#${blockNumber}` : 'N/A'
    this.addLog('round_created', `Round #${roundNumber} created for Block ${blockNumStr} with prize ${prize} - Duration: ${durationMinutes} minutes`)
  }

  // Reducer: Submit Guess
  submitGuess(
    roundId: bigint,
    fid: bigint,
    username: string,
    guess: bigint,
    pfpUrl?: string
  ): void {
    const guessId = this.guessIdCounter++
    const now = BigInt(Math.floor(Date.now() / 1000))

    const guessEntry: Guess = {
      guessId,
      roundId,
      fid,
      username,
      guess,
      pfpUrl: pfpUrl || '',
      submittedAt: now
    }

    this.guesses.set(guessId, guessEntry)
    console.log('🎯 [MOCK] Guess submitted:', guessEntry)

    // Notify listeners
    this.guessesListeners.forEach(listener => listener({}, guessEntry))

    // Create log entry
    this.addLog('guess_submitted', `${username} predicted ${guess} transactions`)
  }

  // Reducer: Send Chat Message
  sendChatMessage(
    roundId: string,
    address: string,
    username: string,
    message: string,
    pfpUrl: string,
    msgType: string
  ): void {
    const chatId = this.chatIdCounter++
    const now = BigInt(Math.floor(Date.now() / 1000))

    const chatMsg: ChatMsg = {
      chatId,
      roundId,
      address,
      username,
      message,
      pfpUrl,
      timestamp: now,
      msgType
    }

    this.chatMessages.set(chatId, chatMsg)
    console.log('💬 [MOCK] Chat message sent:', chatMsg)

    // Notify listeners
    this.chatListeners.forEach(listener => listener({}, chatMsg))
  }

  // Reducer: End Round Manually
  endRoundManually(roundId: bigint): void {
    const round = this.rounds.get(roundId)
    if (!round) {
      console.error('❌ [MOCK] Round not found:', roundId)
      return
    }

    const oldRound = { ...round }
    round.status = 'closed'
    this.rounds.set(roundId, round)
    console.log('⏹️ [MOCK] Round ended manually:', round)

    // Notify update listeners
    this.roundsUpdateListeners.forEach(listener => listener({}, oldRound, round))

    // Create log entry
    this.addLog('round_ended', `Round ${roundId} has been closed`)
  }

  // Reducer: Update Round Result
  updateRoundResult(
    roundId: bigint,
    actualTxCount: bigint,
    blockHash: string,
    winningFid: bigint
  ): void {
    const round = this.rounds.get(roundId)
    if (!round) {
      console.error('❌ [MOCK] Round not found:', roundId)
      return
    }

    const oldRound = { ...round }
    round.status = 'finished'
    round.actualTxCount = actualTxCount
    round.blockHash = blockHash
    round.winningFid = winningFid
    this.rounds.set(roundId, round)
    console.log('🏆 [MOCK] Round result updated:', round)

    // Notify update listeners
    this.roundsUpdateListeners.forEach(listener => listener({}, oldRound, round))

    // Create log entry
    this.addLog('round_finished', `Round ${roundId} finished - Winner determined!`)
  }

  // Reducer: Save Prize Config - matches SpacetimeDB schema
  savePrizeConfig(
    jackpotAmount: bigint,
    firstPlaceAmount: bigint,
    secondPlaceAmount: bigint,
    currencyType: string,
    tokenContractAddress: string
  ): void {
    const configId = this.configIdCounter++
    const now = BigInt(Math.floor(Date.now() / 1000))

    const config: PrizeConfig = {
      configId,
      jackpotAmount,
      firstPlaceAmount,
      secondPlaceAmount,
      currencyType,
      tokenContractAddress,
      updatedAt: now
    }

    // If there's an existing config, update it; otherwise create new
    const existingConfigs = Array.from(this.prizeConfigs.values())
    if (existingConfigs.length > 0) {
      const oldConfig = existingConfigs[0]
      this.prizeConfigs.set(configId, config)
      console.log('💰 [MOCK] Prize config saved:', config)
      // Notify update listeners
      this.prizeConfigUpdateListeners.forEach(listener => listener({}, oldConfig, config))
    } else {
      this.prizeConfigs.set(configId, config)
      console.log('💰 [MOCK] Prize config saved:', config)
      // Notify insert listeners
      this.prizeConfigListeners.forEach(listener => listener({}, config))
    }

    // Create log entry
    this.addLog('prize_config_saved', `Prize config updated - Jackpot: ${jackpotAmount} ${currencyType}, 1st: ${firstPlaceAmount}, 2nd: ${secondPlaceAmount} ${currencyType}`)
  }

  // Helper: Add Log
  private addLog(eventType: string, details: string): void {
    const logId = this.logIdCounter++
    const now = BigInt(Math.floor(Date.now() / 1000))

    const log: LogEvent = {
      logId,
      eventType,
      details,
      timestamp: now
    }

    this.logs.set(logId, log)
    console.log('📝 [MOCK] Log created:', log)

    // Notify listeners
    this.logsListeners.forEach(listener => listener({}, log))
  }
}

// Mock client interface
export interface MockDbConnection {
  db: {
    rounds: {
      iter: () => IterableIterator<Round>
      onInsert: (callback: (ctx: any, row: Round) => void) => () => void
      onUpdate: (callback: (ctx: any, oldRow: Round, newRow: Round) => void) => () => void
    }
    guesses: {
      iter: () => IterableIterator<Guess>
      onInsert: (callback: (ctx: any, row: Guess) => void) => () => void
    }
    chatMessages: {
      iter: () => IterableIterator<ChatMsg>
      onInsert: (callback: (ctx: any, row: ChatMsg) => void) => () => void
    }
    logs: {
      iter: () => IterableIterator<LogEvent>
      onInsert: (callback: (ctx: any, row: LogEvent) => void) => () => void
    }
    prizeConfigs: {
      iter: () => IterableIterator<PrizeConfig>
      onInsert: (callback: (ctx: any, row: PrizeConfig) => void) => () => void
      onUpdate: (callback: (ctx: any, oldRow: PrizeConfig, newRow: PrizeConfig) => void) => () => void
      getLatest: () => PrizeConfig | null
    }
  }
  reducers: {
    createRound: (roundNumber: bigint, durationMinutes: bigint, prize: string, blockNumber: bigint | null) => void
    submitGuess: (roundId: bigint, fid: bigint, username: string, guess: bigint, pfpUrl?: string) => void
    sendChatMessage: (roundId: string, address: string, username: string, message: string, pfpUrl: string, msgType: string) => void
    endRoundManually: (roundId: bigint) => void
    updateRoundResult: (roundId: bigint, actualTxCount: bigint, blockHash: string, winningFid: bigint) => void
    savePrizeConfig: (jackpotAmount: bigint, firstPlaceAmount: bigint, secondPlaceAmount: bigint, currencyType: string, tokenContractAddress: string) => void
  }
  identity: string
}

// Global mock database instance
const mockDb = new MockDatabase()

// Initialize mock data for testing
function initializeMockData(): void {
  // Only initialize once
  if (mockDb['initialized']) return
  mockDb['initialized'] = true
  
  console.log('🎯 [MOCK MODE] Mock database ready - waiting for admin to start round...')
  console.log('📭 [MOCK MODE] No initial data - database is empty until admin creates round')
}

// Mock connection function
export async function connectToMockSpacetime(): Promise<MockDbConnection> {
  console.log('🟢 [MOCK MODE] Connecting to Mock SpacetimeDB...')
  
  // Mark as initialized (but don't add any data)
  initializeMockData()
  
  // Shorter connection delay for better UX
  await new Promise(resolve => setTimeout(resolve, 100))

  const mockClient: MockDbConnection = {
    db: {
      rounds: mockDb.rounds_table,
      guesses: mockDb.guesses_table,
      chatMessages: mockDb.chatMessages_table,
      logs: mockDb.logs_table,
      prizeConfigs: mockDb.prizeConfigs_table
    },
    reducers: {
      createRound: (roundNumber, durationMinutes, prize, blockNumber) => mockDb.createRound(roundNumber, durationMinutes, prize, blockNumber),
      submitGuess: (roundId, fid, username, guess, pfpUrl) => mockDb.submitGuess(roundId, fid, username, guess, pfpUrl),
      sendChatMessage: (roundId, address, username, message, pfpUrl, msgType) => mockDb.sendChatMessage(roundId, address, username, message, pfpUrl, msgType),
      endRoundManually: (roundId) => mockDb.endRoundManually(roundId),
      updateRoundResult: (roundId, actualTxCount, blockHash, winningFid) => mockDb.updateRoundResult(roundId, actualTxCount, blockHash, winningFid),
      savePrizeConfig: (jackpotAmount, firstPlaceAmount, secondPlaceAmount, currencyType, tokenContractAddress) => mockDb.savePrizeConfig(jackpotAmount, firstPlaceAmount, secondPlaceAmount, currencyType, tokenContractAddress)
    },
    identity: '0x09D02D25D0D082f7F2E04b4838cEfe271b2daB09'
  }

  console.log('✅ [MOCK MODE] Connected successfully!')
  console.log('🔑 [MOCK MODE] Identity:', mockClient.identity)

  return mockClient
}
