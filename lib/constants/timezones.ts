export const TIMEZONES = [
    // UTC
    {value: 'UTC', label: 'UTC', region: 'Universal'},

    // Americas
    {value: 'America/New_York', label: 'Eastern Time (US)', region: 'Americas'},
    {value: 'America/Chicago', label: 'Central Time (US)', region: 'Americas'},
    {value: 'America/Denver', label: 'Mountain Time (US)', region: 'Americas'},
    {value: 'America/Los_Angeles', label: 'Pacific Time (US)', region: 'Americas'},
    {value: 'America/Anchorage', label: 'Alaska Time (US)', region: 'Americas'},
    {value: 'Pacific/Honolulu', label: 'Hawaii Time (US)', region: 'Americas'},
    {value: 'America/Toronto', label: 'Eastern Time (Canada)', region: 'Americas'},
    {value: 'America/Vancouver', label: 'Pacific Time (Canada)', region: 'Americas'},
    {value: 'America/Sao_Paulo', label: 'Brasilia Time', region: 'Americas'},
    {value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time', region: 'Americas'},
    {value: 'America/Mexico_City', label: 'Central Time (Mexico)', region: 'Americas'},
    {value: 'America/Bogota', label: 'Colombia Time', region: 'Americas'},
    {value: 'America/Santiago', label: 'Chile Time', region: 'Americas'},

    // Europe
    {value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe'},
    {value: 'Europe/Paris', label: 'Central European Time', region: 'Europe'},
    {value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Rome', label: 'Rome (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)', region: 'Europe'},
    {value: 'Europe/Athens', label: 'Athens (EET/EEST)', region: 'Europe'},
    {value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)', region: 'Europe'},
    {value: 'Europe/Moscow', label: 'Moscow Time', region: 'Europe'},
    {value: 'Europe/Istanbul', label: 'Istanbul (TRT)', region: 'Europe'},

    // Middle East & Africa
    {value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Middle East & Africa'},
    {value: 'Asia/Riyadh', label: 'Riyadh (AST)', region: 'Middle East & Africa'},
    {value: 'Asia/Tehran', label: 'Tehran (IRST)', region: 'Middle East & Africa'},
    {value: 'Asia/Jerusalem', label: 'Jerusalem (IST)', region: 'Middle East & Africa'},
    {value: 'Africa/Cairo', label: 'Cairo (EET)', region: 'Middle East & Africa'},
    {value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', region: 'Middle East & Africa'},
    {value: 'Africa/Lagos', label: 'Lagos (WAT)', region: 'Middle East & Africa'},

    // Asia
    {value: 'Asia/Kolkata', label: 'India Standard Time', region: 'Asia'},
    {value: 'Asia/Dhaka', label: 'Bangladesh Time', region: 'Asia'},
    {value: 'Asia/Bangkok', label: 'Indochina Time', region: 'Asia'},
    {value: 'Asia/Jakarta', label: 'Western Indonesia Time', region: 'Asia'},
    {value: 'Asia/Shanghai', label: 'China Standard Time', region: 'Asia'},
    {value: 'Asia/Hong_Kong', label: 'Hong Kong Time', region: 'Asia'},
    {value: 'Asia/Taipei', label: 'Taipei Time', region: 'Asia'},
    {value: 'Asia/Tokyo', label: 'Japan Standard Time', region: 'Asia'},
    {value: 'Asia/Seoul', label: 'Korea Standard Time', region: 'Asia'},
    {value: 'Asia/Singapore', label: 'Singapore Time', region: 'Asia'},
    {value: 'Asia/Manila', label: 'Philippine Time', region: 'Asia'},

    // Oceania
    {value: 'Australia/Sydney', label: 'Australian Eastern Time', region: 'Oceania'},
    {value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', region: 'Oceania'},
    {value: 'Australia/Brisbane', label: 'Brisbane (AEST)', region: 'Oceania'},
    {value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)', region: 'Oceania'},
    {value: 'Australia/Perth', label: 'Australian Western Time', region: 'Oceania'},
    {value: 'Pacific/Auckland', label: 'New Zealand Time', region: 'Oceania'},
    {value: 'Pacific/Fiji', label: 'Fiji Time', region: 'Oceania'},
] as const

export type TimezoneValue = typeof TIMEZONES[number]['value']
export type TimezoneRegion = typeof TIMEZONES[number]['region']

export const TIMEZONE_REGIONS = [...new Set(TIMEZONES.map(tz => tz.region))] as const

export function getTimezoneLabel(value: string): string {
    const tz = TIMEZONES.find(t => t.value === value)
    return tz ? `${tz.label} (${tz.value})` : value
}

export function getTimezonesByRegion() {
    const grouped: Record<string, typeof TIMEZONES[number][]> = {}
    for (const tz of TIMEZONES) {
        if (!grouped[tz.region]) grouped[tz.region] = []
        grouped[tz.region].push(tz)
    }
    return grouped
}
