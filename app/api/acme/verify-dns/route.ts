import { NextRequest, NextResponse } from 'next/server'
import { sslSupported } from '@/lib/custom-domains/ssl/is-supported'
import { completeDns01Certificate } from '@/lib/custom-domains/ssl/service'
import { notifyAgent } from '@/lib/custom-domains/ssl/webhook'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

interface VerifyDnsRequest {
    certId: string
}

export async function POST(request: NextRequest) {
    if (!sslSupported) {
        return NextResponse.json(
            { error: 'SSL certificate management is only available in Docker deployments' },
            { status: 503 },
        )
    }

    try {
        const body: VerifyDnsRequest = await request.json()

        if (!body.certId) {
            return NextResponse.json(
                { error: 'Missing required field: certId' },
                { status: 400 },
            )
        }

        // Verify cert exists and is in the right state
        const cert = await db.domainCertificate.findUnique({
            where: { id: body.certId },
            include: {
                domain: true,
            },
        })

        if (!cert) {
            return NextResponse.json(
                { error: 'Certificate not found' },
                { status: 404 },
            )
        }

        if (cert.status !== 'PENDING_DNS01') {
            return NextResponse.json(
                { error: `Certificate is not in PENDING_DNS01 state (current: ${cert.status})` },
                { status: 400 },
            )
        }

        try {
            await completeDns01Certificate(body.certId)

            // Notify nginx-agent about the new certificate
            await notifyAgent({
                event: 'cert.issued',
                domain: cert.domain.domain,
                certId: cert.id,
            })

            return NextResponse.json({
                success: true,
                message: 'Certificate issued successfully',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'

            // If TXT record not propagated, return 202 (not an error, just retry later)
            if (message.includes('TXT record not found') || message.includes('not propagated')) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'DNS TXT record not yet propagated. Please wait a few minutes and try again.',
                        retry: true,
                    },
                    { status: 202 },
                )
            }

            // Other errors are actual failures
            throw error
        }
    } catch (error) {
        console.error('[acme/verify-dns] Error:', error)

        const message = error instanceof Error ? error.message : 'Unknown error'

        return NextResponse.json(
            { error: message },
            { status: 500 },
        )
    }
}
