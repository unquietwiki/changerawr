import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { renewCertificate } from '@/lib/custom-domains/ssl/service'

export const runtime = 'nodejs'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ certId: string }> }
) {
    const { certId } = await params

    try {
        // Find the certificate with domain info
        const cert = await db.domainCertificate.findUnique({
            where: { id: certId },
            include: { domain: true },
        })

        if (!cert) {
            return NextResponse.json(
                { error: 'Certificate not found' },
                { status: 404 }
            )
        }

        // Only allow renewing issued certificates
        if (cert.status !== 'ISSUED') {
            return NextResponse.json(
                { error: 'Can only renew issued certificates' },
                { status: 400 }
            )
        }

        // Initiate renewal
        await renewCertificate(cert)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[acme/renew] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to renew certificate' },
            { status: 500 }
        )
    }
}
