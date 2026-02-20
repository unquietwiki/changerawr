import {NextResponse} from 'next/server'
import {validateAuthAndGetUser} from '@/lib/utils/changelog'
import {createAuditLog} from '@/lib/utils/auditLog'
import {SponsorService} from '@/lib/services/sponsor/service'

export async function GET() {
    try {
        const user = await validateAuthAndGetUser()
        if (user.role !== 'ADMIN') {
            return NextResponse.json({error: 'Not authorized'}, {status: 403})
        }

        // Always re-verify against the server when admin loads status
        const licenseKey = await SponsorService.getStoredLicenseKey()
        const instanceId = await SponsorService.getInstanceId()

        if (licenseKey && instanceId) {
            try {
                const fresh = await SponsorService.verifyLicense(licenseKey, instanceId)
                await SponsorService.storeLicenseActivation(
                    licenseKey, fresh.valid, fresh.proof, fresh.payload
                )
                return NextResponse.json({
                    active: fresh.valid,
                    features: fresh.features,
                })
            } catch {
                // Network error — deactivate and signal connection failure
                await SponsorService.clearLicenseState()
                return NextResponse.json({
                    active: false,
                    features: [],
                    connectionFailed: true,
                })
            }
        }

        const status = await SponsorService.getLicenseStatus()
        return NextResponse.json({
            active: status.active,
            features: status.features,
        })
    } catch (error) {
        console.error('Error fetching status:', error)
        return NextResponse.json({error: 'Failed to fetch status'}, {status: 500})
    }
}

export async function POST(request: Request) {
    try {
        const user = await validateAuthAndGetUser()
        if (user.role !== 'ADMIN') {
            return NextResponse.json({error: 'Not authorized'}, {status: 403})
        }

        const body = await request.json()
        const {licenseKey, instanceName, mode, challengeId, responseCode} = body

        const instanceId = await SponsorService.getInstanceId()
        if (!instanceId) {
            return NextResponse.json(
                {error: 'Telemetry must be enabled to activate a license. An instance ID is required.'},
                {status: 400}
            )
        }

        // Challenge-response mode: step 1 — request challenge
        if (mode === 'challenge') {
            if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith('chr_sp_')) {
                return NextResponse.json({error: 'Invalid license key'}, {status: 400})
            }
            try {
                const result = await SponsorService.requestChallenge(licenseKey, instanceId)
                return NextResponse.json(result)
            } catch (error) {
                return NextResponse.json(
                    {error: error instanceof Error ? error.message : 'Challenge request failed'},
                    {status: 400}
                )
            }
        }

        // Challenge-response mode: step 3 — confirm with response code
        if (mode === 'confirm') {
            if (!challengeId || !responseCode) {
                return NextResponse.json({error: 'Missing challenge_id or response_code'}, {status: 400})
            }
            const confirmResult = await SponsorService.confirmChallenge(challengeId, responseCode, instanceName)
            if (!confirmResult.success) {
                return NextResponse.json(
                    {error: confirmResult.message || 'Confirmation failed'},
                    {status: 400}
                )
            }

            // Store the activation using the license key from the challenge
            if (licenseKey) {
                await SponsorService.storeLicenseActivation(
                    licenseKey, true, confirmResult.proof, confirmResult.payload
                )
            }

            await createAuditLog('LICENSE_ACTIVATED', user.id, user.id, {
                mode: 'challenge'
            }).catch(() => {})

            return NextResponse.json({
                success: true,
                active: true,
                features: confirmResult.features || [],
            })
        }

        // Default: direct activation (backward compat)
        if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith('chr_sp_')) {
            return NextResponse.json({error: 'Invalid license key'}, {status: 400})
        }

        const activateResult = await SponsorService.activateLicense(licenseKey, instanceId, instanceName)
        if (!activateResult.success) {
            return NextResponse.json(
                {error: activateResult.message || 'Activation failed'},
                {status: 400}
            )
        }

        try {
            const verifyResult = await SponsorService.verifyLicense(licenseKey, instanceId)
            await SponsorService.storeLicenseActivation(
                licenseKey, verifyResult.valid, verifyResult.proof, verifyResult.payload
            )

            await createAuditLog('LICENSE_ACTIVATED', user.id, user.id, {
                valid: verifyResult.valid
            }).catch(() => {})

            return NextResponse.json({
                success: true,
                active: verifyResult.valid,
                features: verifyResult.features,
            })
        } catch (error) {
            if (error instanceof Error && error.message === 'NETWORK_ERROR') {
                return NextResponse.json({
                    success: false,
                    error: 'Could not verify. Please try again.',
                }, {status: 502})
            }
            throw error
        }
    } catch (error) {
        console.error('Error activating:', error)
        return NextResponse.json({error: 'Failed to activate'}, {status: 500})
    }
}

export async function DELETE() {
    try {
        const user = await validateAuthAndGetUser()
        if (user.role !== 'ADMIN') {
            return NextResponse.json({error: 'Not authorized'}, {status: 403})
        }

        const licenseKey = await SponsorService.getStoredLicenseKey()
        const instanceId = await SponsorService.getInstanceId()
        if (licenseKey && instanceId) {
            await SponsorService.deactivateLicense(licenseKey, instanceId)
        }
        await SponsorService.clearLicenseState()

        await createAuditLog('LICENSE_DEACTIVATED', user.id, user.id, {}).catch(() => {})
        return NextResponse.json({success: true})
    } catch (error) {
        console.error('Error deactivating:', error)
        return NextResponse.json({error: 'Failed to deactivate'}, {status: 500})
    }
}
