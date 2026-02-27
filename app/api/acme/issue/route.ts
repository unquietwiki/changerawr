import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sslSupported } from '@/lib/custom-domains/ssl/is-supported'
import {
    initiateHttp01Certificate,
    initiateDns01Certificate,
} from '@/lib/custom-domains/ssl/service'

export const runtime = 'nodejs'

interface IssueRequest {
    domainId: string
    challengeType: 'HTTP01' | 'DNS01'
}

export async function POST(request: NextRequest) {
    if (!sslSupported) {
        return NextResponse.json(
            { error: 'SSL certificate management is only available in Docker deployments' },
            { status: 503 },
        )
    }

    try {
        const body: IssueRequest = await request.json()

        if (!body.domainId || !body.challengeType) {
            return NextResponse.json(
                { error: 'Missing required fields: domainId, challengeType' },
                { status: 400 },
            )
        }

        if (!['HTTP01', 'DNS01'].includes(body.challengeType)) {
            return NextResponse.json(
                { error: 'challengeType must be HTTP01 or DNS01' },
                { status: 400 },
            )
        }

        // Verify domain exists and is verified
        const domain = await db.customDomain.findUnique({
            where: { id: body.domainId },
        })

        if (!domain) {
            return NextResponse.json(
                { error: 'Domain not found' },
                { status: 404 },
            )
        }

        if (!domain.verified) {
            return NextResponse.json(
                { error: 'Domain must be verified before issuing a certificate' },
                { status: 400 },
            )
        }

        // Check if there's already an active certificate
        const existingCert = await db.domainCertificate.findFirst({
            where: {
                domainId: body.domainId,
                status: 'ISSUED',
            },
        })

        if (existingCert) {
            return NextResponse.json(
                { error: 'Domain already has an active certificate' },
                { status: 409 },
            )
        }

        // Check for pending certificates
        const pendingCert = await db.domainCertificate.findFirst({
            where: {
                domainId: body.domainId,
                status: { in: ['PENDING_HTTP01', 'PENDING_DNS01'] },
            },
        })

        if (pendingCert) {
            return NextResponse.json(
                { error: 'Certificate issuance already in progress' },
                { status: 409 },
            )
        }

        if (body.challengeType === 'HTTP01') {
            const certId = await initiateHttp01Certificate(
                body.domainId,
                domain.domain,
            )

            return NextResponse.json({ certId }, { status: 201 })
        } else {
            const result = await initiateDns01Certificate(
                body.domainId,
                domain.domain,
            )

            return NextResponse.json(result, { status: 201 })
        }
    } catch (error) {
        console.error('[acme/issue] Error:', error)

        const message = error instanceof Error ? error.message : 'Unknown error'

        return NextResponse.json(
            { error: message },
            { status: 500 },
        )
    }
}
