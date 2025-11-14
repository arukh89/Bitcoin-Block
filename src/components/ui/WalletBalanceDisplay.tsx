'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Balances {
  eth: string
  usdc: string
  seconds: string
}

interface WalletBalanceDisplayProps {
  walletAddress: string
}

export function WalletBalanceDisplay({ walletAddress }: WalletBalanceDisplayProps): JSX.Element {
  const [balances, setBalances] = useState<Balances | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/base-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch balances')
      }

      setBalances(data.balances)
    } catch (err) {
      console.error('Error fetching balances:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (walletAddress) {
      fetchBalances()
    }
  }, [walletAddress])

  if (error) {
    return (
      <Card className="glass-card-dark p-4 border border-red-500/30">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-400">❌ {error}</p>
          <Button
            onClick={fetchBalances}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            🔄 Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (loading || !balances) {
    return (
      <Card className="glass-card-dark p-4 border border-blue-500/30">
        <p className="text-sm text-blue-300 text-center">⏳ Loading balances...</p>
      </Card>
    )
  }

  return (
    <Card className="glass-card-dark p-4 border border-green-500/30">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-green-300">💰 Wallet Balances (Base Chain)</p>
          <Button
            onClick={fetchBalances}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-gray-400 hover:text-white"
          >
            🔄
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {/* ETH Balance */}
          <div className="glass-card p-2 rounded-lg border border-gray-600/30 overflow-hidden">
            <div className="text-[9px] text-gray-400 mb-1 truncate">ETH</div>
            <div className="text-xs font-bold text-white truncate" title={balances.eth}>{balances.eth}</div>
          </div>

          {/* USDC Balance */}
          <div className="glass-card p-2 rounded-lg border border-gray-600/30 overflow-hidden">
            <div className="text-[9px] text-gray-400 mb-1 truncate">USDC</div>
            <div className="text-xs font-bold text-white truncate" title={balances.usdc}>{balances.usdc}</div>
          </div>

          {/* $SECONDS Balance */}
          <div className="glass-card p-2 rounded-lg border border-gray-600/30 overflow-hidden">
            <div className="text-[9px] text-gray-400 mb-1 truncate">$SEC</div>
            <div className="text-xs font-bold text-white truncate" title={balances.seconds}>{balances.seconds}</div>
          </div>
        </div>

        <p className="text-[9px] text-gray-500 text-center mt-2">
          📍 Address: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>
      </div>
    </Card>
  )
}
