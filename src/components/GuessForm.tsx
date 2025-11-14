'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useGame } from '@/context/GameContext'
import { useToast } from '@/hooks/use-toast'

export function GuessForm(): JSX.Element {
  const { user, activeRound, submitGuess, hasUserGuessed, connected } = useGame()
  const { toast } = useToast()
  const [guess, setGuess] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  // Get user's guesses for active round
  const userGuesses = activeRound 
    ? useGame().getGuessesForRound(activeRound.id).filter(g => user && g.address.toLowerCase() === user.address.toLowerCase())
    : []

  const isRoundLocked = activeRound?.status !== 'open'
  const alreadyGuessed = user && activeRound ? hasUserGuessed(activeRound.id, user.address) : false

  // Debug logging
  useEffect(() => {
    console.log('🔍 [GuessForm] State check:', {
      hasUser: !!user,
      userAddress: user?.address,
      connected,
      hasActiveRound: !!activeRound,
      roundStatus: activeRound?.status,
      isRoundLocked,
      alreadyGuessed,
      userGuessesCount: userGuesses.length
    })
  }, [user, connected, activeRound, isRoundLocked, alreadyGuessed, userGuesses.length])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!user) {
      toast({
        title: '🔐 Authentication Required',
        description: 'Please sign in with Farcaster first',
        variant: 'destructive'
      })
      return
    }

    if (!activeRound) {
      toast({
        title: '⚠️ No Active Round',
        description: 'Wait for a round to start',
        variant: 'destructive'
      })
      return
    }

    if (isRoundLocked) {
      toast({
        title: '❌ Too late! Round is locked.',
        description: 'Submissions are closed for this round',
        variant: 'destructive'
      })
      return
    }

    const guessNum = parseInt(guess, 10)
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 20000 || guess.includes('.') || guess.includes(',')) {
      toast({
        title: '⚠️ Invalid Input',
        description: 'Enter a number between 1 and 20,000 — no decimals, no text',
        variant: 'destructive'
      })
      return
    }

    if (alreadyGuessed) {
      toast({
        title: '❌ Already Submitted',
        description: 'One guess per round. Submit before the block is mined.',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const success = await submitGuess(activeRound.id, user.address, user.username, guessNum, user.pfpUrl || '')
      
      if (success) {
        toast({
          title: '✅ Guess Submitted!',
          description: `Your prediction: ${guessNum.toLocaleString()} transactions`
        })
        setGuess('')
      } else {
        toast({
          title: '❌ Submission Failed',
          description: 'Could not submit prediction. Please try again.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: '⚠️ Error',
        description: error instanceof Error ? error.message : 'Failed to submit prediction',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="glass-card-dark border-orange-500/30 h-full shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-lg">
          <span>🔢</span>
          Submit Your Guess
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm font-semibold">🎯 Your Prediction</Label>
            <Input
              type="number"
              placeholder={!user ? "Sign in to predict..." : !activeRound ? "Waiting for round..." : "Enter tx count (1-20,000)"}
              value={guess}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuess(e.target.value)}
              disabled={loading || isRoundLocked || !connected || !user || !activeRound || alreadyGuessed}
              required
              className="h-14 text-lg font-bold text-center bg-gray-800/50 border-2 border-orange-500/50 text-white placeholder:text-gray-500 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>

          {/* Status Messages */}
          {!connected ? (
            <div className="glass-card p-4 rounded-xl text-center border border-yellow-500/30">
              <p className="text-2xl mb-2">🔌</p>
              <p className="text-yellow-300 text-sm font-medium">Connecting to database...</p>
            </div>
          ) : !user ? (
            <div className="glass-card p-4 rounded-xl text-center border border-gray-500/30">
              <p className="text-2xl mb-2">🔒</p>
              <p className="text-gray-300 text-sm font-medium">Sign in with Farcaster to participate</p>
            </div>
          ) : !activeRound ? (
            <div className="glass-card p-4 rounded-xl text-center border border-yellow-500/30">
              <p className="text-2xl mb-2">⏳</p>
              <p className="text-yellow-300 text-sm font-medium">Waiting for next round to start...</p>
              <p className="text-yellow-400 text-xs mt-2">💡 Admin: Create a round in the Admin Panel below</p>
            </div>
          ) : (
            <>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || isRoundLocked || !connected || alreadyGuessed}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span>⚙️</span>
                    Submitting...
                  </span>
                ) : alreadyGuessed ? (
                  '✅ Already Submitted'
                ) : isRoundLocked ? (
                  '🔒 Round Locked'
                ) : !connected ? (
                  '🔌 Connecting...'
                ) : (
                  '🚀 Submit Prediction'
                )}
              </Button>

              {isRoundLocked && (
                <div className="glass-card p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                  <p className="text-sm text-red-300 text-center font-semibold">
                    ❌ Round Locked - Submissions Closed
                  </p>
                </div>
              )}

              <div className="glass-card p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                <p className="text-xs text-blue-300 text-center">
                  💡 Your prediction will be saved below
                </p>
              </div>
            </>
          )}
        </form>

        {/* User's Own Guess - Highlighted */}
        {user && activeRound && userGuesses.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-gray-700/50">
            <Label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">✨ Your Prediction</Label>
            <div className="space-y-2">
              {userGuesses.map((g) => (
                <div key={g.id} className="glass-card p-3 rounded-lg border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <p className="text-orange-200 font-bold text-base">
                          {g.guess.toLocaleString()} transactions
                        </p>
                        <p className="text-gray-400 text-xs">
                          {new Date(g.submittedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-orange-500/20 border border-orange-500/40 rounded text-orange-300 text-xs font-bold">
                      YOU
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already guessed message - shown when user has submitted */}
        {alreadyGuessed && userGuesses.length === 0 && (
          <div className="glass-card p-4 rounded-xl text-center border border-green-500/40 bg-green-500/10">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-green-300 text-sm font-bold">Guess Submitted!</p>
            <p className="text-green-400 text-xs mt-1">One prediction per round</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
