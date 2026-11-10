import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
const encryptedNote = JSON.parse(await readFile('public/note.enc.json', 'utf8'));
if (encryptedNote.version !== 1 || !encryptedNote.ciphertext) {
  throw new Error('Encrypted note bundle is missing or invalid');
}
const workerSource = await readFile('worker/worker.mjs', 'utf8');
await writeFile(
  'dist/server/index.js',
  `const EMBEDDED_ENCRYPTED_NOTE = ${JSON.stringify(encryptedNote)};\n${workerSource}`,
);
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
