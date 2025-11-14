'use server'

import { NextResponse, type NextRequest } from 'next/server'

// Base Chain RPC URL
const BASE_RPC_URL = 'https://mainnet.base.org'

// Token contract addresses on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // USDC on Base
const SECONDS_ADDRESS = '0xaf67e72dc47dcb2d48ecbc56950473d793d70c18' // $SECONDS token

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
]

// Helper to make JSON-RPC call
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || 'RPC call failed')
  }
  return data.result
}

// Get ETH balance
async function getEthBalance(address: string): Promise<string> {
  const balance = await rpcCall('eth_getBalance', [address, 'latest']) as string
  const balanceInWei = BigInt(balance)
  const balanceInEth = Number(balanceInWei) / 1e18
  return balanceInEth.toFixed(6)
}

// Get ERC-20 token balance
async function getTokenBalance(tokenAddress: string, walletAddress: string, decimals: number = 18): Promise<string> {
  // Encode balanceOf(address) call
  const balanceOfSignature = '0x70a08231' // balanceOf(address)
  const paddedAddress = walletAddress.slice(2).padStart(64, '0')
  const data = balanceOfSignature + paddedAddress

  const balance = await rpcCall('eth_call', [
    {
      to: tokenAddress,
      data
    },
    'latest'
  ]) as string

  const balanceInWei = BigInt(balance)
  const balanceInToken = Number(balanceInWei) / Math.pow(10, decimals)
  return balanceInToken.toFixed(2)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const { address } = body

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid wallet address' },
        { status: 400 }
      )
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Ethereum address format' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching balances for:', address)

    // Fetch all balances in parallel
    const [ethBalance, usdcBalance, secondsBalance] = await Promise.all([
      getEthBalance(address).catch(err => {
        console.error('Error fetching ETH balance:', err)
        return '0.000000'
      }),
      getTokenBalance(USDC_ADDRESS, address, 6).catch(err => {
        console.error('Error fetching USDC balance:', err)
        return '0.00'
      }),
      getTokenBalance(SECONDS_ADDRESS, address, 18).catch(err => {
        console.error('Error fetching $SECONDS balance:', err)
        return '0.00'
      })
    ])

    console.log('✅ Balances fetched:', { ethBalance, usdcBalance, secondsBalance })

    return NextResponse.json({
      success: true,
      balances: {
        eth: ethBalance,
        usdc: usdcBalance,
        seconds: secondsBalance
      }
    })
  } catch (error) {
    console.error('❌ Error fetching balances:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch balances' 
      },
      { status: 500 }
    )
  }
}
