import { useQuery } from '@tanstack/react-query'

interface TimezoneResponse {
    timezone: string
    source: 'user' | 'system'
    allowUserTimezone: boolean
}

/**
 * Returns the effective timezone for the current user.
 * Resolves user override → system global → 'UTC' fallback.
 *
 * Uses a 5-minute stale time so the value is cached across components.
 */
export function useTimezone(): string {
    const { data } = useQuery<TimezoneResponse>({
        queryKey: ['system-timezone'],
        queryFn: async () => {
            const res = await fetch('/api/config/timezone')
            if (!res.ok) return { timezone: 'UTC', source: 'system' as const, allowUserTimezone: true }
            return res.json()
        },
        staleTime: 300000, // 5 minutes
    })

    return data?.timezone ?? 'UTC'
}
