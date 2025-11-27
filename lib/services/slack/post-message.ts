import {db} from '@/lib/db'
import {decryptToken} from '@/lib/utils/encryption'
import {slackifyMarkdown} from 'slackify-markdown'
import {truncateMarkdown} from '@/lib/utils/text'

export interface SlackMessageOptions {
    projectId: string
    channelId: string
    entryId?: string
    title: string
    description?: string
    url?: string
    color?: string
    version?: string
    tags?: Array<{name: string}>
}

/**
 * Post a message to Slack for a changelog entry
 * Uses the project's Slack integration to send a formatted message
 */
export async function postToSlack(options: SlackMessageOptions) {
    const {projectId, channelId, entryId, title, description, url, color = '#0099ff'} = options
    let {version, tags} = options

    try {
        // If entryId is provided but version/tags aren't, fetch them from the database
        if (entryId && (!version || !tags)) {
            const entry = await db.changelogEntry.findUnique({
                where: {id: entryId},
                select: {
                    version: true,
                    tags: {
                        select: {name: true},
                    },
                },
            })
            if (entry) {
                version = entry.version || version
                tags = entry.tags || tags
            }
        }

        // Get the Slack integration for this project
        const integration = await db.slackIntegration.findUnique({
            where: {projectId},
            select: {
                accessToken: true,
                enabled: true,
            },
        })

        if (!integration || !integration.enabled || !integration.accessToken) {
            throw new Error('Slack integration not enabled for this project')
        }

        // Decrypt the access token
        let decryptedToken: string
        try {
            decryptedToken = decryptToken(integration.accessToken)
        } catch (error) {
            console.error('Failed to decrypt Slack access token:', error)
            throw new Error('Failed to decrypt Slack access token')
        }

        // First, ensure the bot is in the channel by attempting to join
        try {
            const joinResponse = await fetch('https://slack.com/api/conversations.join', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${decryptedToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    channel: channelId,
                }).toString(),
            })

            if (joinResponse.ok) {
                const joinData = await joinResponse.json()
                if (!joinData.ok) {
                    console.warn('Failed to join Slack channel:', joinData.error)
                }
            }
        } catch (joinError) {
            console.error('Failed to join Slack channel:', joinError)
            // Continue anyway - the channel might already be joined
        }

        // Add a small delay to ensure the join is processed before posting
        await new Promise(resolve => setTimeout(resolve, 500))

        // Truncate markdown to reasonable length, then convert to Slack mrkdwn format
        const truncatedDescription = description ? truncateMarkdown(description) : undefined
        let mrkdwnDescription = truncatedDescription ? slackifyMarkdown(truncatedDescription) : 'New changelog update'

        // Add a note if content was truncated
        if (truncatedDescription && description && truncatedDescription !== description) {
            mrkdwnDescription += '\n\n_This is an excerpt. Click "View Update" to read the full changelog._'
        }

        // Build version and tags info
        let versionAndTagsInfo = ''
        if (version) {
            versionAndTagsInfo += `*Version:* ${version}`
        }
        if (tags && tags.length > 0) {
            const tagNames = tags.map(t => t.name).join(', ')
            if (versionAndTagsInfo) {
                versionAndTagsInfo += ` | *Tags:* ${tagNames}`
            } else {
                versionAndTagsInfo += `*Tags:* ${tagNames}`
            }
        }

        // Build the Slack message block kit format
        const blocks: any[] = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: title,
                    emoji: true,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: mrkdwnDescription,
                },
            },
        ]

        // Add version and tags section if available
        if (versionAndTagsInfo) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: versionAndTagsInfo,
                },
            })
        }

        if (url) {
            blocks.push({
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'View Update',
                            emoji: true,
                        },
                        url,
                        style: 'primary',
                    },
                ],
            })
        }

        // Send the message to Slack
        const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${decryptedToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channel: channelId,
                blocks,
                attachments: [
                    {
                        color,
                        fallback: title,
                    },
                ],
            }),
        })

        if (!slackResponse.ok) {
            throw new Error('Failed to post to Slack API')
        }

        const slackData = await slackResponse.json()

        if (!slackData.ok) {
            throw new Error(`Slack error: ${slackData.error}`)
        }

        // Update the integration's post count and last sync time
        await db.slackIntegration.update({
            where: {projectId},
            data: {
                postCount: {increment: 1},
                lastSyncAt: new Date(),
                lastErrorMessage: null,
            },
        })

        // Attempt to have the bot leave the channel after posting
        try {
            const leaveResponse = await fetch('https://slack.com/api/conversations.leave', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${decryptedToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    channel: channelId,
                }).toString(),
            })

            if (leaveResponse.ok) {
                const leaveData = await leaveResponse.json()
                if (!leaveData.ok) {
                    console.warn('Failed to leave Slack channel:', leaveData.error)
                }
            }
        } catch (leaveError) {
            console.error('Failed to leave Slack channel:', leaveError)
            // Don't fail if we can't leave - the message was already posted
        }

        return {success: true, messageTs: slackData.ts}
    } catch (error) {
        // Log the error to the integration
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Slack post failed:', errorMessage)

        try {
            await db.slackIntegration.update({
                where: {projectId},
                data: {
                    lastErrorMessage: errorMessage,
                    lastSyncAt: new Date(),
                },
            })
        } catch (updateError) {
            console.error('Failed to update integration error state:', updateError)
        }

        throw error
    }
}