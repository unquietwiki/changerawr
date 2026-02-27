import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    const { domain } = await params

    try {
        const body = await request.json()
        const { enabled, requestsPerSecond, burstSize } = body

        if (typeof enabled !== 'boolean') {
            return NextResponse.json(
                { error: 'enabled must be a boolean' },
                { status: 400 }
            )
        }

        if (enabled) {
            if (!requestsPerSecond || requestsPerSecond < 1) {
                return NextResponse.json(
                    { error: 'requestsPerSecond must be at least 1' },
                    { status: 400 }
                )
            }

            if (!burstSize || burstSize < 1) {
                return NextResponse.json(
                    { error: 'burstSize must be at least 1' },
                    { status: 400 }
                )
            }
        }

        // Find the domain
        const customDomain = await db.customDomain.findUnique({
            where: { domain },
            include: {
                throttleConfig: true,
            },
        })

        if (!customDomain) {
            return NextResponse.json(
                { error: 'Domain not found' },
                { status: 404 }
            )
        }

        // Upsert the throttle config
        const throttleConfig = await db.domainThrottleConfig.upsert({
            where: {
                domainId: customDomain.id,
            },
            create: {
                domainId: customDomain.id,
                enabled,
                requestsPerSecond: enabled ? requestsPerSecond : 60,
                burstSize: enabled ? burstSize : 20,
            },
            update: {
                enabled,
                requestsPerSecond: enabled ? requestsPerSecond : undefined,
                burstSize: enabled ? burstSize : undefined,
            },
        })

        return NextResponse.json({
            success: true,
            throttleConfig,
        })
    } catch (error) {
        console.error('[throttle] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update throttle configuration' },
            { status: 500 }
        )
    }
}
