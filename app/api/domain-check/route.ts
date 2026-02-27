import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// Used by Caddy's on_demand_tls ask endpoint.
// Returns 200 if the domain is verified and has Let's Encrypt SSL enabled.
// Returns 403 otherwise (Caddy will not issue a certificate).
export async function GET(request: NextRequest) {
    const domain = request.nextUrl.searchParams.get('domain')

    if (!domain) {
        return new NextResponse('Missing domain parameter', { status: 400 })
    }

    try {
        const customDomain = await db.customDomain.findUnique({
            where: { domain },
            select: {
                verified: true,
                sslMode: true,
            },
        })

        // Only allow cert issuance if domain is verified AND using Let's Encrypt
        if (customDomain?.verified && customDomain.sslMode === 'LETS_ENCRYPT') {
            return new NextResponse('OK', { status: 200 })
        }

        return new NextResponse('Domain not eligible for automatic SSL', {
            status: 403,
        })
    } catch (error) {
        console.error('[domain-check] Database error:', error)
        return new NextResponse('Internal server error', { status: 500 })
    }
}
