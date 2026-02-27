import { ScheduledJobExecutor } from '../scheduled-job.service'
import { runAutoRenewal } from '@/lib/custom-domains/ssl/auto-renewal'
import { scheduleNextSslRenewal } from '@/lib/custom-domains/ssl/setup-renewal-job'

/**
 * SSL Certificate Auto-Renewal Executor
 *
 * This executor runs periodically to renew SSL certificates that are expiring soon.
 * It doesn't use entityId since it processes all expiring certificates in one run.
 * After successful execution, it automatically schedules the next renewal for tomorrow.
 */
export class SslRenewalExecutor implements ScheduledJobExecutor {
    async execute(entityId: string): Promise<void> {
        console.log('[ssl-renewal-executor] Starting SSL certificate renewal check')

        try {
            const result = await runAutoRenewal()

            console.log('[ssl-renewal-executor] Renewal completed:', {
                checked: result.checked,
                renewed: result.renewed,
                failed: result.failed,
            })

            if (result.errors.length > 0) {
                console.error('[ssl-renewal-executor] Renewal errors:', result.errors)
            }

            // Schedule the next renewal for tomorrow at 3 AM
            await scheduleNextSslRenewal()
        } catch (error) {
            console.error('[ssl-renewal-executor] Failed to run auto-renewal:', error)
            throw error
        }
    }
}
