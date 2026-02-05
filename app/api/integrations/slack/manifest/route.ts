import {NextRequest, NextResponse} from 'next/server'

/**
 * Get the correct app URL, handling proxies, internal IPs, and IPv6
 */
function getAppUrl(req: NextRequest): string {
    // Priority 1: Environment variable (most reliable)
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }

    // Priority 2: Check forwarded headers (for proxies)
    const forwardedProto = req.headers.get('x-forwarded-proto') || req.headers.get('x-forwarded-protocol');
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');

    if (forwardedProto && forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }

    // Priority 3: Parse from request URL
    const url = new URL(req.url);
    let host = url.hostname;
    const port = url.port;
    const protocol = url.protocol;

    // Handle IPv6 addresses - ensure they're wrapped in brackets
    if (host.includes(':') && !host.startsWith('[')) {
        host = `[${host}]`;
    }

    // Construct URL with port if non-standard
    const portSuffix = (
        (protocol === 'https:' && port && port !== '443') ||
        (protocol === 'http:' && port && port !== '80')
    ) ? `:${port}` : '';

    return `${protocol}//${host}${portSuffix}`;
}

/**
 * GET /api/integrations/slack/manifest
 * Returns the Slack app manifest that users can import
 * This simplifies the setup process - users just copy/paste the manifest into Slack
 */
export async function GET(req: NextRequest) {
    try {
        // Use helper function to get correct app URL (supports proxies, internal IPs, IPv6)
        const appUrl = getAppUrl(req);
        const redirectUri = `${appUrl}/api/integrations/slack/callback`;

        // Slack app manifest format
        const manifest = {
            _metadata: {
                major_version: 1,
                minor_version: 1
            },
            display_information: {
                name: 'Changerawr',
                description: 'Post changelog updates directly to your Slack workspace',
                background_color: '#ffffff',
                long_description: 'Changerawr is a changelog management platform. With this integration, automatically post your changelog updates to Slack channels so your team stays informed about product changes.'
            },
            features: {
                bot_user: {
                    display_name: 'Changerawr Bot',
                    always_online: false
                }
            },
            oauth_config: {
                redirect_urls: [redirectUri],
                scopes: {
                    bot: [
                        'chat:write',
                        'channels:join',
                        'channels:read',
                        'groups:read',
                        'im:read',
                        'mpim:read',
                        'users:read'
                    ]
                }
            },
            settings: {
                org_deploy_enabled: false,
                socket_mode_enabled: false,
                token_rotation_enabled: false
            }
        };

        return NextResponse.json(manifest, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="changerawr-slack-manifest.json"'
            }
        });
    } catch (error) {
        console.error('Error generating Slack manifest:', error);
        return NextResponse.json(
            {error: 'Failed to generate manifest'},
            {status: 500}
        );
    }
}