import { NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth/tokens'
import { cookies } from 'next/headers'
import { shouldUseSecureCookies } from '@/lib/utils/cookies'

/**
 * @method POST
 * @description Refreshes the access token by providing a valid refresh token
 * @path /api/token/refresh
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "user": {
 *       "type": "object",
 *       "properties": {
 *         "id": { "type": "string" },
 *         "name": { "type": "string" },
 *         "email": { "type": "string" },
 *         "role": { "type": "string" },
 *         "createdAt": { "type": "string", "format": "date-time" }
 *       }
 *     },
 *     "accessToken": { "type": "string" },
 *     "refreshToken": { "type": "string" }
 *   }
 * }
 * @error 400 Invalid or expired refresh token
 * @error 401 Unauthorized - No refresh token provided
 * @error 500 An unexpected error occurred while refreshing the token
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const refreshTokenCookie = await cookieStore.get('refreshToken')

        if (!refreshTokenCookie?.value) {
            return NextResponse.json({
                error: 'No refresh token provided'
            }, { status: 401 })
        }

        // Attempt to refresh the token
        const result = await refreshAccessToken(refreshTokenCookie.value)

        if (!result) {
            const response = NextResponse.json({
                error: 'Invalid or expired refresh token'
            }, { status: 401 })

            response.cookies.delete('refreshToken')
            response.cookies.delete('accessToken')
            return response
        }

        // Create response with new tokens
        const response = NextResponse.json({
            user: result.user
        })

        const useSecure = shouldUseSecureCookies(request)

        response.cookies.set('accessToken', result.accessToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 15 * 60,
            path: '/'
        })

        response.cookies.set('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: useSecure,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        })

        return response
    } catch (error) {
        console.error('Token refresh error:', error)

        const response = NextResponse.json({
            error: 'Failed to refresh token',
            details: process.env.NODE_ENV === 'development'
                ? { message: error instanceof Error ? error.message : 'Unknown error' }
                : undefined
        }, { status: 500 })

        response.cookies.delete('refreshToken')
        response.cookies.delete('accessToken')
        return response
    }
}