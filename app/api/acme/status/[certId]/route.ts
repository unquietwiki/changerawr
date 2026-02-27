import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sslSupported } from '@/lib/custom-domains/ssl/is-supported'

export const runtime = 'nodejs'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ certId: string }> },
) {
    if (!sslSupported) {
        return NextResponse.json(
            { error: 'SSL certificate management is only available in Docker deployments' },
            { status: 503 },
        )
    }

    const { certId } = await params

    if (!certId) {
        return NextResponse.json(
            { error: 'Certificate ID required' },
            { status: 400 },
        )
    }

    try {
        const cert = await db.domainCertificate.findUnique({
            where: { id: certId },
            include: {
                domain: {
                    select: {
                        domain: true,
                    },
                },
            },
        })

        if (!cert) {
            return NextResponse.json(
                { error: 'Certificate not found' },
                { status: 404 },
            )
        }

        const response: any = {
            certId: cert.id,
            domain: cert.domain.domain,
            status: cert.status,
            challengeType: cert.challengeType,
            issuedAt: cert.issuedAt?.toISOString() || null,
            expiresAt: cert.expiresAt?.toISOString() || null,
            lastError: cert.lastError || null,
            renewalAttempts: cert.renewalAttempts,
        }

        // Include DNS challenge details if status is PENDING_DNS01
        if (cert.status === 'PENDING_DNS01' && cert.dnsTxtValue) {
            response.txtName = `_acme-challenge.${cert.domain.domain}`
            response.txtValue = cert.dnsTxtValue
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error('[acme/status] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        )
    }
}
