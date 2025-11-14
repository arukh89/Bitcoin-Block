import { NextResponse } from 'next/server'

interface BlockInfo {
  id: string
  height: number
  timestamp: number
  tx_count: number
}

interface TransactionList {
  length: number
}

/**
 * Fetch Bitcoin block data from mempool.space
 * 
 * GET /api/mempool?action=block-at-time&timestamp=<unix_seconds>
 * Returns: { blockHash, txCount, timestamp, height }
 * 
 * GET /api/mempool?action=tx-count&blockHash=<hash>
 * Returns: { txCount }
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'block-at-time') {
      const timestamp = searchParams.get('timestamp')
      if (!timestamp) {
        return NextResponse.json(
          { error: 'Missing timestamp parameter' },
          { status: 400 }
        )
      }

      // Retry logic for mempool.space API
      let attempts = 0
      const maxAttempts = 3
      let lastError: Error | null = null

      while (attempts < maxAttempts) {
        try {
          // Fetch blocks around the given timestamp
          const response = await fetch(
            `https://mempool.space/api/v1/mining/blocks/timestamp/${timestamp}`,
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            }
          )

          if (!response.ok) {
            throw new Error(`mempool.space API returned ${response.status}`)
          }

          const blocks = await response.json() as BlockInfo[]
          
          if (!blocks || blocks.length === 0) {
            return NextResponse.json(
              { error: 'No blocks found after the given timestamp' },
              { status: 404 }
            )
          }

          // Get the first block (closest to the timestamp)
          const block = blocks[0]

          return NextResponse.json({
            blockHash: block.id,
            txCount: block.tx_count,
            timestamp: block.timestamp,
            height: block.height
          })
        } catch (error) {
          lastError = error as Error
          attempts++
          
          if (attempts < maxAttempts) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
          }
        }
      }

      // All retries failed
      return NextResponse.json(
        {
          error: 'Failed to fetch block data after multiple attempts',
          details: lastError?.message || 'Unknown error',
          status: 'pending_result'
        },
        { status: 503 }
      )
    }

    if (action === 'tx-count') {
      const blockHash = searchParams.get('blockHash')
      if (!blockHash) {
        return NextResponse.json(
          { error: 'Missing blockHash parameter' },
          { status: 400 }
        )
      }

      // Retry logic
      let attempts = 0
      const maxAttempts = 3
      let lastError: Error | null = null

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(
            `https://mempool.space/api/block/${blockHash}/txids`,
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(10000)
            }
          )

          if (!response.ok) {
            throw new Error(`mempool.space API returned ${response.status}`)
          }

          const txids = await response.json() as string[]
          
          return NextResponse.json({
            txCount: txids.length
          })
        } catch (error) {
          lastError = error as Error
          attempts++
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
          }
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch transaction count after multiple attempts',
          details: lastError?.message || 'Unknown error',
          status: 'pending_result'
        },
        { status: 503 }
      )
    }

    if (action === 'recent-blocks') {
      // Fetch recent Bitcoin blocks with transaction counts
      let attempts = 0
      const maxAttempts = 3
      let lastError: Error | null = null

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(
            'https://mempool.space/api/blocks',
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(10000)
            }
          )

          if (!response.ok) {
            throw new Error(`mempool.space API returned ${response.status}`)
          }

          const blocks = await response.json() as Array<{
            height: number
            id: string
            timestamp: number
            tx_count: number
            size: number
          }>

          return NextResponse.json(blocks.slice(0, 10).map(block => ({
            height: block.height,
            hash: block.id,
            timestamp: block.timestamp,
            tx_count: block.tx_count,
            size: block.size
          })))
        } catch (error) {
          lastError = error as Error
          attempts++
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
          }
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch recent blocks after multiple attempts',
          details: lastError?.message || 'Unknown error'
        },
        { status: 503 }
      )
    }

    if (action === 'recent-txs') {
      // Fetch recent mempool transactions
      let attempts = 0
      const maxAttempts = 3
      let lastError: Error | null = null

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(
            'https://mempool.space/api/mempool/recent',
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(10000)
            }
          )

          if (!response.ok) {
            throw new Error(`mempool.space API returned ${response.status}`)
          }

          const transactions = await response.json() as Array<{
            txid: string
            fee: number
            vsize: number
            value: number
          }>

          return NextResponse.json(transactions.slice(0, 5))
        } catch (error) {
          lastError = error as Error
          attempts++
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
          }
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch recent transactions after multiple attempts',
          details: lastError?.message || 'Unknown error'
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Invalid action parameter. Use: block-at-time, tx-count, recent-blocks, or recent-txs' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Mempool API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
