import {NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {db} from '@/lib/db'

/**
 * GET /api/admin/system/slack
 * Fetch Slack OAuth configuration
 */
export async function GET() {
    try {
        const user = await validateAuthAndGetUser();

        // Check admin role
        if (user.role !== 'ADMIN') {
            return NextResponse.json(
                {error: 'Not authorized'},
                {status: 403}
            );
        }

        const config = await db.systemConfig.findUnique({
            where: {id: 1},
            select: {
                slackOAuthEnabled: true,
                slackOAuthClientId: true,
                slackOAuthClientSecret: true,
                slackSigningSecret: true,
            },
        });

        if (!config) {
            return NextResponse.json(
                {error: 'Configuration not found'},
                {status: 404}
            );
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error fetching Slack config:', error);
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        );
    }
}

/**
 * PUT /api/admin/system/slack
 * Update Slack OAuth configuration
 */
export async function PUT(req: Request) {
    try {
        const user = await validateAuthAndGetUser();

        // Check admin role
        if (user.role !== 'ADMIN') {
            return NextResponse.json(
                {error: 'Not authorized'},
                {status: 403}
            );
        }

        const body = await req.json();
        const {slackOAuthEnabled, slackOAuthClientId, slackOAuthClientSecret, slackSigningSecret} = body;

        // Validate required fields
        if (slackOAuthEnabled && (!slackOAuthClientId || !slackOAuthClientSecret || !slackSigningSecret)) {
            return NextResponse.json(
                {error: 'Client ID, Secret, and Signing Secret are required when enabling Slack integration'},
                {status: 400}
            );
        }

        const config = await db.systemConfig.update({
            where: {id: 1},
            data: {
                slackOAuthEnabled,
                slackOAuthClientId: slackOAuthClientId || null,
                slackOAuthClientSecret: slackOAuthClientSecret || null,
                slackSigningSecret: slackSigningSecret || null,
            },
        });

        return NextResponse.json({
            slackOAuthEnabled: config.slackOAuthEnabled,
            slackOAuthClientId: config.slackOAuthClientId ? '***' : null,
            slackOAuthClientSecret: config.slackOAuthClientSecret ? '***' : null,
            slackSigningSecret: config.slackSigningSecret ? '***' : null,
        });
    } catch (error) {
        console.error('Error updating Slack config:', error);
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        );
    }
}
