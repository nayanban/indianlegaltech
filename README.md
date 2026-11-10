# Advisory Note Explorer

A private advisory note, accessible through a question-led GitHub Pages interface. Visitors can ask free-form questions and receive answers that cite the note, identify what it cannot establish, and suggest specific follow-up research.

The site is **not an FAQ**. Each question is sent to an AI model together with the note, and the answer is generated for that question. The model is instructed to use only the note, and the API checks that every cited passage exists. This reduces unsupported answers but does not make them impossible; readers should check the displayed passages.

## Architecture

```text
GitHub Pages (public interface + encrypted note)
        │ question + shared passphrase
        ▼
Sites serverless API (decrypts note in memory; keeps API key private)
        │ question + note text (no passphrase)
        ▼
OpenAI Responses API
        │ structured answer
        ▼
The API checks citation IDs and returns cited passages, limitations, and research questions
```

The repository contains `public/note.enc.json`, an AES-256-GCM encrypted copy of the note. It does not contain the plaintext note, the passphrase, or the OpenAI API key. The passphrase is shared separately with authorized readers. Anyone with it can read the note and use the answer service; this design does not provide individual accounts or revocation.

The opening preliminary analysis is tagged separately from the later market notes. Answers distinguish hypotheses from observations and never present the note as independent verification of current facts or legal advice.

## Repository layout

| Path | Purpose |
| --- | --- |
| `public/` | Static GitHub Pages interface and encrypted note |
| `worker/worker.mjs` | Serverless answer API, deployed through Sites |
| `.openai/hosting.json` | Sites project identity and deployment configuration |
| `scripts/extract_docx.py` | Extracts paragraphs from the source DOCX into an ignored private JSON file |
| `scripts/encrypt.mjs` | Encrypts that private JSON for publication |
| `scripts/verify-private.mjs` | Confirms the encrypted file matches the private source |
| `tests/` | Tests for decryption, access checks, and evidence validation |

## Deployment

1. Enable GitHub Pages for this repository with **GitHub Actions** as its source. `.github/workflows/pages.yml` publishes `public/` on pushes to `main`.
2. Build the Sites API with `npm run build:sites-api`. The Sites project ID is in `.openai/hosting.json`; its source is `worker/worker.mjs`. Set its runtime environment values to `ALLOWED_ORIGIN=https://nayanban.github.io`, `NOTE_URL=https://nayanban.github.io/indianlegaltech/note.enc.json`, and `OPENAI_MODEL=gpt-5-mini`.
3. Configure the Sites runtime secret `OPENAI_API_KEY` through the OpenAI Developers integration. Never add it to this repository or `public/config.js`. Publish the Sites API and allow visitors with the public URL to reach it; the shared passphrase still controls access to the note.
4. Put the deployed Sites API URL in `public/config.js` as `apiBaseUrl`, then push that change so GitHub Pages receives it.
5. Give the passphrase to authorized readers through a separate channel. It is not stored in the site, browser storage, or the repository.

The service needs an OpenAI API account with billing enabled. Model usage incurs a charge per question. Set an API spend limit and, if traffic grows, add API rate limiting. GitHub Pages hosts the static interface without an application server.

## Updating the note

Use the source DOCX only on a trusted computer:

```sh
python3 scripts/extract_docx.py /path/to/source.docx private/source.json
node scripts/encrypt.mjs "$PWD/private/source.json" public/note.enc.json < private/access.key
node scripts/verify-private.mjs
node --test
```

Only commit the changed `public/note.enc.json`. `private/` is ignored by Git. To revoke a shared passphrase, generate a new strong random passphrase, re-encrypt the note, and distribute the new one.

## Limits

- The note is decrypted in the Sites API for each authorized question and sent to OpenAI for that answer. The passphrase is **not** sent to OpenAI. The request sets `store: false`; see [OpenAI's API data controls](https://developers.openai.com/api/docs/guides/your-data) for applicable retention details.
- Answers are restricted to the source note. They do not search the web or confirm whether time-sensitive claims remain true.
- The API checks that citation IDs exist, but a reader should still inspect the quoted passages to decide whether they support the answer.
- A shared passphrase cannot identify individual viewers. If individual access control becomes necessary, add authenticated accounts and move the note behind that service.

Copyright (c) 2026 Nayan Banerjee. All rights reserved.
