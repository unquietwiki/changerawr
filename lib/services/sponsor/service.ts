import {db} from '@/lib/db'
import {encryptToken, decryptToken} from '@/lib/utils/encryption'
import crypto from 'crypto'

const _ep = [104, 116, 116, 112, 115, 58, 47, 47, 100, 108, 46, 115, 117, 112, 101, 114, 115, 48, 102, 116, 46, 117, 115, 47, 99, 104, 97, 110, 103, 101, 114, 97, 119, 114, 47, 115, 112, 111, 110, 115, 111, 114];
const _base = String.fromCharCode(..._ep);
const _t = 10000;
const _ri = 864e5;
const _product = 'changerawr';

const _pk = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxfi0IKoAejLgQ2jsUg5X
zmLAdHse9nPVs8DPn3dA/bl+KfOpH+XELcxStrPCHIL3RN/yooqF1+sWrWoyvs9X
1kKiByDfTCX4mPz99LFBIbpv0PAhXs9ViQR4KSZraF/OnGPfJP2gf/FSvAnigA8N
biezAhxWqpSbAPkOwX+058XhIRWdfY5qvSHWOrP2AYf7FLA4DQM4ls8omN5hjzCp
ZY7sXWknevl+D9krp0gXnyuB78QQCc7+HXWGz93K1E1l+zcZjqtkQmwUACGLAd+k
EQ7WGgGB98ZOOcLZu4krQs8Z/7noCLbz+jf/gKzCWLO+frm2yfxEc4vssqBSIeB9
NwIDAQAB
-----END PUBLIC KEY-----`;

interface _VR {
    valid: boolean;
    features: string[];
    proof?: string;
    payload?: string
}

interface _AR {
    success: boolean;
    message?: string;
    features?: string[];
    proof?: string;
    payload?: string
}

function _vSig(payload: string, signature: string): boolean {
    try {
        const v = crypto.createVerify('SHA256');
        v.update(payload);
        return v.verify(_pk, signature, 'base64');
    } catch {
        return false;
    }
}

function _vPayload(raw: string, instanceId: string): { valid: boolean; features: string[] } {
    try {
        const d = JSON.parse(raw);
        if (d.p !== _product) return {valid: false, features: []};
        if (d.i !== instanceId) return {valid: false, features: []};
        if (typeof d.v !== 'boolean') return {valid: false, features: []};
        const age = Math.floor(Date.now() / 1000) - (d.t || 0);
        if (age > 604800) return {valid: false, features: []};
        return {valid: d.v === true, features: Array.isArray(d.f) ? d.f : []};
    } catch {
        return {valid: false, features: []};
    }
}

async function _fetch(path: string, opts: RequestInit): Promise<Response> {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), _t);
    try {
        const r = await fetch(`${_base}${path}`, {...opts, signal: c.signal});
        clearTimeout(t);
        return r;
    } catch (e) {
        clearTimeout(t);
        throw e;
    }
}

export class SponsorService {

    static async verifyLicense(licenseKey: string, instanceId: string): Promise<_VR> {
        try {
            const r = await _fetch('/api/verify', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({license_key: licenseKey, instance_id: instanceId, product: _product}),
            });
            if (!r.ok) return {valid: false, features: []};
            const d = await r.json();
            if (typeof d !== 'object' || typeof d.valid !== 'boolean') return {valid: false, features: []};
            return {
                valid: d.valid === true,
                features: Array.isArray(d.features) ? d.features : [],
                proof: d.proof,
                payload: d.payload,
            };
        } catch {
            throw new Error('NETWORK_ERROR');
        }
    }

    static async activateLicense(licenseKey: string, instanceId: string, instanceName?: string): Promise<_AR> {
        try {
            const b: Record<string, string> = {license_key: licenseKey, instance_id: instanceId, product: _product};
            if (instanceName) b.instance_name = instanceName;
            const r = await _fetch('/api/activate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(b),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                return {success: false, message: e.error || 'Activation failed'};
            }
            return await r.json();
        } catch {
            return {
                success: false,
                message: 'Unable to reach the licensing server. If you have a firewall, please allow connections to dl.supers0ft.us',
            };
        }
    }

    static async requestChallenge(licenseKey: string, instanceId: string): Promise<{challenge_id: string, challenge_code: string, expires_in: number}> {
        try {
            const r = await _fetch('/api/activate/challenge', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({license_key: licenseKey, instance_id: instanceId}),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                throw new Error(e.error || 'Challenge request failed');
            }
            return await r.json();
        } catch (e) {
            if (e instanceof Error && e.message !== 'Challenge request failed') {
                throw new Error('Unable to reach the licensing server. If you have a firewall, please allow connections to dl.supers0ft.us');
            }
            throw e;
        }
    }

    static async confirmChallenge(challengeId: string, responseCode: string, instanceName?: string): Promise<_AR> {
        try {
            const b: Record<string, string> = {challenge_id: challengeId, response_code: responseCode, product: _product};
            if (instanceName) b.instance_name = instanceName;
            const r = await _fetch('/api/activate/confirm', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(b),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                return {success: false, message: e.error || 'Confirmation failed'};
            }
            return await r.json();
        } catch {
            return {
                success: false,
                message: 'Unable to reach the licensing server. If you have a firewall, please allow connections to dl.supers0ft.us',
            };
        }
    }

    static async deactivateLicense(licenseKey: string, instanceId: string): Promise<void> {
        try {
            await _fetch('/api/deactivate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({license_key: licenseKey, instance_id: instanceId, product: _product}),
            });
        } catch {
        }
    }

    static async getLicenseStatus(): Promise<{ active: boolean, features: string[] }> {
        try {
            const config = await db.systemConfig.findFirst({
                select: {
                    sponsorLicenseValid: true,
                    sponsorLastVerified: true,
                    sponsorProof: true,
                    sponsorPayload: true,
                    sponsorLicenseKey: true,
                    telemetryInstanceId: true,
                },
            });
            if (!config) return {active: false, features: []};
            if (!config.sponsorLicenseValid) return {active: false, features: []};
            if (!config.sponsorProof || !config.sponsorPayload || !config.sponsorLastVerified) {
                await SponsorService._rs();
                return {active: false, features: []};
            }

            const rawPayload = Buffer.from(config.sponsorPayload, 'base64').toString('utf-8');
            if (!_vSig(rawPayload, config.sponsorProof)) {
                await SponsorService._rs();
                return {active: false, features: []};
            }

            const instanceId = config.telemetryInstanceId || '';
            const parsed = _vPayload(rawPayload, instanceId);
            if (!parsed.valid) {
                await SponsorService._rs();
                return {active: false, features: []};
            }

            const elapsed = Date.now() - new Date(config.sponsorLastVerified).getTime();
            if (elapsed > _ri) {
                SponsorService._bgr().catch(() => {
                });
            }

            return {active: true, features: parsed.features};
        } catch {
            return {active: false, features: []};
        }
    }

    static getEffectiveMaxEntries(configMax: number, isLicensed: boolean): number {
        return isLicensed ? Number.MAX_SAFE_INTEGER : configMax;
    }

    static async storeLicenseActivation(
        licenseKey: string, valid: boolean, proof?: string, payload?: string
    ): Promise<void> {
        const encrypted = encryptToken(licenseKey);
        await db.systemConfig.updateMany({
            data: {
                sponsorLicenseKey: encrypted,
                sponsorLicenseValid: valid,
                sponsorLastVerified: new Date(),
                sponsorProof: proof || null,
                sponsorPayload: payload || null,
            },
        });
    }

    static async clearLicenseState(): Promise<void> {
        await db.systemConfig.updateMany({
            data: {
                sponsorLicenseKey: null,
                sponsorLicenseValid: false,
                sponsorLastVerified: null,
                sponsorProof: null,
                sponsorPayload: null,
            },
        });
    }

    static async getStoredLicenseKey(): Promise<string | null> {
        const c = await db.systemConfig.findFirst({select: {sponsorLicenseKey: true}});
        if (!c?.sponsorLicenseKey) return null;
        try {
            return decryptToken(c.sponsorLicenseKey);
        } catch {
            return null;
        }
    }

    static async getInstanceId(): Promise<string | null> {
        const c = await db.systemConfig.findFirst({select: {telemetryInstanceId: true}});
        return c?.telemetryInstanceId ?? null;
    }

    static async checkEntryAllowed(projectId: string): Promise<boolean> {
        const config = await db.systemConfig.findFirst({
            select: {
                maxChangelogEntriesPerProject: true,
                sponsorLicenseValid: true,
                sponsorProof: true,
                sponsorPayload: true,
                sponsorLastVerified: true,
                telemetryInstanceId: true,
            },
        });
        if (!config) return true;

        const changelog = await db.changelog.findUnique({
            where: {projectId},
            select: {_count: {select: {entries: true}}},
        });
        const count = changelog?._count?.entries || 0;

        let ceiling = config.maxChangelogEntriesPerProject;
        if (config.sponsorLicenseValid && config.sponsorProof && config.sponsorPayload && config.sponsorLastVerified) {
            const raw = Buffer.from(config.sponsorPayload, 'base64').toString('utf-8');
            if (_vSig(raw, config.sponsorProof)) {
                const p = _vPayload(raw, config.telemetryInstanceId || '');
                if (p.valid) ceiling = Number.MAX_SAFE_INTEGER;
            }
        }

        return count < ceiling;
    }

    static async needsReverification(): Promise<boolean> {
        const c = await db.systemConfig.findFirst({
            select: {sponsorLastVerified: true, sponsorLicenseValid: true},
        });
        if (!c?.sponsorLicenseValid || !c?.sponsorLastVerified) return false;
        return Date.now() - new Date(c.sponsorLastVerified).getTime() > _ri;
    }

    static async _bgr(): Promise<void> {
        const k = await SponsorService.getStoredLicenseKey();
        const i = await SponsorService.getInstanceId();
        if (!k || !i) return;
        try {
            const r = await SponsorService.verifyLicense(k, i);
            await SponsorService.storeLicenseActivation(k, r.valid, r.proof, r.payload);
        } catch {
        }
    }

    private static async _rs(): Promise<void> {
        await db.systemConfig.updateMany({
            data: {
                sponsorLicenseValid: false,
                sponsorLastVerified: null,
                sponsorProof: null,
                sponsorPayload: null,
            },
        });
    }
}
