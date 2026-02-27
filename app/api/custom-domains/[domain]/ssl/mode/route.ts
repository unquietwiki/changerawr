import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SslMode } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    const { domain } = await params

    try {
        const body = await request.json()
        const { sslMode } = body

        if (!sslMode || !['LETS_ENCRYPT', 'EXTERNAL', 'NONE'].includes(sslMode)) {
            return NextResponse.json(
                { error: 'Invalid SSL mode. Must be LETS_ENCRYPT, EXTERNAL, or NONE' },
                { status: 400 }
            )
        }

        // Find the domain
        const customDomain = await db.customDomain.findUnique({
            where: { domain },
        })

        if (!customDomain) {
            return NextResponse.json(
                { error: 'Domain not found' },
                { status: 404 }
            )
        }

        // Update the SSL mode
        await db.customDomain.update({
            where: { domain },
            data: {
                sslMode: sslMode as SslMode,
                // If switching to EXTERNAL or NONE, disable force HTTPS
                forceHttps: sslMode === 'LETS_ENCRYPT' ? customDomain.forceHttps : false,
            },
        })

        return NextResponse.json({
            success: true,
            message: `SSL mode updated to ${sslMode}`,
        })
    } catch (error) {
        console.error('[ssl/mode] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update SSL mode' },
            { status: 500 }
        )
    }
}
