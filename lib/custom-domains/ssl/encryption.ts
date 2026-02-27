import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 12  // NIST-recommended for GCM
const SEPARATOR = ':'

function getKey(): Buffer {
    const raw = process.env.ENCRYPTION_KEY
    if (!raw) throw new Error('ENCRYPTION_KEY is not set')
    const key = Buffer.from(raw, 'base64')
    if (key.length !== 32) {
        throw new Error(`ENCRYPTION_KEY must be 32 bytes (got ${key.length})`)
    }
    return key
}

// Returns "iv_b64:authTag_b64:ciphertext_b64"
export function encrypt(plaintext: string): string {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ])

    return [
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        encrypted.toString('base64'),
    ].join(SEPARATOR)
}

// Throws on auth tag mismatch — ciphertext has been tampered with
export function decrypt(data: string): string {
    const key = getKey()
    const parts = data.split(SEPARATOR)

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
    }

    const [ivB64, tagB64, ctB64] = parts
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(ivB64, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))

    return Buffer.concat([
        decipher.update(Buffer.from(ctB64, 'base64')),
        decipher.final(),
    ]).toString('utf8')
}