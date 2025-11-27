import {NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {db} from '@/lib/db'

/**
 * GET /api/projects/[projectId]/integrations/slack
 * Fetch Slack integration for a project
 */
export async function GET(
    req: Request,
    {params}: {params: Promise<{projectId: string}>}
) {
    try {
        await validateAuthAndGetUser()

        const {projectId} = await params

        const integration = await db.slackIntegration.findUnique({
            where: {projectId},
            select: {
                id: true,
                projectId: true,
                teamId: true,
                teamName: true,
                botUserId: true,
                botUsername: true,
                channelId: true,
                channelName: true,
                autoSend: true,
                enabled: true,
                lastSyncAt: true,
                lastErrorMessage: true,
                postCount: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!integration) {
            return NextResponse.json(
                {error: 'Slack integration not found'},
                {status: 404}
            )
        }

        return NextResponse.json(integration)
    } catch (error) {
        console.error('Error fetching Slack integration:', error)
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        )
    }
}

/**
 * PUT /api/projects/[projectId]/integrations/slack
 * Update Slack integration settings
 */
export async function PUT(
    req: Request,
    {params}: {params: Promise<{projectId: string}>}
) {
    try {
        await validateAuthAndGetUser()

        const {projectId} = await params
        const body = await req.json()
        const {channelId, channelName, autoSend, enabled} = body

        // Validate channel ID
        if (!channelId || typeof channelId !== 'string') {
            return NextResponse.json(
                {error: 'Channel ID is required'},
                {status: 400}
            )
        }

        const integration = await db.slackIntegration.update({
            where: {projectId},
            data: {
                channelId,
                channelName: channelName || null,
                autoSend: autoSend ?? true,
                enabled: enabled ?? true,
            },
            select: {
                id: true,
                projectId: true,
                teamId: true,
                teamName: true,
                botUserId: true,
                botUsername: true,
                channelId: true,
                channelName: true,
                autoSend: true,
                enabled: true,
                lastSyncAt: true,
                lastErrorMessage: true,
                postCount: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        return NextResponse.json(integration)
    } catch (error) {
        console.error('Error updating Slack integration:', error)
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        )
    }
}

/**
 * DELETE /api/projects/[projectId]/integrations/slack
 * Disconnect Slack integration
 */
export async function DELETE(
    req: Request,
    {params}: {params: Promise<{projectId: string}>}
) {
    try {
        await validateAuthAndGetUser()

        const {projectId} = await params

        await db.slackIntegration.delete({
            where: {projectId},
        })

        return NextResponse.json({success: true})
    } catch (error) {
        console.error('Error deleting Slack integration:', error)
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        )
    }
}