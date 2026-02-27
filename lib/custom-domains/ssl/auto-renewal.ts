import { db } from '@/lib/db'
import { renewCertificate } from './service'

// ─── Auto-Renewal Configuration ──────────────────────────────────────────────

// Renew certificates when they have less than this many days remaining
const RENEWAL_THRESHOLD_DAYS = parseInt(process.env.SSL_RENEWAL_THRESHOLD_DAYS || '30', 10)

// Maximum number of certificates to process in one run (prevents overwhelming the system)
const MAX_BATCH_SIZE = parseInt(process.env.SSL_RENEWAL_BATCH_SIZE || '10', 10)

// ─── Auto-Renewal Job ────────────────────────────────────────────────────────

export async function runAutoRenewal(): Promise<{
    checked: number
    renewed: number
    failed: number
    errors: Array<{ domain: string; error: string }>
}> {
    const now = Date.now()
    const thresholdDate = new Date(now + RENEWAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    console.log('[auto-renewal] Starting renewal check...')
    console.log(`[auto-renewal] Threshold: ${RENEWAL_THRESHOLD_DAYS} days (expires before ${thresholdDate.toISOString()})`)

    // Find certificates that are:
    // 1. Currently ISSUED
    // 2. Expiring within the threshold
    // 3. Not already being renewed (no pending cert for the same domain)
    const expiringCerts = await db.domainCertificate.findMany({
        where: {
            status: 'ISSUED',
            expiresAt: {
                lte: thresholdDate,
            },
        },
        include: {
            domain: {
                include: {
                    certificates: {
                        where: {
                            status: {
                                in: ['PENDING_HTTP01', 'PENDING_DNS01'],
                            },
                        },
                    },
                },
            },
        },
        take: MAX_BATCH_SIZE,
        orderBy: {
            expiresAt: 'asc', // Process the ones expiring soonest first
        },
    })

    // Filter out domains that already have a pending renewal
    const certsToRenew = expiringCerts.filter(
        cert => cert.domain.certificates.length === 0
    )

    console.log(`[auto-renewal] Found ${expiringCerts.length} expiring certificates`)
    console.log(`[auto-renewal] ${certsToRenew.length} eligible for renewal (${expiringCerts.length - certsToRenew.length} already pending)`)

    let renewed = 0
    let failed = 0
    const errors: Array<{ domain: string; error: string }> = []

    for (const cert of certsToRenew) {
        const daysUntilExpiry = cert.expiresAt
            ? Math.floor((cert.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000))
            : 'unknown'

        console.log(`[auto-renewal] Renewing ${cert.domain.domain} (expires in ${daysUntilExpiry} days)`)

        try {
            await renewCertificate(cert)
            renewed++
            console.log(`[auto-renewal] ✓ Renewal initiated for ${cert.domain.domain}`)
        } catch (error) {
            failed++
            const errorMessage = error instanceof Error ? error.message : String(error)
            errors.push({ domain: cert.domain.domain, error: errorMessage })
            console.error(`[auto-renewal] ✗ Failed to renew ${cert.domain.domain}:`, errorMessage)

            // Mark the error in the database
            await db.domainCertificate.update({
                where: { id: cert.id },
                data: {
                    lastError: `Auto-renewal failed: ${errorMessage}`,
                    renewalAttempts: { increment: 1 },
                },
            }).catch(() => {})
        }
    }

    const summary = {
        checked: expiringCerts.length,
        renewed,
        failed,
        errors,
    }

    console.log('[auto-renewal] Summary:', summary)

    return summary
}

// ─── Manual Trigger (for testing) ────────────────────────────────────────────

export async function checkCertificateHealth(): Promise<{
    total: number
    issued: number
    expiringSoon: number
    expired: number
    pending: number
    failed: number
}> {
    const now = new Date()
    const thresholdDate = new Date(now.getTime() + RENEWAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    const [total, issued, expiringSoon, expired, pending, failed] = await Promise.all([
        db.domainCertificate.count(),
        db.domainCertificate.count({ where: { status: 'ISSUED' } }),
        db.domainCertificate.count({
            where: {
                status: 'ISSUED',
                expiresAt: { lte: thresholdDate },
            },
        }),
        db.domainCertificate.count({ where: { status: 'EXPIRED' } }),
        db.domainCertificate.count({
            where: {
                status: { in: ['PENDING_HTTP01', 'PENDING_DNS01'] },
            },
        }),
        db.domainCertificate.count({ where: { status: 'FAILED' } }),
    ])

    return {
        total,
        issued,
        expiringSoon,
        expired,
        pending,
        failed,
    }
}
