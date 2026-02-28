import { NextResponse } from 'next/server'

/**
 * Runtime configuration endpoint
 * Returns environment variables that need to be available at runtime (not build time)
 * This is the Next.js recommended pattern for NEXT_PUBLIC_* variables that need runtime flexibility
 */
export async function GET() {
    return NextResponse.json({
        sslEnabled: process.env.NEXT_PUBLIC_SSL_ENABLED === 'true',
    })
}
