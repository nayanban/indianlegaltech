import assert from 'node:assert/strict';
import { createCipheriv, pbkdf2Sync, randomBytes, webcrypto } from 'node:crypto';
import test from 'node:test';
import worker, { decryptNote, selectPassages, validateAnswer } from '../worker/worker.mjs';

globalThis.crypto ||= webcrypto;
const passphrase = 'this-is-only-a-test-passphrase';
const sampleNote = {
  schema: 1, title: 'Sample advisory note', suggested_questions: ['What is proposed?'],
  paragraphs: [
    { id: 'p1', section: 'Preliminary analysis', kind: 'preliminary', text: 'A pilot is proposed but has not been run.' },
    { id: 'p2', section: 'Separate subject', kind: 'market_note', text: 'Confidential pricing material is unrelated to this question.' },
  ],
};
const salt = randomBytes(16);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(passphrase, salt, 600_000, 32, 'sha256'), iv);
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(sampleNote)), cipher.final(), cipher.getAuthTag()]);
const bundle = {
  version: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations: 600_000,
  salt: salt.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'),
};
const origin = 'https://nayanban.github.io';
const env = { NOTE_URL: 'https://example.test/note.enc.json', ALLOWED_ORIGIN: origin, OPENAI_API_KEY: 'test-key' };

test('encrypted note decrypts and rejects the wrong passphrase', async () => {
  const note = await decryptNote(bundle, passphrase);
  assert.equal(note.schema, 1);
  assert.equal(note.paragraphs.length, 2);
  await assert.rejects(() => decryptNote(bundle, 'a-completely-wrong-passphrase'));
});

test('unsupported citations are removed and the answer is downgraded', async () => {
  const note = await decryptNote(bundle, passphrase);
  const answer = validateAnswer({
    status: 'answered', answer: 'An invented answer', citations: ['invented'],
    limitations: '', research_questions: [],
  }, note.paragraphs, 'What is missing?');
  assert.equal(answer.status, 'unavailable');
  assert.equal(answer.answer, 'The note does not establish an answer to this question.');
  assert.equal(answer.evidence.length, 0);
  assert.equal(answer.research_questions.length, 1);
});

test('passage selection excludes unrelated material and citations to it', () => {
  const selected = selectPassages(sampleNote, 'Which pilot is proposed?');
  assert.deepEqual(selected.map(p => p.id), ['p1']);
  const answer = validateAnswer({
    status: 'answered', answer: 'A pilot is proposed.', citations: ['p2'],
    limitations: 'No results are supplied.', research_questions: ['What did the pilot show?'],
  }, selected, 'Which pilot is proposed?');
  assert.equal(answer.status, 'unavailable');
  assert.equal(answer.evidence.length, 0);
});

test('unlock and ask enforce the passphrase and return checked evidence', async () => {
  const priorFetch = globalThis.fetch;
  let modelRequest;
  globalThis.fetch = async (input, options) => {
    if (input === env.NOTE_URL) return Response.json(bundle);
    if (input === 'https://api.openai.com/v1/responses') {
      modelRequest = JSON.parse(options.body);
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        status: 'partial', answer: 'The note presents this as an idea to test.', citations: ['p1'],
        limitations: 'No pilot results are supplied.', research_questions: ['What did paid pilots show?'],
      }) }] }] });
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };
  try {
    const bad = await worker.fetch(new Request('https://api.test/unlock', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: 'a-completely-wrong-passphrase' }),
    }), env);
    assert.equal(bad.status, 401);

    const unlocked = await worker.fetch(new Request('https://api.test/unlock', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    }), env);
    assert.equal(unlocked.status, 200);
    assert.equal((await unlocked.json()).suggested_questions.length, 1);

    const response = await worker.fetch(new Request('https://api.test/ask', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase, question: 'Which pilot is proposed?' }),
    }), env);
    assert.equal(response.status, 200);
    const answer = await response.json();
    assert.equal(answer.status, 'partial');
    assert.equal(answer.evidence_type, 'preliminary_analysis');
    assert.deepEqual(answer.evidence.map(item => item.id), ['p1']);
    assert.equal(modelRequest.store, false);
    assert.match(modelRequest.input, /SELECTED SOURCE PASSAGES/);
    assert.equal(modelRequest.input.includes('Confidential pricing material'), false);
    assert.equal(modelRequest.input.includes(passphrase), false);
  } finally {
    globalThis.fetch = priorFetch;
  }
});
