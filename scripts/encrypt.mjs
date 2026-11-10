import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [sourcePath, destinationPath] = process.argv.slice(2);
if (!sourcePath || !destinationPath || !sourcePath.includes('/private/')) {
  throw new Error('usage: node scripts/encrypt.mjs private/content.json public/note.enc.json');
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const passphrase = Buffer.concat(chunks).toString('utf8').trim();
if (passphrase.length < 20) throw new Error('Use a random passphrase of at least 20 characters.');

const plaintext = readFileSync(sourcePath);
JSON.parse(plaintext.toString('utf8'));
const salt = randomBytes(16);
const iv = randomBytes(12);
const iterations = 600_000;
const key = pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
const result = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations,
  cipher: 'AES-256-GCM',
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
};
writeFileSync(destinationPath, JSON.stringify(result) + '\n');
console.log(`Encrypted ${plaintext.length} bytes to ${destinationPath}`);
