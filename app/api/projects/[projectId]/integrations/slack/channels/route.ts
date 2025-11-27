import {NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {db} from '@/lib/db'
import {decryptToken} from '@/lib/utils/encryption'

/**
 * GET /api/projects/[projectId]/integrations/slack/channels
 * Fetch available channels from connected Slack workspace
 */
export async function GET(
    req: Request,
    {params}: {params: Promise<{projectId: string}>}
) {
    try {
        await validateAuthAndGetUser()

        const {projectId} = await params

        // Get the Slack integration for this project
        const integration = await db.slackIntegration.findUnique({
            where: {projectId},
            select: {
                accessToken: true,
            },
        })

        if (!integration || !integration.accessToken) {
            return NextResponse.json(
                {error: 'Slack integration not connected'},
                {status: 400}
            )
        }

        // Decrypt the access token
        let decryptedToken: string
        try {
            decryptedToken = decryptToken(integration.accessToken)
        } catch (error) {
            console.error('Failed to decrypt Slack access token:', error)
            return NextResponse.json(
                {error: 'Failed to decrypt access token'},
                {status: 500}
            )
        }

        // Fetch channels from Slack API
        const channelsResponse = await fetch('https://slack.com/api/conversations.list', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${decryptedToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                types: 'public_channel,private_channel',
                exclude_archived: 'true',
                limit: '100',
            }).toString(),
        })

        if (!channelsResponse.ok) {
            return NextResponse.json(
                {error: 'Failed to fetch channels from Slack'},
                {status: 500}
            )
        }

        const channelsData = await channelsResponse.json()

        if (!channelsData.ok) {
            return NextResponse.json(
                {error: channelsData.error || 'Failed to fetch channels'},
                {status: 400}
            )
        }

        // Format channels for the frontend
        const channels = (channelsData.channels || []).map((channel: any) => ({
            id: channel.id,
            name: channel.name,
            isPrivate: channel.is_private,
            isMember: channel.is_member,
            topic: channel.topic?.value || '',
        }))

        return NextResponse.json({channels})
    } catch (error) {
        console.error('Error fetching Slack channels:', error)
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        )
    }
}
