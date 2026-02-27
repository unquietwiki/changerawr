import crypto from 'crypto'

type AgentEvent =
    | { event: 'cert.issued';    domain: string; certId: string; mode?: 'live' | 'sandbox' }
    | { event: 'cert.renewed';   domain: string; certId: string; mode?: 'live' | 'sandbox' }
    | { event: 'cert.revoked';   domain: string }
    | { event: 'domain.added';   domain: string }
    | { event: 'domain.removed'; domain: string }

function sign(body: string, secret: string): string {
    return 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')
}

// No-op if NGINX_AGENT_URL is not set. Never throws.
export async function notifyAgent(event: AgentEvent): Promise<void> {
    const agentUrl = process.env.NGINX_AGENT_URL
    const agentSecret = process.env.NGINX_AGENT_SECRET

    if (!agentUrl || !agentSecret) return

    // Add mode field for cert.issued and cert.renewed events
    const isSandbox = process.env.ACME_SANDBOX_MODE === 'true'
    const enrichedEvent = (event.event === 'cert.issued' || event.event === 'cert.renewed')
        ? { ...event, mode: isSandbox ? 'sandbox' as const : 'live' as const }
        : event

    const body = JSON.stringify(enrichedEvent)

    try {
        const res = await fetch(`${agentUrl}/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Chr-Signature': sign(body, agentSecret),
            },
            body,
            signal: AbortSignal.timeout(8_000),
        })

        if (!res.ok) {
            const text = await res.text().catch(() => '?')
            console.warn(`[ssl/webhook] agent returned ${res.status}: ${text}`)
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[ssl/webhook] ${message}`)
    }
}