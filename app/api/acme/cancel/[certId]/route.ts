import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ certId: string }> }
) {
    const { certId } = await params

    try {
        // Find the certificate
        const cert = await db.domainCertificate.findUnique({
            where: { id: certId },
        })

        if (!cert) {
            return NextResponse.json(
                { error: 'Certificate not found' },
                { status: 404 }
            )
        }

        // Only allow canceling pending certificates
        if (cert.status !== 'PENDING_HTTP01' && cert.status !== 'PENDING_DNS01') {
            return NextResponse.json(
                { error: 'Can only cancel pending certificates' },
                { status: 400 }
            )
        }

        // Mark as failed with a cancellation message
        await db.domainCertificate.update({
            where: { id: certId },
            data: {
                status: 'FAILED',
                lastError: 'Certificate issuance cancelled by user',
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[acme/cancel] Error:', error)
        return NextResponse.json(
            { error: 'Failed to cancel certificate' },
            { status: 500 }
        )
    }
}
