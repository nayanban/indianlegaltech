// Local browser preview only. Never deployed and never calls OpenAI.
import { createServer } from 'node:http';
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import worker from '../worker/worker.mjs';

const sample = {
  schema: 1, title: 'Sample advisory note', suggested_questions: ['What is proposed?', 'What remains unknown?'],
  paragraphs: [{ id: 'p1', section: 'Preliminary analysis', kind: 'preliminary', text: 'A pilot is proposed, but no results are available.' }],
};
const salt = randomBytes(16);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync('test-preview-passphrase-12345', salt, 600_000, 32, 'sha256'), iv);
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(sample)), cipher.final(), cipher.getAuthTag()]);
const bundle = {
  version: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations: 600_000,
  salt: salt.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'),
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (url === 'https://example.test/note.enc.json') return Response.json(bundle);
  if (url === 'https://api.openai.com/v1/responses') {
    const request = JSON.parse(options.body);
    const question = request.input.split('SOURCE NOTE')[0].toLowerCase();
    const unavailable = question.includes('addressable market') || question.includes('market size');
    return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
      status: unavailable ? 'unavailable' : 'partial',
      answer: unavailable ? 'The note does not size the addressable market.' : 'The note offers a preliminary idea, but no validation result.',
      citations: unavailable ? [] : ['p1'],
      limitations: 'This local preview uses a simulated answer. It does not call an AI model.',
      research_questions: ['What evidence would validate this for the target segment?'],
    }) }] }] });
  }
  return originalFetch(url, options);
};

const env = {
  NOTE_URL: 'https://example.test/note.enc.json',
  ALLOWED_ORIGIN: 'http://localhost:8080',
  OPENAI_API_KEY: 'local-preview-only',
};

createServer(async (incoming, outgoing) => {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const request = new Request(`http://localhost:8787${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await worker.fetch(request, env);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(8787, '127.0.0.1', () => console.log('Mock answer API on http://localhost:8787'));
