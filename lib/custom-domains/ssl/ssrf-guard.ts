import dns from 'dns/promises'

const BLOCKED_PREFIXES = [
    '127.',
    '0.',
    '10.',
    '169.254.',  // link-local
    '192.168.',
    '::1',       // IPv6 loopback
    'fc',        // IPv6 ULA
    'fd',        // IPv6 ULA
] as const

// 172.16.0.0/12 requires a range check, not just a prefix
function is172Private(ip: string): boolean {
    const match = ip.match(/^172\.(\d+)\./)
    if (!match) return false
    const octet = parseInt(match[1], 10)
    return octet >= 16 && octet <= 31
}

function isPrivateIp(ip: string): boolean {
    if (BLOCKED_PREFIXES.some(p => ip.startsWith(p))) return true
    if (is172Private(ip)) return true
    return false
}

// Throws if the hostname resolves to any private or loopback address.
// Call before any outbound ACME request to prevent SSRF.
export async function assertNotInternal(hostname: string): Promise<void> {
    let addresses: string[] = []

    try {
        const v4 = await dns.resolve4(hostname).catch(() => [])
        const v6 = await dns.resolve6(hostname).catch(() => [])
        addresses = [...v4, ...v6]
    } catch {
        // DNS failure — let ACME handle it
        return
    }

    for (const ip of addresses) {
        if (isPrivateIp(ip)) {
            throw new Error(
                `${hostname} resolves to private IP ${ip} — cannot issue certificate`,
            )
        }
    }
}