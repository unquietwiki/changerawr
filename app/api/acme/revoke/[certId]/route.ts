import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAcmeClient } from '@/lib/custom-domains/ssl/acme-account'
import { decrypt } from '@/lib/custom-domains/ssl/encryption'
import { notifyAgent } from '@/lib/custom-domains/ssl/webhook'

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

        // Only allow revoking issued certificates
        if (cert.status !== 'ISSUED') {
            return NextResponse.json(
                { error: 'Can only revoke issued certificates' },
                { status: 400 }
            )
        }

        if (!cert.certificatePem) {
            return NextResponse.json(
                { error: 'Certificate data not found' },
                { status: 400 }
            )
        }

        // Revoke with Let's Encrypt (skip in sandbox mode)
        if (process.env.ACME_SANDBOX_MODE !== 'true') {
            const client = await getAcmeClient()
            await client.revokeCertificate(cert.certificatePem)
        }

        // Mark as revoked in database
        await db.domainCertificate.update({
            where: { id: certId },
            data: {
                status: 'REVOKED',
                lastError: 'Certificate revoked by user',
            },
        })

        // Notify nginx-agent to remove the certificate
        await notifyAgent({
            event: 'cert.revoked',
            domain: cert.domain.domain,
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[acme/revoke] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to revoke certificate' },
            { status: 500 }
        )
    }
}
