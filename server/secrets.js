const crypto = require('node:crypto');
const { logger } = require('./logger');

const SUPPORTED_VERSION = 'v1';
const DEFAULT_IV_LENGTH = 12;
let cachedKey = null;
let loggedMissingKey = false;

function resolveSecretKey() {
    if (cachedKey) {
        return cachedKey;
    }

    const rawSecret =
        process.env.FTP_PASSWORD_SECRET ||
        process.env.APP_ENCRYPTION_KEY ||
        process.env.APP_SECRET ||
        process.env.JWT_SECRET ||
        '';

    if (!rawSecret) {
        if (!loggedMissingKey) {
            logger.warn(
                {
                    category: 'security',
                    eventType: 'secrets.missing',
                },
                'FTP password secret not configured. Falling back to development default.'
            );
            loggedMissingKey = true;
        }
        cachedKey = crypto.createHash('sha256').update('webradio-development-secret').digest();
        return cachedKey;
    }

    cachedKey = crypto.createHash('sha256').update(rawSecret).digest();
    return cachedKey;
}

function isEncryptedSecret(value) {
    return typeof value === 'string' && value.startsWith(`${SUPPORTED_VERSION}:`);
}

function encryptSecret(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return '';
    }

    try {
        const key = resolveSecretKey();
        const iv = crypto.randomBytes(DEFAULT_IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const payload = [SUPPORTED_VERSION, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')];
        return payload.join(':');
    } catch (error) {
        logger.error({ err: error, category: 'security', eventType: 'secrets.encrypt' }, 'Failed to encrypt secret.');
        return '';
    }
}

function decryptSecret(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return '';
    }

    if (!isEncryptedSecret(value)) {
        return value;
    }

    try {
        const [version, ivB64, tagB64, dataB64] = value.split(':');
        if (version !== SUPPORTED_VERSION || !ivB64 || !tagB64 || !dataB64) {
            throw new Error('Unsupported encrypted payload format.');
        }
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const data = Buffer.from(dataB64, 'base64');
        const key = resolveSecretKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        logger.error({ err: error, category: 'security', eventType: 'secrets.decrypt' }, 'Failed to decrypt secret.');
        return '';
    }
}

module.exports = {
    encryptSecret,
    decryptSecret,
    isEncryptedSecret,
};
