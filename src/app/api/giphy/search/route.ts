import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) {
    console.error('GIPHY_API_KEY not configured')
    return NextResponse.json({ error: 'GIF service not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limit = searchParams.get('limit') || '20'

  try {
    let url: string

    if (query && query.trim()) {
      // Search for GIFs
      url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
    } else {
      // Get trending GIFs
      url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`GIPHY API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GIPHY API error:', error)
    return NextResponse.json({ error: 'Failed to fetch GIFs' }, { status: 500 })
  }
}
