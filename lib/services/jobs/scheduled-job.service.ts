import {db} from "@/lib/db";
import {ScheduledJobType, JobStatus} from "@prisma/client";
import {createAuditLog} from "@/lib/utils/auditLog";
import {ChangelogPublishExecutor} from "@/lib/services/jobs/executors/changelog-publish.executor"
import {TelemetrySendExecutor} from "@/lib/services/jobs/executors/telemetry-send.executor"
import {SslRenewalExecutor} from "@/lib/services/jobs/executors/ssl-renewal.executor"

export interface CreateScheduledJobParams {
    type: ScheduledJobType;
    entityId: string;
    scheduledAt: Date;
    maxRetries?: number;
}

export interface ScheduledJobExecutor {
    execute(entityId: string): Promise<void>;
}

export class ScheduledJobService {
    private static executors: Map<ScheduledJobType, ScheduledJobExecutor> = new Map();

    /**
     * Register an executor for a specific job type
     */
    static registerExecutor(type: ScheduledJobType, executor: ScheduledJobExecutor): void {
        this.executors.set(type, executor);
    }

    /**
     * Create a new scheduled job
     */
    static async createJob(params: CreateScheduledJobParams): Promise<string> {
        const job = await db.scheduledJob.create({
            data: {
                type: params.type,
                entityId: params.entityId,
                scheduledAt: params.scheduledAt,
                maxRetries: params.maxRetries ?? 3,
            },
        });

        return job.id;
    }

    /**
     * Cancel a scheduled job
     */
    static async cancelJob(jobId: string, userId: string): Promise<boolean> {
        try {
            const job = await db.scheduledJob.findUnique({
                where: {id: jobId},
            });

            if (!job || job.status !== JobStatus.PENDING) {
                return false;
            }

            await db.scheduledJob.update({
                where: {id: jobId},
                data: {status: JobStatus.CANCELLED},
            });

            // Log the cancellation
            await createAuditLog(
                'SCHEDULED_JOB_CANCELLED',
                userId,
                userId,
                {
                    jobId: job.id,
                    jobType: job.type,
                    entityId: job.entityId,
                    originalScheduledAt: job.scheduledAt.toISOString(),
                }
            );

            return true;
        } catch (error) {
            console.error('Failed to cancel scheduled job:', error);
            return false;
        }
    }

    /**
     * Get due jobs that need to be executed
     */
    static async getDueJobs(): Promise<Array<{
        id: string;
        type: ScheduledJobType;
        entityId: string;
        scheduledAt: Date;
        retryCount: number;
    }>> {
        const now = new Date();

        return await db.scheduledJob.findMany({
            where: {
                status: JobStatus.PENDING,
                scheduledAt: {
                    lte: now,
                },
            },
            orderBy: {
                scheduledAt: 'asc',
            },
            select: {
                id: true,
                type: true,
                entityId: true,
                scheduledAt: true,
                retryCount: true,
            },
        });
    }

    /**
     * Execute a scheduled job
     */
    static async executeJob(jobId: string): Promise<boolean> {
        const job = await db.scheduledJob.findUnique({
            where: {id: jobId},
        });

        if (!job || job.status !== JobStatus.PENDING) {
            return false;
        }

        // Mark as running
        await db.scheduledJob.update({
            where: {id: jobId},
            data: {status: JobStatus.RUNNING},
        });

        try {
            const executor = this.executors.get(job.type);
            if (!executor) {
                throw new Error(`No executor registered for job type: ${job.type}`);
            }

            await executor.execute(job.entityId);

            // Mark as completed
            await db.scheduledJob.update({
                where: {id: jobId},
                data: {
                    status: JobStatus.COMPLETED,
                    executedAt: new Date(),
                },
            });

            return true;
        } catch (error) {
            console.error(`Failed to execute job ${jobId}:`, error);

            const shouldRetry = job.retryCount < job.maxRetries;

            await db.scheduledJob.update({
                where: {id: jobId},
                data: {
                    status: shouldRetry ? JobStatus.PENDING : JobStatus.FAILED,
                    retryCount: job.retryCount + 1,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    // Schedule retry for 5 minutes later if retrying
                    scheduledAt: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000) : job.scheduledAt,
                },
            });

            return false;
        }
    }

    /**
     * Get scheduled jobs for a specific entity
     */
    static async getJobsForEntity(entityId: string, type?: ScheduledJobType): Promise<Array<{
        id: string;
        type: ScheduledJobType;
        scheduledAt: Date;
        status: JobStatus;
        errorMessage: string | null;
    }>> {
        return await db.scheduledJob.findMany({
            where: {
                entityId,
                ...(type && {type}),
            },
            orderBy: {
                scheduledAt: 'desc',
            },
            select: {
                id: true,
                type: true,
                scheduledAt: true,
                status: true,
                errorMessage: true,
            },
        });
    }

    /**
     * Clean up old completed/failed jobs
     */
    static async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await db.scheduledJob.deleteMany({
            where: {
                status: {
                    in: [JobStatus.COMPLETED, JobStatus.FAILED],
                },
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });

        return result.count;
    }
}

ScheduledJobService.registerExecutor(
    ScheduledJobType.PUBLISH_CHANGELOG_ENTRY,
    new ChangelogPublishExecutor()
);

ScheduledJobService.registerExecutor(
    ScheduledJobType.TELEMETRY_SEND,
    new TelemetrySendExecutor()
);

ScheduledJobService.registerExecutor(
    ScheduledJobType.RENEW_SSL_CERTIFICATE,
    new SslRenewalExecutor()
);

// Export types and main service
export {ScheduledJobType, JobStatus};
export default ScheduledJobService;