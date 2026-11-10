import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { decryptNote } from '../worker/worker.mjs';

globalThis.crypto ||= webcrypto;
const source = JSON.parse(readFileSync(new URL('../private/source.json', import.meta.url), 'utf8'));
const bundle = JSON.parse(readFileSync(new URL('../public/note.enc.json', import.meta.url), 'utf8'));
const passphrase = readFileSync(new URL('../private/access.key', import.meta.url), 'utf8').trim();
const decrypted = await decryptNote(bundle, passphrase);
assert.deepEqual(decrypted, source);
assert.ok(source.paragraphs.length > 100);
console.log(`Verified encrypted note: ${source.paragraphs.length} paragraphs match the private source.`);
