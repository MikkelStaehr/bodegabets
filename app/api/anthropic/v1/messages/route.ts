import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[anthropic proxy] ANTHROPIC_API_KEY not configured')
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const body = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[anthropic proxy] Error:', response.status, JSON.stringify(data))
      return Response.json(data, { status: response.status })
    }

    return Response.json(data)
  } catch (err) {
    console.error('[anthropic proxy] Exception:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
