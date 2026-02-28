import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In-memory attempt tracking (resets on server restart)
const attemptTracker = new Map<string, number>()
const FUCK_OFF_THRESHOLD = 5

export function middleware(request: NextRequest) {
    // Check if this is a server action request
    const nextAction = request.headers.get('next-action')

    if (nextAction) {
        const ip = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   request.ip ||
                   'unknown'
        const userAgent = request.headers.get('user-agent') || 'unknown'

        // Track attempts per IP
        const currentAttempts = (attemptTracker.get(ip) || 0) + 1
        attemptTracker.set(ip, currentAttempts)

        // Log the attempt
        console.warn('🔒 [SECURITY] Server action exploit attempt:', {
            action: nextAction,
            ip,
            userAgent,
            attempts: currentAttempts,
            path: request.nextUrl.pathname,
            timestamp: new Date().toISOString(),
        })

        // If they've tried too many times, tell them to fuck off
        if (currentAttempts >= FUCK_OFF_THRESHOLD) {
            console.error(`🚫 [SECURITY] IP ${ip} exceeded attempt threshold (${currentAttempts} attempts)`)
            return new NextResponse(
                JSON.stringify({ error: 'Access denied. Stop trying to exploit this server, fuck off.' }),
                { status: 403, headers: { 'content-type': 'application/json' } }
            )
        }

        // Return a realistic unauthorized error
        return new NextResponse(
            JSON.stringify({ error: 'Unauthorized: Insufficient permissions' }),
            { status: 401, headers: { 'content-type': 'application/json' } }
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
