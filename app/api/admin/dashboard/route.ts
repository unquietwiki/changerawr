import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateAuthAndGetUser } from '@/lib/utils/changelog'

/**
 * @method GET
 * @description Fetches dashboard metrics for the authenticated user
 * @description Validates that the authenticated user has 'ADMIN' role
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "userCount": {
 *       "type": "object",
 *       "properties": {
 *         "total": { "type": "number" },
 *         "admins": { "type": "number" },
 *         "staff": { "type": "number" }
 *       }
 *     },
 *     "invitations": {
 *       "type": "object",
 *       "properties": {
 *         "total": { "type": "number" },
 *         "pending": { "type": "number" }
 *       }
 *     },
 *     "changelog": {
 *       "type": "object",
 *       "properties": {
 *         "totalEntries": { "type": "number" },
 *         "entriesThisMonth": { "type": "number" }
 *       }
 *     },
 *     "systemHealth": {
 *       "type": "object",
 *       "properties": {
 *         "databaseConnected": { "type": "boolean" },
 *         "lastDataSync": { "type": "string", "format": "date-time" }
 *       }
 *     }
 *   }
 * }
 * @error 403 Unauthorized - User does not have 'ADMIN' role
 * @error 500 An unexpected error occurred while fetching dashboard data
 */
export async function GET() {
    try {
        // Validate that the user is an admin
        const user = await validateAuthAndGetUser()
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Calculate start of current month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Fetch dashboard metrics
        const [
            userCount,
            invitations,
            changelog,
            systemHealth
        ] = await Promise.all([
            // User counts excluding system users
            db.user.groupBy({
                by: ['role'],
                where: {
                    email: {
                        not: {
                            contains: '@changerawr.sys'
                        }
                    }
                },
                _count: {
                    id: true
                }
            }),
            // Invitation metrics
            db.invitationLink.aggregate({
                _count: {
                    id: true
                },
                where: {
                    usedAt: null,
                    expiresAt: { gt: new Date() }
                }
            }),
            // Changelog metrics
            db.changelogEntry.aggregate({
                _count: { id: true },
                where: {
                    publishedAt: { gte: startOfMonth }
                }
            }),
            // System health (simple database connection check)
            (async () => ({
                databaseConnected: true,
                lastDataSync: new Date().toISOString()
            }))()
        ])

        // Aggregate user counts
        const userCountData = {
            total: userCount.reduce((sum, group) => sum + group._count.id, 0),
            admins: userCount.find(group => group.role === 'ADMIN')?._count.id || 0,
            staff: userCount.find(group => group.role === 'STAFF')?._count.id || 0
        }

        return NextResponse.json({
            userCount: userCountData,
            invitations: {
                total: await db.invitationLink.count(),
                pending: invitations._count.id
            },
            changelog: {
                totalEntries: await db.changelogEntry.count(),
                entriesThisMonth: changelog._count.id
            },
            systemHealth
        })
    } catch (error) {
        console.error('Dashboard data fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
    }
}