import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {cookies} from 'next/headers'
import {verifyAccessToken} from '@/lib/auth/tokens'

export async function GET() {
    try {
        const config = await db.systemConfig.findFirst({
            select: {timezone: true, allowUserTimezone: true, customDateTemplates: true},
        })

        const globalTimezone = config?.timezone ?? 'UTC'
        const allowUserTimezone = config?.allowUserTimezone ?? true
        const customDateTemplates = (config?.customDateTemplates as { format: string; label: string }[] | null) ?? null

        // If user timezone overrides are allowed, try to get the user's preference
        if (allowUserTimezone) {
            try {
                const cookieStore = await cookies()
                const token = cookieStore.get('accessToken')?.value
                if (token) {
                    const userId = await verifyAccessToken(token)
                    if (userId) {
                        const settings = await db.settings.findUnique({
                            where: {userId},
                            select: {timezone: true},
                        })
                        if (settings?.timezone) {
                            return NextResponse.json({
                                timezone: settings.timezone,
                                source: 'user',
                                allowUserTimezone: true,
                                customDateTemplates,
                            })
                        }
                    }
                }
            } catch {
                // Token invalid or no auth — fall through to global
            }
        }

        return NextResponse.json({
            timezone: globalTimezone,
            source: 'system',
            allowUserTimezone,
            customDateTemplates,
        })
    } catch {
        return NextResponse.json({
            timezone: 'UTC',
            source: 'system',
            allowUserTimezone: true,
        })
    }
}
