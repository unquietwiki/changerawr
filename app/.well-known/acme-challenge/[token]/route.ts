import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const TOKEN_REGEX = /^[a-zA-Z0-9_-]{20,128}$/

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params

    // Validate token format to prevent directory traversal or injection
    if (!TOKEN_REGEX.test(token)) {
        return new NextResponse('Invalid token format', { status: 400 })
    }

    // Get the hostname from the request
    const hostname = request.headers.get('host')?.split(':')[0] || ''

    try {
        // Find the certificate challenge for this specific domain and token
        const cert = await db.domainCertificate.findFirst({
            where: {
                challengeToken: token,
                status: 'PENDING_HTTP01',
                domain: {
                    domain: hostname,
                },
            },
            include: {
                domain: {
                    select: {
                        domain: true,
                    },
                },
            },
        })

        if (!cert?.challengeKeyAuth) {
            console.log(`[acme-challenge] Challenge not found for domain: ${hostname}, token: ${token}`)
            return new NextResponse('Challenge not found', { status: 404 })
        }

        console.log(`[acme-challenge] Serving challenge for ${cert.domain.domain}, token: ${token}`)

        // Let's Encrypt expects exactly this response with no extra whitespace
        return new NextResponse(cert.challengeKeyAuth, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('[acme-challenge] Database error:', error)
        return new NextResponse('Internal server error', { status: 500 })
    }
}
