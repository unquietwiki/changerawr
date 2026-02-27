import { NextRequest, NextResponse } from 'next/server'
import { sslSupported } from '@/lib/custom-domains/ssl/is-supported'
import { runAutoRenewal, checkCertificateHealth } from '@/lib/custom-domains/ssl/auto-renewal'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for renewal operations

// Support both GET (for compatibility) and POST
export async function GET(request: NextRequest) {
    return handleRenewal(request)
}

export async function POST(request: NextRequest) {
    return handleRenewal(request)
}

async function handleRenewal(request: NextRequest) {
    if (!sslSupported) {
        return NextResponse.json(
            { error: 'SSL certificate management is only available in Docker deployments' },
            { status: 503 },
        )
    }

    // Support both CRON_SECRET (legacy) and INTERNAL_API_SECRET (new)
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
    if (!cronSecret) {
        return NextResponse.json(
            { error: 'CRON_SECRET or INTERNAL_API_SECRET not configured' },
            { status: 503 },
        )
    }

    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 },
        )
    }

    try {
        // Check if this is a health check request (via query param)
        const url = new URL(request.url)
        const action = url.searchParams.get('action')

        if (action === 'health') {
            const health = await checkCertificateHealth()
            return NextResponse.json({
                success: true,
                health,
            })
        }

        // Run the auto-renewal job
        const result = await runAutoRenewal()

        return NextResponse.json({
            success: true,
            message: `Processed ${result.checked} expiring certificates`,
            result,
        })
    } catch (error) {
        console.error('[ssl-renewal] Cron job error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 },
        )
    }
}
