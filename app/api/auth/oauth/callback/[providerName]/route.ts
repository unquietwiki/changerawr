import { NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/auth/oauth';
import { db } from '@/lib/db';
import { shouldUseSecureCookies } from '@/lib/utils/cookies';

/**
 * @method GET
 * @description Handles the OAuth callback and completes authentication
 * @param {string} providerName - The name of the OAuth provider
 * @query {
 *   code: Authorization code from OAuth provider
 *   state: State parameter returned from provider
 *   error: Error message if authorization failed
 * }
 * @response 302 Redirect to dashboard or specified redirect URL
 * @error 400 Invalid request
 * @error 500 Authentication failed
 */
// app/api/auth/oauth/callback/[providerName]/route.ts
export async function GET(
    request: Request,
    { params }: { params: Promise<{ providerName: string }> }
) {
    // Get the base URL for redirects - prioritize environment variable
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    // Log full request details for comprehensive debugging
    // console.log('OAuth Callback Request Details:', {
    //     url: request.url,
    //     method: request.method,
    //     headers: Object.fromEntries(request.headers),
    //     params: params,
    //     baseUrl
    // });

    try {
        const providerName = (await params).providerName;
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Log search parameters for additional context
        console.log('Search Parameters:', {
            code: code ? 'Present' : 'Missing',
            state: state ? 'Present' : 'Missing',
            error: error || 'None'
        });

        if (error) {
            console.error('OAuth error returned from provider:', error);
            const errorDescription = searchParams.get('error_description') || 'OAuth authentication failed';
            return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorDescription)}`);
        }

        if (!code) {
            return NextResponse.redirect(`${baseUrl}/login?error=Missing+authorization+code`);
        }

        // Comprehensive provider lookup with extensive logging
        let provider;
        try {
            // First, try direct ID match with case-insensitive name or ID
            provider = await db.oAuthProvider.findFirst({
                where: {
                    OR: [
                        { id: providerName },
                        {
                            name: {
                                equals: providerName,
                                mode: 'insensitive'
                            }
                        }
                    ],
                    enabled: true
                }
            });

            // Log results of lookup
            console.log('Provider Lookup Result:', {
                providerFound: !!provider,
                lookupCriteria: {
                    providerId: providerName,
                    enabled: true
                }
            });

            // If no provider found, do a full database check
            if (!provider) {
                // Fetch all providers to help diagnose the issue
                const allProviders = await db.oAuthProvider.findMany();

                console.log('All Providers in Database:', {
                    totalProviders: allProviders.length,
                    providerIds: allProviders.map(p => p.id),
                    providerNames: allProviders.map(p => p.name)
                });
            }
        } catch (dbError) {
            console.error('Database error during provider lookup:', {
                error: (dbError as Error).message,
                stack: (dbError as Error).stack
            });
            return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent('Database lookup failed')}`);
        }

        // Confirm provider is fully valid before proceeding
        if (!provider) {
            console.error(`Provider not found: ${providerName}`);
            return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(`Provider unavailable: ${providerName}`)}`);
        }

        // Comprehensive logging of found provider
        console.log('Verified Provider Details:', {
            id: provider.id,
            name: provider.name,
            enabled: provider.enabled
        });

        // Complete OAuth flow using verified provider name
        let authResult;
        try {
            authResult = await handleOAuthCallback(provider.name, code);
        } catch (authError) {
            console.error('OAuth callback handling error:', {
                error: (authError as Error).message,
                stack: (authError as Error).stack,
                providerName: provider.name
            });
            return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent('Authentication failed')}`);
        }

        // Get redirect URL from state if available
        let redirectUrl = `${baseUrl}/dashboard`;
        if (state) {
            try {
                const stateObj = JSON.parse(Buffer.from(state, 'base64').toString());
                if (stateObj.redirect) {
                    // Ensure redirect is absolute
                    redirectUrl = stateObj.redirect.startsWith('/')
                        ? `${baseUrl}${stateObj.redirect}`
                        : stateObj.redirect;
                }
            } catch (e) {
                console.error('Failed to parse state:', {
                    error: (e as Error).message,
                    stack: (e as Error).stack
                });
            }
        }

        // Create a response with cookies and redirect to the client-side handler
        // Pass the redirectUrl as a query parameter
        const response = NextResponse.redirect(`${baseUrl}/oauth-callback?redirect=${encodeURIComponent(redirectUrl)}`, {
            status: 302
        });

        const useSecure = shouldUseSecureCookies(request)

        response.cookies.set('accessToken', authResult.accessToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 15 * 60,
            path: '/'
        });

        response.cookies.set('refreshToken', authResult.refreshToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        });

        return response;
    } catch (error) {
        console.error('Unexpected OAuth callback error:', {
            error: (error as Error).message,
            stack: (error as Error).stack
        });
        return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent('Unexpected authentication error')}`);
    }
}