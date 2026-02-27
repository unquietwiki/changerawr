import {db} from '@/lib/db'
import type {CustomDomain} from '@/lib/types/custom-domains'
import {validateDomain, validateProjectId, generateVerificationToken} from './validation'
import {DOMAIN_ERRORS, DOMAIN_CONSTANTS} from './constants'
import {notifyAgent} from './ssl/webhook'

export async function createCustomDomain(
    domain: string,
    projectId: string,
    userId?: string
): Promise<CustomDomain> {
    const cleanDomain = domain.toLowerCase().trim()

    // Validate domain format
    const domainValidation = validateDomain(cleanDomain)
    if (!domainValidation.valid) {
        throw new Error(domainValidation.error || DOMAIN_ERRORS.INVALID_FORMAT)
    }

    // Validate project ID
    if (!validateProjectId(projectId)) {
        throw new Error('Invalid project ID format')
    }

    // Check if project exists
    const project = await db.project.findUnique({
        where: {id: projectId}
    })

    if (!project) {
        throw new Error(DOMAIN_ERRORS.PROJECT_NOT_FOUND)
    }

    // Check if domain already exists
    const existingDomain = await db.customDomain.findUnique({
        where: {domain: cleanDomain}
    })

    if (existingDomain) {
        throw new Error(DOMAIN_ERRORS.ALREADY_EXISTS)
    }

    // Check domain limit per project
    const existingDomainsCount = await db.customDomain.count({
        where: {projectId}
    })

    if (existingDomainsCount >= DOMAIN_CONSTANTS.MAX_DOMAINS_PER_PROJECT) {
        throw new Error(DOMAIN_ERRORS.MAX_DOMAINS_EXCEEDED)
    }

    const verificationToken = generateVerificationToken()

    return db.customDomain.create({
        data: {
            domain: cleanDomain,
            projectId,
            verificationToken,
            userId
        },
        include: {
            project: true
        }
    })
}

export async function getDomainByDomain(domain: string): Promise<CustomDomain | null> {
    return db.customDomain.findUnique({
        where: {domain: domain.toLowerCase().trim()},
        include: {
            project: true,
            certificates: {
                orderBy: {createdAt: 'desc'},
                take: 5
            },
            browserRules: {
                orderBy: {createdAt: 'desc'}
            },
            throttleConfig: true
        }
    })
}

export async function getDomainsByProject(projectId: string): Promise<CustomDomain[]> {
    return db.customDomain.findMany({
        where: {projectId},
        include: {
            project: true,
            certificates: {
                orderBy: {createdAt: 'desc'},
                take: 5
            },
            browserRules: {
                orderBy: {createdAt: 'desc'}
            },
            throttleConfig: true
        },
        orderBy: {createdAt: 'desc'}
    })
}

export async function getDomainsByUser(userId: string): Promise<CustomDomain[]> {
    return db.customDomain.findMany({
        where: {userId},
        include: {
            project: true,
            certificates: {
                orderBy: {createdAt: 'desc'},
                take: 5
            },
            browserRules: {
                orderBy: {createdAt: 'desc'}
            },
            throttleConfig: true
        },
        orderBy: {createdAt: 'desc'}
    })
}

export async function getAllDomains(): Promise<CustomDomain[]> {
    return db.customDomain.findMany({
        include: {
            project: true,
            certificates: {
                orderBy: {createdAt: 'desc'},
                take: 5
            },
            browserRules: {
                orderBy: {createdAt: 'desc'}
            },
            throttleConfig: true
        },
        orderBy: {createdAt: 'desc'}
    })
}

export async function updateDomainVerification(
    domain: string,
    verified: boolean
): Promise<CustomDomain> {
    const cleanDomain = domain.toLowerCase().trim()

    const result = await db.customDomain.update({
        where: {domain: cleanDomain},
        data: {
            verified,
            verifiedAt: verified ? new Date() : null
        },
        include: {
            project: true
        }
    })

    // Notify nginx-agent when domain is verified
    if (verified) {
        await notifyAgent({
            event: 'domain.added',
            domain: cleanDomain,
        })
    }

    return result
}

export async function deleteDomain(domain: string): Promise<void> {
    const cleanDomain = domain.toLowerCase().trim()

    await db.customDomain.delete({
        where: {domain: cleanDomain}
    })

    // Notify nginx-agent that domain was removed
    await notifyAgent({
        event: 'domain.removed',
        domain: cleanDomain,
    })
}

export async function canUserManageDomain(
    domain: string,
    userId: string,
    isAdmin: boolean = false
): Promise<boolean> {
    if (isAdmin) return true

    const domainConfig = await getDomainByDomain(domain)
    if (!domainConfig) return false

    // Check if user owns the domain directly
    if (domainConfig.userId === userId) return true

    // Check if user owns the project (if you have project ownership in your schema)
    // Uncomment and adjust based on your Project model structure
    // if (domainConfig.project.userId === userId) return true

    return false
}