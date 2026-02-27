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
        const { userAgentPattern, ruleType } = body

        if (!userAgentPattern?.trim()) {
            return NextResponse.json(
                { error: 'User agent pattern is required' },
                { status: 400 }
            )
        }

        if (!ruleType || !['BLOCK', 'ALLOW'].includes(ruleType)) {
            return NextResponse.json(
                { error: 'Invalid rule type. Must be BLOCK or ALLOW' },
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

        // Validate regex pattern
        try {
            new RegExp(userAgentPattern)
        } catch {
            return NextResponse.json(
                { error: 'Invalid regex pattern' },
                { status: 400 }
            )
        }

        // Create the browser rule
        const rule = await db.domainBrowserRule.create({
            data: {
                domainId: customDomain.id,
                userAgentPattern,
                ruleType,
                isEnabled: true,
            },
        })

        return NextResponse.json({
            success: true,
            rule,
        })
    } catch (error) {
        console.error('[browser-rules] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create browser rule' },
            { status: 500 }
        )
    }
}
