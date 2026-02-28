import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Internal API to fetch nginx-agent version and status.
 * This endpoint proxies the request to the nginx-agent /version endpoint.
 *
 * Authentication: X-Internal-Secret header must match INTERNAL_API_SECRET.
 */
export async function GET(request: NextRequest) {
    const secret = process.env.INTERNAL_API_SECRET
    const agentUrl = process.env.NGINX_AGENT_URL

    if (!secret) {
        return NextResponse.json(
            { error: 'INTERNAL_API_SECRET not configured' },
            { status: 503 },
        )
    }

    if (!agentUrl) {
        return NextResponse.json(
            { error: 'NGINX_AGENT_URL not configured' },
            { status: 503 },
        )
    }

    const authHeader = request.headers.get('X-Internal-Secret')

    if (authHeader !== secret) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 },
        )
    }

    try {
        const response = await fetch(`${agentUrl}/version`, {
            signal: AbortSignal.timeout(5000),
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch agent version', status: response.status },
                { status: 502 },
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('[internal/agent/version] Error fetching version:', error)
        return NextResponse.json(
            { error: 'Failed to connect to nginx-agent' },
            { status: 503 },
        )
    }
}
