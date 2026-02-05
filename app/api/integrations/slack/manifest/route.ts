import {NextRequest, NextResponse} from 'next/server'

/**
 * GET /api/integrations/slack/manifest
 * Returns the Slack app manifest that users can import
 * This simplifies the setup process - users just copy/paste the manifest into Slack
 */
export async function GET(req: NextRequest) {
    try {
        // Use NEXT_PUBLIC_APP_URL to avoid localhost:80 issues in production behind proxies
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
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