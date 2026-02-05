import {NextRequest, NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {db} from '@/lib/db'
import {encryptToken} from '@/lib/utils/encryption'

/**
 * GET /api/integrations/slack/callback
 * Handle OAuth callback from Slack
 * Exchanges auth code for access token and saves integration
 */
/**
 * Get the correct app URL, handling proxies, internal IPs, and IPv6
 */
function getAppUrl(req: NextRequest): string {
    // Priority 1: Environment variable (most reliable)
    if (process.env.NEXT_PUBLIC_APP_URL) {
        const url = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''); // Remove trailing slash
        console.log('[Slack Callback] Using NEXT_PUBLIC_APP_URL:', url);
        return url;
    }

    // Priority 2: Check forwarded headers (for proxies)
    const forwardedProto = req.headers.get('x-forwarded-proto') || req.headers.get('x-forwarded-protocol');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = req.headers.get('host');

    if (forwardedProto && (forwardedHost || host)) {
        const finalHost = forwardedHost || host;
        const url = `${forwardedProto}://${finalHost}`;
        console.log('[Slack Callback] Using forwarded headers:', url);
        return url;
    }

    // Priority 3: Parse from request URL
    const url = new URL(req.url);
    let hostname = url.hostname;
    const port = url.port;
    const protocol = url.protocol;

    // Handle IPv6 addresses - ensure they're wrapped in brackets
    if (hostname.includes(':') && !hostname.startsWith('[')) {
        hostname = `[${hostname}]`;
    }

    // Construct URL with port if non-standard
    const portSuffix = (
        (protocol === 'https:' && port && port !== '443') ||
        (protocol === 'http:' && port && port !== '80')
    ) ? `:${port}` : '';

    const finalUrl = `${protocol}//${hostname}${portSuffix}`;
    console.log('[Slack Callback] Using request URL:', finalUrl, 'from req.url:', req.url);
    return finalUrl;
}

/**
 * Create an absolute URL from a path and base URL
 */
function createAbsoluteUrl(path: string, baseUrl: string): string {
    // Ensure baseUrl doesn't have trailing slash and path starts with /
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const absoluteUrl = `${cleanBase}${cleanPath}`;
    console.log('[Slack Callback] Created absolute URL:', absoluteUrl);
    return absoluteUrl;
}

export async function GET(req: NextRequest) {
    try {
        // Use helper function to get correct app URL (supports proxies, internal IPs, IPv6)
        const appUrl = getAppUrl(req);
        console.log('[Slack Callback] Final appUrl determined:', appUrl);

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
                createAbsoluteUrl(`/dashboard/projects?slack_error=${encodeURIComponent(errorMsg)}`, appUrl)
            );
        }

        // Validate required parameters
        if (!code || !state) {
            console.error('Missing OAuth parameters');
            return NextResponse.redirect(
                createAbsoluteUrl('/dashboard/projects?slack_error=Missing%20OAuth%20parameters', appUrl)
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
                createAbsoluteUrl('/dashboard/projects?slack_error=Invalid%20state%20parameter', appUrl)
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
                createAbsoluteUrl(`/dashboard/projects?slack_error=Project%20not%20found`, appUrl)
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
                createAbsoluteUrl(
                    `/dashboard/projects/${projectId}/integrations/slack?error=Slack%20OAuth%20not%20configured`,
                    appUrl
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
                redirect_uri: `${appUrl}/api/integrations/slack/callback`
            }).toString()
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('Slack token exchange failed:', error);
            return NextResponse.redirect(
                createAbsoluteUrl(
                    `/dashboard/projects/${projectId}/integrations/slack?error=Failed%20to%20exchange%20token`,
                    appUrl
                )
            );
        }

        const tokenData = await tokenResponse.json();

        if (!tokenData.ok) {
            console.error('Slack token exchange error:', tokenData.error);
            return NextResponse.redirect(
                createAbsoluteUrl(
                    `/dashboard/projects/${projectId}/integrations/slack?error=${encodeURIComponent(tokenData.error)}`,
                    appUrl
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
            createAbsoluteUrl(
                `/dashboard/projects/${projectId}/integrations/slack?connected=true`,
                appUrl
            )
        );
    } catch (error) {
        console.error('Error in Slack OAuth callback:', error);
        const appUrl = getAppUrl(req);
        return NextResponse.redirect(
            createAbsoluteUrl('/dashboard/projects?slack_error=An%20unexpected%20error%20occurred', appUrl)
        );
    }
}