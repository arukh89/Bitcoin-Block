'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useGame } from '@/context/GameContext'
import { motion } from 'framer-motion'
import type { User } from '@/types/game'
import sdk from '@farcaster/miniapp-sdk'

export function AuthButton(): JSX.Element {
  const { user, setUser } = useGame()
  const [loading, setLoading] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)

  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true)
      
      // Request wallet connection using Farcaster miniapp SDK
      const wallet = await sdk.wallet.ethProvider.request({
        method: 'eth_requestAccounts'
      }) as string[]

      if (!wallet || wallet.length === 0) {
        throw new Error('No wallet connected')
      }

      const address = wallet[0]
      
      // Get user context from Farcaster
      const context = await sdk.context

      const userData: User = {
        address: address,
        username: context.user.username || address.slice(0, 8),
        displayName: context.user.displayName || address.slice(0, 8),
        pfpUrl: context.user.pfpUrl || ''
      }

      setUser(userData)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Button disabled className="animate-pulse">
        Connecting...
      </Button>
    )
  }

  if (!user) {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button 
          onClick={handleConnect}
          className="bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white font-bold shadow-lg"
        >
          🔗 Connect
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 shadow-lg"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(255, 120, 0, 0.3)" }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Avatar className="h-10 w-10 ring-2 ring-orange-400 ring-offset-2 ring-offset-transparent">
          <AvatarImage src={user.pfpUrl} alt={user.username} />
          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-600 text-white">
            {user.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </motion.div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white">@{user.username}</span>
        <span className="text-xs text-orange-300 font-mono">{user.address.slice(0, 6)}...{user.address.slice(-4)}</span>
      </div>
    </motion.div>
  )
}
