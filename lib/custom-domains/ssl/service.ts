import * as acme from 'acme-client'
import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/custom-domains/ssl/encryption'
import { getAcmeClient } from '@/lib/custom-domains/ssl/acme-account'
import { assertNotInternal } from '@/lib/custom-domains/ssl/ssrf-guard'
import { notifyAgent } from '@/lib/custom-domains/ssl/webhook'
import type { DomainCertificate } from '@prisma/client'

// ─── Sandbox Mode ─────────────────────────────────────────────────────────────
// When ACME_SANDBOX_MODE=true, simulate the entire SSL flow without real certs.
// This allows testing the challenge flow, database updates, and nginx-agent
// webhooks without hitting Let's Encrypt rate limits.

function isSandboxMode(): boolean {
    return process.env.ACME_SANDBOX_MODE === 'true'
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
// In-memory per-registered-domain counter. Move to Redis for multi-instance.

const recentIssuances = new Map<string, number[]>()
const MAX_PER_WEEK = 45  // LE hard limit is 50, stay under it
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function getRegisteredDomain(hostname: string): string {
    // TODO: replace with tldts or publicsuffix.js for accuracy
    return hostname.split('.').slice(-2).join('.')
}

function checkRateLimit(hostname: string): void {
    const root = getRegisteredDomain(hostname)
    const now = Date.now()
    const timestamps = (recentIssuances.get(root) ?? []).filter(
        t => now - t < ONE_WEEK_MS,
    )
    if (timestamps.length >= MAX_PER_WEEK) {
        throw new Error(
            `Too many certificate issuances for ${root} this week (${timestamps.length}/${MAX_PER_WEEK})`,
        )
    }
    timestamps.push(now)
    recentIssuances.set(root, timestamps)
}

// ─── HTTP-01 ──────────────────────────────────────────────────────────────────

// Kicks off HTTP-01 issuance and returns immediately with the cert record ID.
// Completion happens asynchronously — poll /api/acme/status/[certId].
export async function initiateHttp01Certificate(
    domainId: string,
    hostname: string,
): Promise<string> {
    await assertNotInternal(hostname)

    if (isSandboxMode()) {
        return await initiateSandboxHttp01Certificate(domainId, hostname)
    }

    checkRateLimit(hostname)

    const client = await getAcmeClient()

    const order = await client.createOrder({
        identifiers: [{ type: 'dns', value: hostname }],
    })

    const authorizations = await client.getAuthorizations(order)
    const authz = authorizations[0]
    const challenge = authz.challenges.find(c => c.type === 'http-01')

    if (!challenge) {
        throw new Error(
            'HTTP-01 challenge not available for this domain. Try DNS-01 instead.',
        )
    }

    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge)
    const [certKeyBuffer, csrBuffer] = await acme.crypto.createCsr({
        altNames: [hostname],
    })

    const cert = await db.domainCertificate.create({
        data: {
            domainId,
            status: 'PENDING_HTTP01',
            challengeType: 'HTTP01',
            privateKeyPem: encrypt(certKeyBuffer.toString()),
            csrPem: csrBuffer.toString(),
            acmeOrderUrl: order.url,
            challengeToken: challenge.token,
            challengeKeyAuth: keyAuthorization,
        },
    })

    void completeHttp01Challenge(cert.id, client, authz, challenge, csrBuffer)
        .catch(err => markFailed(cert.id, err))

    return cert.id
}

// Sandbox version of HTTP-01 - simulates the flow without real ACME calls
async function initiateSandboxHttp01Certificate(
    domainId: string,
    hostname: string,
): Promise<string> {
    // Generate dummy keys and CSR for sandbox
    const [certKeyBuffer, csrBuffer] = await acme.crypto.createCsr({
        altNames: [hostname],
    })

    const cert = await db.domainCertificate.create({
        data: {
            domainId,
            status: 'PENDING_HTTP01',
            challengeType: 'HTTP01',
            privateKeyPem: encrypt(certKeyBuffer.toString()),
            csrPem: csrBuffer.toString(),
            challengeToken: `sandbox_token_${Date.now()}`,
            challengeKeyAuth: `sandbox_keyauth_${Date.now()}`,
        },
    })

    // Simulate async completion after 3 seconds
    void completeSandboxHttp01Challenge(cert.id, hostname, certKeyBuffer.toString())
        .catch(err => markFailed(cert.id, err))

    return cert.id
}

async function completeSandboxHttp01Challenge(
    certId: string,
    hostname: string,
    privateKey: string,
): Promise<void> {
    // Wait 3 seconds to simulate ACME validation
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Generate fake certificate PEM
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days

    const fakeCert = `-----BEGIN CERTIFICATE-----
SANDBOX CERTIFICATE FOR ${hostname}
This is a fake certificate generated in sandbox mode.
Issued: ${now.toISOString()}
Expires: ${expiresAt.toISOString()}
-----END CERTIFICATE-----`

    await db.domainCertificate.update({
        where: { id: certId },
        data: {
            status: 'ISSUED',
            certificatePem: fakeCert,
            fullChainPem: fakeCert,
            issuedAt: now,
            expiresAt: expiresAt,
            challengeToken: null,
            challengeKeyAuth: null,
        },
    })

    const cert = await db.domainCertificate.findUnique({
        where: { id: certId },
    })

    if (!cert) throw new Error('Certificate not found')

    const domain = await db.customDomain.update({
        where: { id: cert.domainId },
        data: { sslMode: 'LETS_ENCRYPT' },
    })

    // Notify nginx-agent about the new certificate (agent will handle sandbox mode)
    await notifyAgent({
        event: 'cert.issued',
        domain: domain.domain,
        certId: certId,
    })
}

async function completeHttp01Challenge(
    certId: string,
    client: acme.Client,
    authz: acme.Authorization,
    challenge: any,
    csr: Buffer,
): Promise<void> {
    await client.completeChallenge(challenge)
    await client.waitForValidStatus(challenge)

    const cert = await db.domainCertificate.findUnique({ where: { id: certId } })
    if (!cert?.acmeOrderUrl) throw new Error('Order URL missing from DB')

    const currentOrder = await (client as any).getOrder(cert.acmeOrderUrl)
    await client.finalizeOrder(currentOrder, csr)
    const certificate = await client.getCertificate(currentOrder)
    const info = acme.crypto.readCertificateInfo(certificate)

    // ACME getCertificate returns the full chain (leaf + intermediates)
    // Split to get just the leaf cert
    const certs = certificate.split(/(?=-----BEGIN CERTIFICATE-----)/g).filter(Boolean)
    const leafCert = certs[0] || certificate
    const fullChain = certificate

    console.log(`[ssl] HTTP-01 cert issued - leaf: ${leafCert.length}b, chain: ${fullChain.length}b`)

    await db.domainCertificate.update({
        where: { id: certId },
        data: {
            status: 'ISSUED',
            certificatePem: leafCert,
            fullChainPem: fullChain,
            issuedAt: new Date(),
            expiresAt: info.notAfter,
            acmeOrderUrl: null,
            challengeToken: null,
            challengeKeyAuth: null,
        },
    })

    const domain = await db.customDomain.update({
        where: { id: cert.domainId },
        data: { sslMode: 'LETS_ENCRYPT' },
    })

    // Notify nginx-agent about the new certificate
    await notifyAgent({
        event: 'cert.issued',
        domain: domain.domain,
        certId: certId,
    })
}

// ─── DNS-01 ───────────────────────────────────────────────────────────────────

export interface Dns01ChallengeInfo {
    certId: string
    txtName: string   // _acme-challenge.{hostname}
    txtValue: string  // base64url(SHA-256(keyAuth)) — the TXT record value
}

// Returns the TXT record the user must create.
// After they add it, call completeDns01Certificate(certId).
export async function initiateDns01Certificate(
    domainId: string,
    hostname: string,
): Promise<Dns01ChallengeInfo> {
    if (isSandboxMode()) {
        return await initiateSandboxDns01Certificate(domainId, hostname)
    }

    checkRateLimit(hostname)

    const client = await getAcmeClient()

    const order = await client.createOrder({
        identifiers: [{ type: 'dns', value: hostname }],
    })

    const authorizations = await client.getAuthorizations(order)
    const authz = authorizations[0]
    const challenge = authz.challenges.find(c => c.type === 'dns-01')

    if (!challenge) {
        throw new Error('DNS-01 challenge not available')
    }

    const dnsTxtValue = await client.getChallengeKeyAuthorization(challenge)

    const [certKeyBuffer, csrBuffer] = await acme.crypto.createCsr({
        altNames: [hostname],
    })

    const cert = await db.domainCertificate.create({
        data: {
            domainId,
            status: 'PENDING_DNS01',
            challengeType: 'DNS01',
            privateKeyPem: encrypt(certKeyBuffer.toString()),
            csrPem: csrBuffer.toString(),
            acmeOrderUrl: order.url,
            dnsTxtValue,
        },
    })

    return {
        certId: cert.id,
        txtName: `_acme-challenge.${hostname}`,
        txtValue: dnsTxtValue,
    }
}

// Sandbox version of DNS-01 - simulates the flow without real ACME calls
async function initiateSandboxDns01Certificate(
    domainId: string,
    hostname: string,
): Promise<Dns01ChallengeInfo> {
    const [certKeyBuffer, csrBuffer] = await acme.crypto.createCsr({
        altNames: [hostname],
    })

    const dnsTxtValue = `sandbox_dns_value_${Date.now()}`

    const cert = await db.domainCertificate.create({
        data: {
            domainId,
            status: 'PENDING_DNS01',
            challengeType: 'DNS01',
            privateKeyPem: encrypt(certKeyBuffer.toString()),
            csrPem: csrBuffer.toString(),
            dnsTxtValue,
        },
    })

    return {
        certId: cert.id,
        txtName: `_acme-challenge.${hostname}`,
        txtValue: dnsTxtValue,
    }
}

async function completeSandboxDns01Certificate(certId: string): Promise<void> {
    const cert = await db.domainCertificate.findUnique({
        where: { id: certId },
        include: { domain: true },
    })

    if (!cert) throw new Error('Certificate record not found')
    if (cert.status !== 'PENDING_DNS01') {
        throw new Error(`Certificate is in unexpected state: ${cert.status}`)
    }

    // Simulate 2 second DNS validation delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days

    const fakeCert = `-----BEGIN CERTIFICATE-----
SANDBOX CERTIFICATE FOR ${cert.domain.domain}
This is a fake certificate generated in sandbox mode (DNS-01).
Issued: ${now.toISOString()}
Expires: ${expiresAt.toISOString()}
-----END CERTIFICATE-----`

    await db.domainCertificate.update({
        where: { id: certId },
        data: {
            status: 'ISSUED',
            certificatePem: fakeCert,
            fullChainPem: fakeCert,
            issuedAt: now,
            expiresAt: expiresAt,
            dnsTxtValue: null,
        },
    })

    const domain = await db.customDomain.update({
        where: { id: cert.domainId },
        data: { sslMode: 'LETS_ENCRYPT' },
    })

    // Notify nginx-agent about the new certificate (agent will handle sandbox mode)
    await notifyAgent({
        event: 'cert.issued',
        domain: domain.domain,
        certId: certId,
    })
}

// Called after the user has added the DNS TXT record.
export async function completeDns01Certificate(certId: string): Promise<void> {
    if (isSandboxMode()) {
        return await completeSandboxDns01Certificate(certId)
    }
    const cert = await db.domainCertificate.findUnique({
        where: { id: certId },
        include: { domain: true },
    })

    if (!cert) throw new Error('Certificate record not found')
    if (cert.status !== 'PENDING_DNS01') {
        throw new Error(`Certificate is in unexpected state: ${cert.status}`)
    }

    const client = await getAcmeClient()
    const hostname = cert.domain.domain

    const order = await client.createOrder({
        identifiers: [{ type: 'dns', value: hostname }],
    })

    const authorizations = await client.getAuthorizations(order)
    const challenge = authorizations[0].challenges.find(c => c.type === 'dns-01')

    if (!challenge) throw new Error('DNS-01 challenge not found')

    try {
        await client.verifyChallenge(authorizations[0], challenge)
    } catch {
        throw new Error(
            'TXT record not found or not propagated yet — wait a few minutes and try again.',
        )
    }

    await client.completeChallenge(challenge)
    await client.waitForValidStatus(challenge)

    const csr = Buffer.from(cert.csrPem)
    await client.finalizeOrder(order, csr)
    const certificate = await client.getCertificate(order)
    const info = acme.crypto.readCertificateInfo(certificate)

    // ACME getCertificate returns the full chain (leaf + intermediates)
    // Split to get just the leaf cert
    const certs = certificate.split(/(?=-----BEGIN CERTIFICATE-----)/g).filter(Boolean)
    const leafCert = certs[0] || certificate
    const fullChain = certificate

    console.log(`[ssl] DNS-01 cert issued - leaf: ${leafCert.length}b, chain: ${fullChain.length}b`)

    await db.domainCertificate.update({
        where: { id: certId },
        data: {
            status: 'ISSUED',
            certificatePem: leafCert,
            fullChainPem: fullChain,
            issuedAt: new Date(),
            expiresAt: info.notAfter,
            acmeOrderUrl: null,
            dnsTxtValue: null,
        },
    })

    const domain = await db.customDomain.update({
        where: { id: cert.domainId },
        data: { sslMode: 'LETS_ENCRYPT' },
    })

    // Notify nginx-agent about the new certificate
    await notifyAgent({
        event: 'cert.issued',
        domain: domain.domain,
        certId: certId,
    })
}

// ─── Cert bundle retrieval ────────────────────────────────────────────────────

export interface CertBundle {
    privateKey:  string  // decrypted PEM
    certificate: string  // PEM
    fullChain:   string  // PEM
    expiresAt:   Date
}

export async function getActiveCertBundle(
    hostname: string,
): Promise<CertBundle | null> {
    const domain = await db.customDomain.findUnique({
        where: { domain: hostname },
    })

    if (!domain || domain.sslMode !== 'LETS_ENCRYPT') return null

    const cert = await db.domainCertificate.findFirst({
        where: {
            domainId: domain.id,
            status: 'ISSUED',
            certificatePem: { not: null },
        },
        orderBy: { issuedAt: 'desc' },
    })

    if (!cert?.certificatePem || !cert.fullChainPem || !cert.expiresAt) {
        return null
    }

    return {
        privateKey:  decrypt(cert.privateKeyPem),
        certificate: cert.certificatePem,
        fullChain:   cert.fullChainPem,
        expiresAt:   cert.expiresAt,
    }
}

// ─── Renewal ──────────────────────────────────────────────────────────────────

export async function renewCertificate(cert: DomainCertificate & {
    domain: { domain: string; id: string }
}): Promise<void> {
    const hostname = cert.domain.domain

    if (cert.challengeType === 'HTTP01') {
        const newCertId = await initiateHttp01Certificate(cert.domainId, hostname)

        // Note: notifyAgent will be called when the new certificate is issued
        // in the completeHttp01Challenge function
    } else {
        // DNS-01 can't renew automatically — notify the user instead
        // TODO: send notification email to domain owner
        await db.domainCertificate.update({
            where: { id: cert.id },
            data: {
                lastError: 'DNS-01 certificate requires manual renewal via domain settings.',
            },
        })
    }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function markFailed(certId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await db.domainCertificate.update({
        where: { id: certId },
        data: {
            status: 'FAILED',
            lastError: message,
            renewalAttempts: { increment: 1 },
        },
    }).catch(() => {})
}