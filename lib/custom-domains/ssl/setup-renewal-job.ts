import { db } from '@/lib/db'
import { ScheduledJobType, JobStatus } from '@prisma/client'

/**
 * Setup Daily SSL Renewal Job
 *
 * This creates a recurring scheduled job that runs daily at 3 AM to check
 * for expiring SSL certificates and renew them automatically.
 *
 * The job uses the existing ScheduledJobService infrastructure and will be
 * automatically executed by the JobRunnerService.
 */
export async function setupDailySslRenewal(): Promise<void> {
    // Check if a renewal job already exists and is pending/running
    const existingJob = await db.scheduledJob.findFirst({
        where: {
            type: ScheduledJobType.RENEW_SSL_CERTIFICATE,
            status: {
                in: [JobStatus.PENDING, JobStatus.RUNNING],
            },
        },
    })

    if (existingJob) {
        console.log('[ssl-renewal-setup] Daily SSL renewal job already exists:', existingJob.id)
        return
    }

    // Calculate next 3 AM
    const now = new Date()
    const next3AM = new Date(now)
    next3AM.setHours(3, 0, 0, 0)

    // If it's already past 3 AM today, schedule for tomorrow
    if (next3AM <= now) {
        next3AM.setDate(next3AM.getDate() + 1)
    }

    // Create the job
    const job = await db.scheduledJob.create({
        data: {
            type: ScheduledJobType.RENEW_SSL_CERTIFICATE,
            entityId: 'ssl-renewal', // Dummy entityId since this processes all certs
            scheduledAt: next3AM,
            maxRetries: 3,
        },
    })

    console.log('[ssl-renewal-setup] Created daily SSL renewal job:', {
        id: job.id,
        scheduledAt: job.scheduledAt.toISOString(),
    })
}

/**
 * Schedule Next SSL Renewal
 *
 * This should be called after each successful SSL renewal run to schedule
 * the next one for the following day at 3 AM.
 */
export async function scheduleNextSslRenewal(): Promise<void> {
    const tomorrow3AM = new Date()
    tomorrow3AM.setDate(tomorrow3AM.getDate() + 1)
    tomorrow3AM.setHours(3, 0, 0, 0)

    await db.scheduledJob.create({
        data: {
            type: ScheduledJobType.RENEW_SSL_CERTIFICATE,
            entityId: 'ssl-renewal',
            scheduledAt: tomorrow3AM,
            maxRetries: 3,
        },
    })

    console.log('[ssl-renewal-setup] Scheduled next SSL renewal for:', tomorrow3AM.toISOString())
}
