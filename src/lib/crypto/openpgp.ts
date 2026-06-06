/**
 * OpenPGP Encryption/Decryption Library
 * Sprint 13: Secure Email E2E Encryption
 * 
 * SECURITY CRITICAL:
 * - All functions MUST work with ciphertext only
 * - NEVER log plaintext, passphrases, or private keys
 * - Passphrase is required for every decrypt (no caching)
 * - Server NEVER has access to plaintext
 */

import { logError } from '@/lib/log';

import * as openpgp from 'openpgp';

/**
 * Generate a new PGP key pair
 * @param name - User's name for key identity
 * @param email - User's email for key identity
 * @param passphrase - Strong passphrase to encrypt private key
 * @returns Public key, encrypted private key, and KDF parameters
 */
export async function generateKeypair(
  name: string,
  email: string,
  passphrase: string
): Promise<{
  publicKey: string;
  privateKey: string;
  kdf: {
    algorithm: string;
    iterations: number;
    hashAlgorithm: string;
  };
}> {
  try {
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'rsa',
      rsaBits: 4096,
      userIDs: [{ name, email }],
      passphrase,
      format: 'armored',
    });

    // KDF parameters for documentation (OpenPGP.js handles this internally)
    const kdf = {
      algorithm: 'Iterated and Salted S2K',
      iterations: 65536,
      hashAlgorithm: 'SHA256',
    };

    return {
      publicKey,
      privateKey,
      kdf,
    };
  } catch (error) {
    logError('OpenPGP', { component: 'crypto.openpgp.generateKey', message: 'Failed to generate PGP key pair', error: error instanceof Error ? error.message : String(error) });
    throw new Error('Key generation failed');
  }
}

/**
 * Encrypt plaintext with recipient's public key
 * @param plaintext - Text to encrypt
 * @param recipientPublicKey - Recipient's PGP public key (armored)
 * @returns Armored ciphertext
 */
export async function encryptText(
  plaintext: string,
  recipientPublicKey: string
): Promise<string> {
  try {
    const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: plaintext }),
      encryptionKeys: publicKey,
    });

    return encrypted as string;
  } catch (error) {
    logError('OpenPGP', { component: 'crypto.openpgp.encryptText', message: 'Failed to encrypt text', error: error instanceof Error ? error.message : String(error) });
    throw new Error('Text encryption failed');
  }
}

/**
 * Decrypt ciphertext with user's private key
 * @param ciphertext - Armored ciphertext
 * @param privateKeyEncrypted - User's encrypted private key (armored)
 * @param passphrase - User's passphrase (NEVER cached)
 * @returns Decrypted plaintext
 */
export async function decryptText(
  ciphertext: string,
  privateKeyEncrypted: string,
  passphrase: string
): Promise<string> {
  try {
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyEncrypted }),
      passphrase,
    });

    const message = await openpgp.readMessage({
      armoredMessage: ciphertext,
    });

    const { data: decrypted } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
    });

    return decrypted as string;
  } catch (error) {
    logError('OpenPGP', { component: 'crypto.openpgp.decryptText', message: 'Failed to decrypt text', error: error instanceof Error ? error.message : String(error) });
    throw new Error('Text decryption failed - check passphrase');
  }
}

/**
 * Encrypt binary data (for attachments)
 * @param data - Uint8Array to encrypt
 * @param recipientPublicKey - Recipient's PGP public key (armored)
 * @returns Encrypted Uint8Array
 */
export async function encryptBytes(
  data: Uint8Array,
  recipientPublicKey: string
): Promise<Uint8Array> {
  try {
    const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ binary: data }),
      encryptionKeys: publicKey,
      format: 'binary',
    });

    return encrypted as Uint8Array;
  } catch (error) {
    logError('OpenPGP', { component: 'crypto.openpgp.encryptBytes', message: 'Failed to encrypt bytes', error: error instanceof Error ? error.message : String(error) });
    throw new Error('Binary encryption failed');
  }
}

/**
 * Decrypt binary data (for attachments)
 * @param ciphertext - Encrypted Uint8Array
 * @param privateKeyEncrypted - User's encrypted private key (armored)
 * @param passphrase - User's passphrase (NEVER cached)
 * @returns Decrypted Uint8Array
 */
export async function decryptBytes(
  ciphertext: Uint8Array,
  privateKeyEncrypted: string,
  passphrase: string
): Promise<Uint8Array> {
  try {
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyEncrypted }),
      passphrase,
    });

    const message = await openpgp.readMessage({
      binaryMessage: ciphertext,
    });

    const { data: decrypted } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
      format: 'binary',
    });

    return decrypted as Uint8Array;
  } catch (error) {
    logError('OpenPGP', { component: 'crypto.openpgp.decryptBytes', message: 'Failed to decrypt bytes', error: error instanceof Error ? error.message : String(error) });
    throw new Error('Binary decryption failed - check passphrase');
  }
}

/**
 * Verify a public key is valid PGP format
 * @param publicKey - Armored public key
 * @returns true if valid, false otherwise
 */
export async function verifyPublicKey(publicKey: string): Promise<boolean> {
  try {
    await openpgp.readKey({ armoredKey: publicKey });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract email from public key
 * @param publicKey - Armored public key
 * @returns Email address or null
 */
export async function extractEmailFromKey(publicKey: string): Promise<string | null> {
  try {
    const key = await openpgp.readKey({ armoredKey: publicKey });
    const userId = key.getUserIDs()[0];
    const match = userId?.match(/<(.+)>/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
