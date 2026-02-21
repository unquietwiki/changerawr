import {isValidElement} from 'react';
import {render} from '@react-email/render';
import {createTransport, SendMailOptions} from 'nodemailer';
import {db} from '@/lib/db';
import SchedulePublishedEmail from '@/emails/schedule-published';
import SMTPTransport from "nodemailer/lib/smtp-transport";

interface SendScheduleNotificationParams {
    userId: string;
    entryId: string;
    projectId: string;
}

// Type for audit log details that contain staffUserId
interface AuditLogDetailsWithStaffUser {
    staffUserId?: string;
    entryId?: string;
    [key: string]: unknown;
}

/**
 * Sends a notification email to the user who scheduled an entry when it gets automatically published
 */
export async function sendSchedulePublishedNotification({
                                                            userId,
                                                            entryId,
                                                            projectId
                                                        }: SendScheduleNotificationParams): Promise<boolean> {
    try {
        // Get user details with settings
        const user = await db.user.findUnique({
            where: {id: userId},
            include: {settings: true}
        });

        if (!user) {
            console.log(`User ${userId} not found for schedule notification`);
            return false;
        }

        // Check if user wants notifications (default to true if no preference set)
        if (user.settings?.enableNotifications === false) {
            console.log(`User ${userId} has notifications disabled`);
            return false;
        }

        // Get the published entry with project details
        const entry = await db.changelogEntry.findUnique({
            where: {id: entryId},
            include: {
                changelog: {
                    include: {
                        project: true
                    }
                }
            }
        });

        if (!entry) {
            console.error(`Entry ${entryId} not found for schedule notification`);
            return false;
        }

        // Get system email configuration
        const systemConfig = await db.systemConfig.findFirst({
            where: {id: 1}
        });

        if (!systemConfig || !systemConfig.systemEmail || !systemConfig.smtpHost) {
            console.error('System email not configured for schedule notifications');
            return false;
        }

        // Set up email transporter
        const transporterOptions: SMTPTransport.Options = {
            host: systemConfig.smtpHost,
            port: systemConfig.smtpPort || 587,
            secure: !!systemConfig.smtpSecure,
            auth: systemConfig.smtpUser && systemConfig.smtpPassword
                ? {
                    user: systemConfig.smtpUser,
                    pass: systemConfig.smtpPassword,
                }
                : undefined,
            tls: {
                rejectUnauthorized: !!systemConfig.smtpSecure,
            },
        };

        const transporter = createTransport(transporterOptions);

        // Prepare email content
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const publicChangelogUrl = entry.changelog.project.isPublic
            ? `${appUrl}/changelog/${projectId}`
            : undefined;

        // Resolve timezone: user preference > system default > UTC
        const effectiveTimezone = (user.settings?.timezone) || systemConfig.timezone || 'UTC';

        const emailProps = {
            recipientName: user.name || undefined,
            projectName: entry.changelog.project.name,
            entryTitle: entry.title,
            entryVersion: entry.version || undefined,
            publishedAt: entry.publishedAt || new Date(),
            dashboardUrl: `${appUrl}/dashboard`, // Added missing dashboardUrl
            viewEntryUrl: publicChangelogUrl,
            timezone: effectiveTimezone,
        };

        // Render the email template
        const emailComponent = SchedulePublishedEmail(emailProps);

        const html = isValidElement(emailComponent)
            ? await render(emailComponent, {pretty: true})
            : '';

        const text = isValidElement(emailComponent)
            ? await render(emailComponent, {plainText: true})
            : '';

        if (!html) {
            console.error('Failed to render schedule notification email template');
            return false;
        }

        // Send the email
        const subject = `🎉 Your scheduled entry "${entry.title}" is now live!`;

        const mailOptions: SendMailOptions = {
            from: `"Changerawr" <${systemConfig.systemEmail}>`,
            to: user.email,
            subject,
            html,
            text,
        };

        const result = await transporter.sendMail(mailOptions);

        // Log the notification in audit log
        await db.auditLog.create({
            data: {
                action: 'SCHEDULE_NOTIFICATION_SENT',
                userId: userId,
                targetUserId: userId,
                details: {
                    notificationType: 'schedule_published',
                    entryId: entry.id,
                    entryTitle: entry.title,
                    projectId: projectId,
                    projectName: entry.changelog.project.name,
                    messageId: result.messageId,
                    recipientEmail: user.email,
                    publishedAt: entry.publishedAt?.toISOString(),
                    timestamp: new Date().toISOString()
                }
            }
        });

        console.log(`Schedule notification sent to ${user.email} for entry ${entry.title}`);
        return true;

    } catch (error) {
        console.error('Failed to send schedule published notification:', error);

        // Log the error but don't throw - we don't want to fail the job execution
        try {
            await db.auditLog.create({
                data: {
                    action: 'SCHEDULE_NOTIFICATION_ERROR',
                    userId: userId,
                    targetUserId: userId,
                    details: {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        entryId,
                        projectId,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } catch (auditError) {
            console.error('Failed to log schedule notification error:', auditError);
        }

        return false;
    }
}

/**
 * Helper function to get the user ID who scheduled an entry
 * This looks at audit logs to find who created the schedule
 */
export async function getScheduleCreatorUserId(entryId: string): Promise<string | null> {
    try {
        // Look for the most recent schedule creation audit log for this entry
        const auditLog = await db.auditLog.findFirst({
            where: {
                action: {
                    in: ['CHANGELOG_ENTRY_SCHEDULED', 'CHANGELOG_SCHEDULE_APPROVED']
                },
                details: {
                    path: ['entryId'],
                    equals: entryId
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (auditLog) {
            // For approved schedules, get the original requester (staffUserId)
            if (auditLog.action === 'CHANGELOG_SCHEDULE_APPROVED') {
                const details = auditLog.details as AuditLogDetailsWithStaffUser;
                const staffUserId = details?.staffUserId;
                if (staffUserId && typeof staffUserId === 'string') {
                    return staffUserId;
                }
            }

            // For direct schedules, use the userId who performed the action
            return auditLog.userId;
        }

        // Fallback: look for schedule requests
        const scheduleRequest = await db.changelogRequest.findFirst({
            where: {
                type: 'ALLOW_SCHEDULE',
                changelogEntryId: entryId,
                status: 'APPROVED'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (scheduleRequest?.staffId) {
            return scheduleRequest.staffId;
        }

        return null;
    } catch (error) {
        console.error('Failed to get schedule creator user ID:', error);
        return null;
    }
}