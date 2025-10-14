export type IdPrefix = string | number | undefined;

const randomFromCrypto = () => {
    const cryptoObject = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

    if (cryptoObject) {
        if (typeof cryptoObject.randomUUID === 'function') {
            try {
                return cryptoObject.randomUUID();
            } catch (error) {
                // Ignore and fall back to manual generation
            }
        }

        if (typeof cryptoObject.getRandomValues === 'function') {
            try {
                const buffer = new Uint32Array(4);
                cryptoObject.getRandomValues(buffer);
                return Array.from(buffer, value => value.toString(16).padStart(8, '0')).join('');
            } catch (error) {
                // Ignore and fall through to Math.random
            }
        }
    }

    return undefined;
};

const randomFromMath = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/**
 * Generates a reasonably unique identifier. Prefers the Web Crypto randomUUID API,
 * falls back to getRandomValues, and finally to a timestamp/Math.random combo.
 */
export const generateId = (prefix?: IdPrefix) => {
    const unique = randomFromCrypto() ?? randomFromMath();
    return prefix !== undefined && prefix !== '' ? `${prefix}-${unique}` : unique;
};

export const generateSeed = (prefix?: IdPrefix) => {
    const id = generateId(prefix);
    return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || randomFromMath();
};

export default generateId;
