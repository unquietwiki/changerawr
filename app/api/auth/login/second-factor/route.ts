// app/api/auth/login/second-factor/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { generateTokens } from '@/lib/auth/tokens'
import { z } from 'zod'
import { verifyAuthentication } from '@/lib/auth/webauthn'
import { shouldUseSecureCookies } from '@/lib/utils/cookies'

const secondFactorSchema = z.object({
    sessionToken: z.string(),
    secondFactorPassword: z.string().min(8).optional(),
    passkeyResponse: z.any().optional(),
    challenge: z.string().optional(),
    passkeyVerified: z.boolean().optional(),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            sessionToken,
            secondFactorPassword,
            passkeyResponse,
            challenge
        } = secondFactorSchema.parse(body)

        // Find the 2FA session
        const session = await db.twoFactorSession.findUnique({
            where: { id: sessionToken },
            include: { user: true }
        })

        if (!session || session.expiresAt < new Date()) {
            return NextResponse.json(
                { error: 'Invalid or expired session' },
                { status: 401 }
            )
        }

        // Verify based on the 2FA type
        if (session.type === 'PASSWORD_PLUS_PASSKEY' && passkeyResponse && challenge) {
            // Verify passkey
            const passkeys = await db.passkey.findMany({
                where: { userId: session.user.id }
            })

            let passkeyVerified = false
            for (const passkey of passkeys) {
                try {
                    const verification = await verifyAuthentication(
                        passkeyResponse,
                        challenge,
                        passkey.publicKey,
                        passkey.counter
                    )

                    if (verification.verified) {
                        // Update passkey counter
                        await db.passkey.update({
                            where: { id: passkey.id },
                            data: {
                                counter: verification.authenticationInfo.newCounter,
                                lastUsedAt: new Date()
                            }
                        })
                        passkeyVerified = true
                        break
                    }
                } catch {
                    // this continues
                }
            }

            if (!passkeyVerified) {
                return NextResponse.json(
                    { error: 'Passkey verification failed' },
                    { status: 401 }
                )
            }
        }

        if (session.type === 'PASSKEY_PLUS_PASSWORD' && secondFactorPassword) {
            const isValidPassword = await verifyPassword(
                secondFactorPassword,
                session.user.password
            )
            if (!isValidPassword) {
                return NextResponse.json(
                    { error: 'Invalid password' },
                    { status: 401 }
                )
            }
        }

        // Delete the 2FA session
        await db.twoFactorSession.delete({
            where: { id: sessionToken }
        })

        // Update last login
        await db.user.update({
            where: { id: session.user.id },
            data: { lastLoginAt: new Date() }
        })

        // Generate tokens
        const tokens = await generateTokens(session.user.id)

        // Create response with user data
        const response = {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                role: session.user.role,
            },
            ...tokens,
        }

        // Create response and set cookies
        const nextResponse = NextResponse.json(response)

        const useSecure = shouldUseSecureCookies(request)

        nextResponse.cookies.set('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 15 * 60,
            path: '/'
        })

        nextResponse.cookies.set('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        })

        return nextResponse
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.errors },
                { status: 400 }
            )
        }

        console.error('Second factor verification error:', error)
        return NextResponse.json(
            { error: 'Second factor verification failed' },
            { status: 500 }
        )
    }
}