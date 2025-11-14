'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGame } from '@/context/GameContext'

export function CurrentRound(): JSX.Element {
  const { activeRound, connected } = useGame()
  const [countdown, setCountdown] = useState<string>('0m 0s')
  const [lastBlockTime, setLastBlockTime] = useState<number | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [txCount, setTxCount] = useState<number | null>(null)

  // Fetch latest block data from mempool.space
  useEffect(() => {
    const fetchBlockData = async (): Promise<void> => {
      try {
        const response = await fetch('/api/mempool?action=recent-blocks')
        if (!response.ok) return
        
        const data = await response.json()
        if (data.timestamp) {
          setLastBlockTime(data.timestamp * 1000) // Convert to milliseconds
        }
        if (data.height) {
          setBlockNumber(data.height)
        }
        if (data.tx_count) {
          setTxCount(data.tx_count)
        }
      } catch (error) {
        console.error('Failed to fetch block data:', error)
      }
    }

    fetchBlockData()
    const interval = setInterval(fetchBlockData, 10000) // Update every 10s

    return () => clearInterval(interval)
  }, [])

  // Calculate countdown timer based on admin-configured duration
  useEffect(() => {
    if (!activeRound || !activeRound.duration) return

    const updateCountdown = (): void => {
      const now = Date.now()
      const endTime = activeRound.endTime
      const remainingMs = endTime - now
      
      if (remainingMs <= 0) {
        setCountdown('0m 0s')
        return
      }
      
      const remainingSeconds = Math.floor(remainingMs / 1000)
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      
      setCountdown(`${minutes}m ${seconds}s`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [activeRound])

  // Get status badge directly from admin panel (database status)
  const getStatusBadge = (): string => {
    if (!activeRound) return 'WAITING'
    return activeRound.status.toUpperCase()
  }

  const getStatusColor = (): string => {
    if (!activeRound) return 'bg-gray-500/20 text-gray-300 border-gray-400/50'
    if (activeRound.status === 'open') return 'bg-green-500/20 text-green-300 border-green-400/50'
    if (activeRound.status === 'closed') return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50'
    if (activeRound.status === 'finished') return 'bg-purple-500/20 text-purple-300 border-purple-400/50'
    return 'bg-gray-500/20 text-gray-300 border-gray-400/50'
  }

  const statusBadge = getStatusBadge()
  const statusColor = getStatusColor()
  
  // Round number from admin input
  const roundNumber = activeRound?.roundNumber?.toString() || '—'
  
  // Block number: Prioritize admin input, fallback to latest from mempool
  const displayBlockNumber = activeRound?.blockNumber || blockNumber || 875420
  const displayTxCount = txCount || 0

  // If not connected, show connecting state
  if (!connected) {
    return (
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="glass-card-dark border-orange-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 animate-pulse" />
          <CardContent className="py-6 px-6">
            <motion.div
              className="text-center py-8"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <p className="text-gray-400 text-sm">🔌 Connecting to database...</p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // If no active round OR round is closed/finished, show empty state
  if (!activeRound || activeRound.status === 'closed' || activeRound.status === 'finished') {
    return (
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="glass-card-dark border-gray-500/30 overflow-hidden">
          <CardContent className="py-8 px-6">
            <motion.div
              className="text-center"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <p className="text-xl text-gray-400 mb-2">⏳</p>
              <p className="text-gray-400 text-sm">Waiting for admin to start round...</p>
              <p className="text-gray-500 text-xs mt-2">
                {!activeRound ? 'No active round yet' : 'Round closed - waiting for next round'}
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Active round exists with status 'open' - display full round info from admin input
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.35 }}
    >
      <Card className="glass-card-dark border-orange-500/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 animate-pulse" />
        
        <CardContent className="py-6 px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Left: Round Info - Direct from Admin Panel */}
            <div className="flex items-center gap-3">
              <motion.span
                animate={{ rotate: activeRound.status === 'open' ? 360 : 0 }}
                transition={{ duration: 3, repeat: activeRound.status === 'open' ? Infinity : 0, ease: "linear" }}
                className="text-2xl"
              >
                🎮
              </motion.span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg lg:text-xl font-black text-white">
                    Round #{roundNumber}
                  </span>
                  <Badge 
                    variant="default"
                    className={`${statusColor} px-3 py-0.5 text-xs font-bold`}
                  >
                    {statusBadge}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">Started by admin</p>
              </div>
            </div>

            {/* Middle & Right: Target Block and Timer - Side by Side on Mobile */}
            <div className="flex gap-3 w-full lg:w-auto">
              {/* Target Block Info */}
              <div className="glass-card p-3 lg:p-4 rounded-xl flex-1">
                <div className="text-center space-y-1">
                  <p className="text-[10px] lg:text-xs text-blue-300 font-semibold">🧱 Target Block</p>
                  <p className="text-xl lg:text-2xl font-black text-blue-400 font-mono">
                    #{displayBlockNumber.toLocaleString()}
                  </p>
                  <p className="text-[9px] lg:text-[10px] text-gray-400">Txs: {displayTxCount.toLocaleString()}</p>
                </div>
              </div>

              {/* Timer */}
              <div className="glass-card p-3 lg:p-4 rounded-xl flex-1">
                <div className="text-center">
                  <p className="text-[10px] lg:text-xs text-orange-300 font-semibold mb-1">⏱ Time Left</p>
                  <motion.p
                    className="text-xl lg:text-2xl font-black text-white font-mono"
                    animate={{
                      textShadow: activeRound.status === 'open' ? [
                        "0 0 10px rgba(251,146,60,0.5)",
                        "0 0 20px rgba(251,146,60,0.8)",
                        "0 0 10px rgba(251,146,60,0.5)"
                      ] : []
                    }}
                    transition={{ duration: 2, repeat: activeRound.status === 'open' ? Infinity : 0 }}
                  >
                    {countdown}
                  </motion.p>
                  <p className="text-[9px] lg:text-[10px] text-gray-400 mt-1">
                    {activeRound.duration ? `${activeRound.duration}m` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
