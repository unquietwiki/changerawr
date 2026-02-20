import { NextResponse } from 'next/server';
import { verifyAuthentication } from '@/lib/auth/webauthn';
import { generateTokens } from '@/lib/auth/tokens';
import { createAuditLog } from '@/lib/utils/auditLog'; // Add this import
import { db } from '@/lib/db';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { shouldUseSecureCookies } from '@/lib/utils/cookies';

export async function POST(request: Request) {
    // Capture request metadata for audit logs
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create an initial audit log for the passkey authentication attempt
    let attemptLogId: string | null = null;
    try {
        // Use a placeholder ID since we don't know the user yet
        const placeholderId = 'passkey-attempt-' + Date.now().toString();

        const attemptLog = await db.auditLog.create({
            data: {
                action: 'LOGIN_PASSKEY_ATTEMPT',
                userId: placeholderId,
                targetUserId: placeholderId, // Using placeholder to avoid FK constraint
                details: JSON.stringify({
                    ipAddress,
                    userAgent,
                    timestamp: new Date().toISOString()
                })
            }
        });
        attemptLogId = attemptLog.id;
    } catch (auditLogError) {
        console.error('Failed to create passkey login attempt audit log:', auditLogError);
        // Continue with login process even if audit logging fails
    }

    try {
        const body = await request.json();
        const {
            response,
            challenge,
        } = body as {
            response: AuthenticationResponseJSON;
            challenge: string;
        };

        // Find the passkey
        const passkey = await db.passkey.findUnique({
            where: { credentialId: response.id },
            include: { user: true },
        });

        if (!passkey) {
            // Log passkey not found error
            try {
                await createAuditLog(
                    'LOGIN_PASSKEY_FAILURE',
                    'system', // No user ID available
                    'system', // No user ID available
                    {
                        reason: 'PASSKEY_NOT_FOUND',
                        credentialId: response.id,
                        ipAddress,
                        userAgent,
                        timestamp: new Date().toISOString(),
                        attemptLogId
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create passkey not found audit log:', auditLogError);
            }

            return NextResponse.json(
                { error: 'Passkey not found' },
                { status: 400 }
            );
        }

        // Update the original login attempt log with the correct user ID
        if (attemptLogId) {
            try {
                await db.auditLog.update({
                    where: { id: attemptLogId },
                    data: {
                        userId: passkey.userId,
                        targetUserId: passkey.userId
                    }
                });
            } catch (updateError) {
                console.error('Failed to update passkey login attempt audit log:', updateError);
            }
        }

        const verification = await verifyAuthentication(
            response,
            challenge,
            passkey.publicKey,
            passkey.counter
        );

        if (!verification.verified) {
            // Log verification failure
            try {
                await createAuditLog(
                    'LOGIN_PASSKEY_FAILURE',
                    passkey.userId,
                    passkey.userId,
                    {
                        reason: 'VERIFICATION_FAILED',
                        credentialId: passkey.credentialId,
                        passkeyName: passkey.name,
                        ipAddress,
                        userAgent,
                        timestamp: new Date().toISOString(),
                        attemptLogId
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create passkey verification failure audit log:', auditLogError);
            }

            return NextResponse.json(
                { error: 'Authentication verification failed' },
                { status: 400 }
            );
        }

        // Update counter and last used
        await db.passkey.update({
            where: { id: passkey.id },
            data: {
                counter: verification.authenticationInfo.newCounter,
                lastUsedAt: new Date(),
            },
        });

        const user = passkey.user;

        // Check if this passkey login requires a password as second factor
        if (user.twoFactorMode === 'PASSKEY_PLUS_PASSWORD') {
            // Create a 2FA session
            const session = await db.twoFactorSession.create({
                data: {
                    userId: user.id,
                    type: 'PASSKEY_PLUS_PASSWORD',
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                },
            });

            // Log successful first factor authentication
            try {
                await createAuditLog(
                    'LOGIN_PASSKEY_FIRST_FACTOR_SUCCESS',
                    user.id,
                    user.id,
                    {
                        email: user.email,
                        twoFactorMode: user.twoFactorMode,
                        passkeyId: passkey.id,
                        passkeyName: passkey.name,
                        sessionToken: session.id,
                        ipAddress,
                        userAgent,
                        timestamp: new Date().toISOString(),
                        attemptLogId
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create passkey first factor success audit log:', auditLogError);
            }

            return NextResponse.json({
                requiresSecondFactor: true,
                secondFactorType: 'password',
                sessionToken: session.id,
                message: 'Password verification required'
            });
        }

        // Complete regular login
        const tokens = await generateTokens(user.id);

        // Update last login
        await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        // Log successful passkey login
        try {
            await createAuditLog(
                'LOGIN_PASSKEY_SUCCESS',
                user.id,
                user.id,
                {
                    email: user.email,
                    role: user.role,
                    passkeyId: passkey.id,
                    passkeyName: passkey.name,
                    counterUpdated: verification.authenticationInfo.newCounter,
                    ipAddress,
                    userAgent,
                    timestamp: new Date().toISOString(),
                    attemptLogId
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create passkey login success audit log:', auditLogError);
        }

        const authResponse = NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        });

        // Set cookies
        const useSecure = shouldUseSecureCookies(request)

        authResponse.cookies.set('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 15 * 60,
            path: '/'
        });

        authResponse.cookies.set('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        });

        return authResponse;
    } catch (error) {
        // Log unexpected error during passkey authentication
        try {
            await createAuditLog(
                'LOGIN_PASSKEY_ERROR',
                'system', // No user ID available or might be unknown at this point
                'system', // No user ID available or might be unknown at this point
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    ipAddress,
                    userAgent,
                    timestamp: new Date().toISOString(),
                    attemptLogId
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create passkey error audit log:', auditLogError);
        }

        console.error('Failed to verify authentication:', error);
        return NextResponse.json(
            { error: 'Failed to verify authentication' },
            { status: 500 }
        );
    }
}