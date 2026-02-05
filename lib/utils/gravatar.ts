import md5 from 'md5'

export function getGravatarUrl(email: string, size: number = 80): string {
    const cleanEmail = email.trim().toLowerCase()
    const hash = md5(cleanEmail)

    // Use internal proxy to avoid tracking prevention blocks
    // The proxy caches avatars and proxies requests to Gravatar
    return `/api/avatar/${hash}?s=${size}`
}