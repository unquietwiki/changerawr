/**
 * Determine if cookies should use the `secure` flag based on protocol and env config.
 *
 * Environment variables:
 * - COOKIE_SECURE=false          → disables secure flag entirely
 * - COOKIE_INSECURE_DOMAINS=*    → disables secure flag for all domains
 * - COOKIE_INSECURE_DOMAINS=localhost,internal.local → disables for listed hosts
 */
export function shouldUseSecureCookies(request: Request): boolean {
    // Global override: COOKIE_SECURE=false disables secure cookies entirely
    if (process.env.COOKIE_SECURE === 'false') {
        return false
    }

    // Per-domain override
    const insecureDomains =
        process.env.COOKIE_INSECURE_DOMAINS?.trim() || '*'

    if (insecureDomains === '*') {
        return false
    }

    try {
        const hostname = new URL(request.url).hostname.toLowerCase()
        const allowed = insecureDomains
            .split(',')
            .map(d => d.trim().toLowerCase())
            .filter(Boolean)

        if (allowed.includes(hostname)) {
            return false
        }
    } catch {
        // Ignore URL parse errors
    }

    // Default: secure in production over HTTPS
    if (process.env.NODE_ENV !== 'production') {
        return false
    }

    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http')
    return protocol === 'https'
}
