export interface Round {
  id: string
  roundNumber: number
  startTime: number
  endTime: number
  duration: number
  prize: string
  status: 'open' | 'closed' | 'finished'
  blockNumber?: number
  actualTxCount?: number
  winningAddress?: string
  blockHash?: string
  createdAt: number
}

export interface Guess {
  id: string
  roundId: string
  address: string
  username: string
  guess: number
  pfpUrl: string
  submittedAt: number
  // UI-only field to mark current user entries
  isCurrentUser?: boolean
}

export interface Log {
  id: string
  eventType: string
  details: string
  timestamp: number
}

export interface ChatMessage {
  id: string
  roundId: string
  address: string
  username: string
  message: string
  pfpUrl?: string
  timestamp: number
  type: 'guess' | 'system' | 'winner' | 'chat'
}

export interface PrizeConfiguration {
  id: number
  jackpotAmount: string
  firstPlaceAmount: string
  secondPlaceAmount: string
  currencyType: string
  tokenContractAddress: string
  updatedAt: number
}

export interface User {
  address: string
  username: string
  displayName?: string
  pfpUrl?: string
  isAdmin?: boolean
}
