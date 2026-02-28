import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Public API to fetch nginx-agent version (only if SSL is enabled).
 * This wraps the internal API call with proper authentication.
 */
export async function GET() {
    const sslEnabled = process.env.NEXT_PUBLIC_SSL_ENABLED === 'true'

    if (!sslEnabled) {
        return NextResponse.json(
            { error: 'SSL not enabled' },
            { status: 404 },
        )
    }

    const agentUrl = process.env.NGINX_AGENT_URL
    const internalSecret = process.env.INTERNAL_API_SECRET

    if (!agentUrl || !internalSecret) {
        return NextResponse.json(
            { error: 'Agent not configured' },
            { status: 503 },
        )
    }

    try {
        const response = await fetch(`${agentUrl}/version`, {
            signal: AbortSignal.timeout(5000),
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch agent version' },
                { status: 502 },
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('[api/system/agent-version] Error:', error)
        return NextResponse.json(
            { error: 'Failed to connect to nginx-agent' },
            { status: 503 },
        )
    }
}
