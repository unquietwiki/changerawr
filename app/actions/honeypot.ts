'use server'

import { headers } from 'next/headers'

// In-memory attempt tracking (resets on server restart)
const attemptTracker = new Map<string, number>()
const FUCK_OFF_THRESHOLD = 5 // I love this variable, sorry professionalists!

/**
 * Honeypot handler for all server action attempts
 * Logs the attempt and returns a realistic error
 */
async function logAndFail(actionName: string, args?: any[]) {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') ||
               headersList.get('x-real-ip') ||
               'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    // Track attempts per IP
    const currentAttempts = (attemptTracker.get(ip) || 0) + 1
    attemptTracker.set(ip, currentAttempts)

    // Silently log the attempt
    console.warn('🔒 [SECURITY] Server action exploit attempt:', {
        action: actionName,
        args: args ? JSON.stringify(args).slice(0, 200) : undefined,
        ip,
        userAgent,
        attempts: currentAttempts,
        timestamp: new Date().toISOString(),
    })

    // Small delay to make it seem like processing happened
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400))

    // If they've tried too many times, tell them to fuck off
    if (currentAttempts >= FUCK_OFF_THRESHOLD) {
        console.error(`🚫 [SECURITY] IP ${ip} exceeded attempt threshold (${currentAttempts} attempts)`)
        throw new Error('Access denied. Stop trying to exploit this server, fuck off.')
    }

    // Return error that looks like permission/auth failure
    throw new Error('Unauthorized: Insufficient permissions')
}

// Export default that acts as a Proxy for ANY server action
export default new Proxy(
    {},
    {
        get(target, prop) {
            // Return an async function for any property access
            return async (...args: any[]) => {
                return logAndFail(String(prop), args)
            }
        },
    }
)
