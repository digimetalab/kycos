/**
 * @fileoverview KYCOS Crypto — node-forge encryption helpers.
 * Provides AES-256-CBC encryption/decryption for sensitive data at rest.
 */

import forge from 'node-forge';
import { createLogger } from './logger.js';

const logger = createLogger('Crypto');

/** Cipher algorithm */
const ALGORITHM = 'AES-CBC';
/** IV length in bytes */
const IV_LENGTH = 16;
/** Key length in bytes (256-bit) */
const KEY_LENGTH = 32;

/**
 * Derive a 256-bit key from a passphrase using PBKDF2.
 * @param {string} passphrase - Encryption passphrase
 * @param {string} [salt='kycos-salt-v1'] - Salt for key derivation
 * @returns {string} Derived key bytes
 */
function deriveKey(passphrase, salt = 'kycos-salt-v1') {
  return forge.pkbdf2 ? forge.pkbdf2(passphrase, salt, 10000, KEY_LENGTH) :
    forge.util.hexToBytes(
      forge.md.sha256.create().update(passphrase + salt).digest().toHex().slice(0, KEY_LENGTH * 2)
    );
}

/**
 * Encrypt a string using AES-256-CBC.
 * @param {string} plaintext - Data to encrypt
 * @param {string} [passphrase] - Encryption key (defaults to KYCOS_ENCRYPTION_KEY env)
 * @returns {string} Base64-encoded ciphertext (IV + encrypted data)
 */
export function encrypt(plaintext, passphrase) {
  const key = passphrase || process.env.KYCOS_ENCRYPTION_KEY;
  if (!key) throw new Error('KYCOS_ENCRYPTION_KEY not set');

  const derivedKey = deriveKey(key);
  const iv = forge.random.getBytesSync(IV_LENGTH);

  const cipher = forge.cipher.createCipher(ALGORITHM, derivedKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(plaintext, 'utf8'));
  cipher.finish();

  // Prepend IV to ciphertext
  const result = iv + cipher.output.getBytes();
  return forge.util.encode64(result);
}

/**
 * Decrypt a string encrypted with encrypt().
 * @param {string} ciphertext - Base64-encoded ciphertext
 * @param {string} [passphrase] - Encryption key (defaults to KYCOS_ENCRYPTION_KEY env)
 * @returns {string} Decrypted plaintext
 */
export function decrypt(ciphertext, passphrase) {
  const key = passphrase || process.env.KYCOS_ENCRYPTION_KEY;
  if (!key) throw new Error('KYCOS_ENCRYPTION_KEY not set');

  const derivedKey = deriveKey(key);
  const raw = forge.util.decode64(ciphertext);

  const iv = raw.slice(0, IV_LENGTH);
  const encrypted = raw.slice(IV_LENGTH);

  const decipher = forge.cipher.createDecipher(ALGORITHM, derivedKey);
  decipher.start({ iv });
  decipher.update(forge.util.createBuffer(encrypted));
  const success = decipher.finish();

  if (!success) throw new Error('Decryption failed — wrong key or corrupted data');

  return decipher.output.toString();
}

/**
 * Generate a random hex ID.
 * @param {number} [bytes=16] - Number of random bytes
 * @returns {string} Hex string
 */
export function randomHexId(bytes = 16) {
  return forge.util.bytesToHex(forge.random.getBytesSync(bytes));
}

/**
 * Hash a string using SHA-256.
 * @param {string} input
 * @returns {string} Hex digest
 */
export function sha256(input) {
  const md = forge.md.sha256.create();
  md.update(input, 'utf8');
  return md.digest().toHex();
}
