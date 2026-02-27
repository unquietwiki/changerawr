export interface CustomDomain {
    id: string
    domain: string
    projectId: string
    verificationToken: string
    verified: boolean
    createdAt: Date
    verifiedAt: Date | null
    userId: string | null
    forceHttps: boolean
    sslMode: 'NONE' | 'LETS_ENCRYPT' | 'EXTERNAL'
    dnsInstructions?: DNSInstructions
    certificates?: DomainCertificate[]
    browserRules?: DomainBrowserRule[]
    throttleConfig?: DomainThrottleConfig | null
}

export interface DomainCertificate {
    id: string
    domainId: string
    status: 'PENDING_HTTP01' | 'PENDING_DNS01' | 'ISSUED' | 'EXPIRED' | 'FAILED' | 'REVOKED'
    challengeType: 'HTTP01' | 'DNS01'
    privateKeyPem: string // Required - encrypted private key
    certificatePem: string | null
    fullChainPem: string | null
    csrPem: string // Required - Certificate Signing Request
    acmeOrderUrl: string | null
    challengeToken: string | null
    challengeKeyAuth: string | null
    dnsTxtValue: string | null
    issuedAt: Date | null
    expiresAt: Date | null
    lastError: string | null
    renewalAttempts: number
    createdAt: Date
    updatedAt: Date
}

export interface DomainBrowserRule {
    id: string
    domainId: string
    userAgentPattern: string
    ruleType: 'BLOCK' | 'ALLOW'
    isEnabled: boolean
    createdAt: Date
    updatedAt: Date
}

export interface DomainThrottleConfig {
    id: string
    domainId: string
    enabled: boolean
    requestsPerSecond: number
    burstSize: number
    createdAt: Date
    updatedAt: Date
}

export interface DNSVerificationResult {
    cnameValid: boolean
    txtValid: boolean
    cnameTarget?: string
    txtRecord?: string
    errors?: string[]
}

export interface DNSInstructions {
    cname: {
        name: string
        value: string
        description: string
    }
    txt: {
        name: string
        value: string
        description: string
    }
}

export interface AddDomainRequest {
    domain: string
    projectId: string
    userId?: string
}

export interface AddDomainResponse {
    success: boolean
    domain?: {
        id: string
        domain: string
        projectId: string
        verificationToken: string
        dnsInstructions: DNSInstructions
    }
    error?: string
}

export interface VerifyDomainRequest {
    domain: string
}

export interface VerifyDomainResponse {
    success: boolean
    verification?: DNSVerificationResult & {
        verified: boolean
    }
    error?: string
}

export interface ListDomainsResponse {
    success: boolean
    domains?: CustomDomain[]
    error?: string
}

export interface DeleteDomainResponse {
    success: boolean
    error?: string
}