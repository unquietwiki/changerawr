import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string; id: string }> }
) {
    const { domain, id } = await params

    try {
        const body = await request.json()
        const { isEnabled } = body

        if (typeof isEnabled !== 'boolean') {
            return NextResponse.json(
                { error: 'isEnabled must be a boolean' },
                { status: 400 }
            )
        }

        // Verify the rule exists and belongs to this domain
        const rule = await db.domainBrowserRule.findFirst({
            where: {
                id,
                domain: {
                    domain,
                },
            },
        })

        if (!rule) {
            return NextResponse.json(
                { error: 'Rule not found' },
                { status: 404 }
            )
        }

        // Update the rule
        const updatedRule = await db.domainBrowserRule.update({
            where: { id },
            data: { isEnabled },
        })

        return NextResponse.json({
            success: true,
            rule: updatedRule,
        })
    } catch (error) {
        console.error('[browser-rules/update] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update browser rule' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string; id: string }> }
) {
    const { domain, id } = await params

    try {
        // Verify the rule exists and belongs to this domain
        const rule = await db.domainBrowserRule.findFirst({
            where: {
                id,
                domain: {
                    domain,
                },
            },
        })

        if (!rule) {
            return NextResponse.json(
                { error: 'Rule not found' },
                { status: 404 }
            )
        }

        // Delete the rule
        await db.domainBrowserRule.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
        })
    } catch (error) {
        console.error('[browser-rules/delete] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete browser rule' },
            { status: 500 }
        )
    }
}
