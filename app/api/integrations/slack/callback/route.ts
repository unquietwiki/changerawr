import {NextRequest, NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {db} from '@/lib/db'
import {encryptToken} from '@/lib/utils/encryption'

/**
 * GET /api/integrations/slack/callback
 * Handle OAuth callback from Slack
 * Exchanges auth code for access token and saves integration
 */
export async function GET(req: NextRequest) {
    try {
        // Get query parameters
        const {searchParams} = new URL(req.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle Slack errors
        if (error) {
            const errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
            console.error('Slack OAuth error:', errorMsg);
            return NextResponse.redirect(
                new URL(`/dashboard/projects?slack_error=${encodeURIComponent(errorMsg)}`, req.url)
            );
        }

        // Validate required parameters
        if (!code || !state) {
            console.error('Missing OAuth parameters');
            return NextResponse.redirect(
                new URL('/dashboard/projects?slack_error=Missing%20OAuth%20parameters', req.url)
            );
        }

        // Decode state to get projectId
        let projectId: string;
        try {
            const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
            projectId = decodedState.projectId;
            if (!projectId) {
                throw new Error('No projectId in state');
            }
        } catch (error) {
            console.error('Failed to decode state:', error);
            return NextResponse.redirect(
                new URL('/dashboard/projects?slack_error=Invalid%20state%20parameter', req.url)
            );
        }

        // Authenticate the user
        const user = await validateAuthAndGetUser();

        // Verify project exists
        const project = await db.project.findUnique({
            where: {id: projectId},
            select: {id: true}
        });

        if (!project) {
            return NextResponse.redirect(
                new URL(`/dashboard/projects?slack_error=Project%20not%20found`, req.url)
            );
        }

        // Get Slack OAuth credentials from system config
        const config = await db.systemConfig.findUnique({
            where: {id: 1},
            select: {
                slackOAuthClientId: true,
                slackOAuthClientSecret: true
            }
        });

        if (!config?.slackOAuthClientId || !config?.slackOAuthClientSecret) {
            return NextResponse.redirect(
                new URL(
                    `/dashboard/projects/${projectId}/integrations/slack?error=Slack%20OAuth%20not%20configured`,
                    req.url
                )
            );
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: config.slackOAuthClientId,
                client_secret: config.slackOAuthClientSecret,
                code,
                redirect_uri: `${new URL(req.url).origin}/api/integrations/slack/callback`
            }).toString()
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('Slack token exchange failed:', error);
            return NextResponse.redirect(
                new URL(
                    `/dashboard/projects/${projectId}/integrations/slack?error=Failed%20to%20exchange%20token`,
                    req.url
                )
            );
        }

        const tokenData = await tokenResponse.json();

        if (!tokenData.ok) {
            console.error('Slack token exchange error:', tokenData.error);
            return NextResponse.redirect(
                new URL(
                    `/dashboard/projects/${projectId}/integrations/slack?error=${encodeURIComponent(tokenData.error)}`,
                    req.url
                )
            );
        }

        // Extract required data from Slack response
        const {
            access_token,
            token_type,
            scope,
            bot_user_id,
            app_id,
            team = {},
            enterprise = {}
        } = tokenData;

        const teamId = team.id || enterprise?.id;
        const teamName = team.name;

        // Get bot user info
        let botUsername = '';
        try {
            const userInfoResponse = await fetch('https://slack.com/api/users.info', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    user: bot_user_id
                }).toString()
            });

            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json();
                botUsername = userInfo.user?.real_name || userInfo.user?.name || bot_user_id;
            }
        } catch (error) {
            console.error('Failed to fetch bot user info:', error);
            // Continue without bot username, we have the ID
        }

        // Encrypt the access token before storing
        const encryptedToken = encryptToken(access_token);

        // Create or update Slack integration
        const integration = await db.slackIntegration.upsert({
            where: {projectId},
            create: {
                projectId,
                accessToken: encryptedToken,
                teamId,
                teamName,
                botUserId: bot_user_id,
                botUsername,
                channelId: '', // Will be configured by user in settings
                channelName: '',
                autoSend: true,
                enabled: true,
                postCount: 0
            },
            update: {
                accessToken: encryptedToken,
                teamId,
                teamName,
                botUserId: bot_user_id,
                botUsername,
                enabled: true
            }
        });

        // Redirect back to Slack integration settings page
        return NextResponse.redirect(
            new URL(
                `/dashboard/projects/${projectId}/integrations/slack?connected=true`,
                req.url
            )
        );
    } catch (error) {
        console.error('Error in Slack OAuth callback:', error);
        return NextResponse.redirect(
            new URL('/dashboard/projects?slack_error=An%20unexpected%20error%20occurred', req.url)
        );
    }
}