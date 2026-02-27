import { NextRequest, NextResponse } from 'next/server'
import { getActiveCertBundle } from '@/lib/custom-domains/ssl/service'

export const runtime = 'nodejs'

// Internal API for nginx-agent to fetch decrypted certificate bundles.
// Authentication: X-Internal-Secret header must match INTERNAL_API_SECRET.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string }> },
) {
    const { domain } = await params
    const secret = process.env.INTERNAL_API_SECRET

    if (!secret) {
        return NextResponse.json(
            { error: 'INTERNAL_API_SECRET not configured' },
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

    if (!domain) {
        return NextResponse.json(
            { error: 'Domain parameter required' },
            { status: 400 },
        )
    }

    try {
        const bundle = await getActiveCertBundle(domain)

        if (!bundle) {
            return NextResponse.json(
                { error: 'No active certificate found for this domain' },
                { status: 404 },
            )
        }

        return NextResponse.json({
            privateKey: bundle.privateKey,
            certificate: bundle.certificate,
            fullChain: bundle.fullChain,
            expiresAt: bundle.expiresAt.toISOString(),
        })
    } catch (error) {
        console.error('[internal/cert] Error fetching certificate:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        )
    }
}
