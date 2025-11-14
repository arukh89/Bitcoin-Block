'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useGame } from '@/context/GameContext'
import { motion } from 'framer-motion'
import type { User } from '@/types/game'
import sdk from '@farcaster/miniapp-sdk'
import { isAdminFid } from '@/context/GameContext'

export function AuthButton(): JSX.Element {
  const { user, setUser } = useGame()
  const [loading, setLoading] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)

  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true)
      // Ensure Farcaster SDK is ready and fetch context (no wallet request)
      await sdk.actions.ready()
      const context = await sdk.context

      if (!context.user) {
        throw new Error('Farcaster user context not available')
      }

      const fid = context.user.fid
      const addressHex = '0x' + fid.toString(16).padStart(40, '0')
      const admin = isAdminFid(fid)

      const userData: User = {
        address: addressHex,
        username: context.user.username || `user${fid}`,
        displayName: context.user.displayName || context.user.username || `user${fid}`,
        pfpUrl: context.user.pfpUrl || '',
        isAdmin: admin
      }

      setUser(userData)
    } catch (error) {
      console.error('Failed to initialize Farcaster user:', error)
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
      <Button 
        onClick={handleConnect}
        className="bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white font-bold shadow-sm"
      >
        🔗 Connect
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 shadow-sm">
      <Avatar className="h-10 w-10 ring-2 ring-orange-400 ring-offset-2 ring-offset-transparent">
        <AvatarImage src={user.pfpUrl} alt={user.username} />
        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-600 text-white">
          {user.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white">@{user.username}</span>
        <span className="text-xs text-orange-300 font-mono">{user.address.slice(0, 6)}...{user.address.slice(-4)}</span>
      </div>
    </div>
  )
}
