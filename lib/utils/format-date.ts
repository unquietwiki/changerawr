/**
 * Timezone-aware date formatting utilities.
 *
 * These helpers format dates for user-facing display using the effective
 * timezone (user override or system global) fetched from /api/config/timezone.
 *
 * WHEN TO USE:
 *   - Displaying absolute dates to users (created at, published at, etc.)
 *   - Rendering dates in emails sent to users
 *
 * WHEN NOT TO USE:
 *   - Relative times (use date-fns formatDistanceToNow — timezone-safe)
 *   - Storing / comparing dates (keep ISO/UTC)
 *   - Server-side scheduling logic
 */

type DateInput = string | Date | number

function toDate(input: DateInput): Date {
    return input instanceof Date ? input : new Date(input)
}

// ─── Formatters (require a timezone string) ────────────────────────────

/** "January 15, 2025" */
export function formatDateLong(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone,
    })
}

/** "Jan 15, 2025" */
export function formatDateMedium(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone,
    })
}

/** "1/15/2025" */
export function formatDateShort(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone,
    })
}

/** "January 15, 2025 at 3:45 PM" */
export function formatDateTime(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
    })
}

/** "Jan 15, 2025, 3:45 PM" */
export function formatDateTimeMedium(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
    })
}

/** "3:45 PM" */
export function formatTime(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
    })
}

/** "Jan 15, 2025, 3:45 PM EST" — includes timezone abbreviation */
export function formatDateTimeWithZone(input: DateInput, timeZone = 'UTC'): string {
    return toDate(input).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone,
    })
}
