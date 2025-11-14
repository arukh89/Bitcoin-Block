import { NextResponse } from 'next/server'

// Farcaster API key stored securely on backend only
const FARCASTER_API_KEY = process.env.FARCASTER_API_KEY || 'wc_secret_13ae99f53a4f0874277616da7b10bddf6d01a2ea5eac4d8c6380e877_9b6b2830'

interface AnnouncementRequest {
  message: string
  address?: string
}

/**
 * Post announcement to Farcaster feed
 * 
 * POST /api/farcaster-announce
 * Body: { message: string, fid?: number }
 * 
 * Only accessible by FID 250704 (validated in frontend)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as AnnouncementRequest
    const { message, address } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Missing message parameter' },
        { status: 400 }
      )
    }

    // Additional server-side validation for dev address
    const DEV_ADDRESS = '0x09D02D25D0D082f7F2E04b4838cEfe271b2daB09'
    if (address && address.toLowerCase() !== DEV_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: Only dev address can post announcements' },
        { status: 403 }
      )
    }

    // Post to Farcaster using Warpcast API
    // Note: The actual Farcaster API endpoint may vary based on the SDK version
    // This is a placeholder implementation that should be adjusted based on
    // the specific Farcaster API documentation
    
    const response = await fetch('https://api.warpcast.com/v2/casts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FARCASTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: message,
        embeds: []
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Farcaster API error:', errorData)
      
      return NextResponse.json(
        {
          error: 'Failed to post to Farcaster',
          details: errorData,
          success: false
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Announcement posted successfully',
      cast: data
    })
  } catch (error) {
    console.error('Farcaster announce error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * Get announcement status or configuration
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    enabled: true,
    apiKeyConfigured: !!FARCASTER_API_KEY,
    devAddress: '0x09D02D25D0D082f7F2E04b4838cEfe271b2daB09'
  })
}
