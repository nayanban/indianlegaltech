# India Legal Market Note Explorer

**[Visit the project site](https://nayanban.github.io/indianlegaltech/)** · **[Read how I built it](HOW_IT_WAS_BUILT.md)**

![India Legal Market Note Explorer title card](public/social-preview.png)

I prepared an India legal market note as an advisor for a company. This project turns the private note into a question-led interface: authorized readers can ask in their own words, inspect the passages behind an answer, see what the note cannot establish, and identify what to research next.

**Current status:** The GitHub Pages interface is connected to the live GPT-6 Luna answer service. Authorized readers can unlock the private note with the shared passphrase and ask free-form questions. The service has a private OpenAI API key; neither the key nor the plaintext note is in this repository.

## Why this exists

An advisory note can contain useful context while leaving some questions open. A quick answer is only useful if the reader can see its basis and distinguish what the note says from what still needs verification.

I authored the source note and defined the product requirements: free-form questions, visible source passages, explicit uncertainty, and concrete follow-up research questions. I used AI-assisted development to implement and test the interface and answer service. The [build account](HOW_IT_WAS_BUILT.md) explains the decisions and their limits.

## Intended reader experience

1. An authorized reader enters the shared passphrase. The browser derives a note key from it and sends that key to the answer service over HTTPS.
2. The service decrypts the note in memory, selects a bounded set of likely relevant passages, and sends them with the question to an AI model.
3. The answer distinguishes supported, partial, and unsupported responses. It shows cited passages and a short, question-specific account of the answer's scope, plus useful research questions.

This is not a fixed FAQ. Citation IDs are checked against the passages actually sent to the model, but readers should still inspect whether the passages support the answer. The interface describes the note; it does not independently verify current market claims or provide legal advice. There is no public demonstration of the private note or its answers.

## Architecture

```text
GitHub Pages (public interface + encrypted note)
        │ browser derives a note key from the passphrase
        │ question + note key over HTTPS
        ▼
Sites serverless API (holds an encrypted copy; decrypts and selects passages in memory)
        │ question + selected passages (no passphrase or note key)
        ▼
OpenAI Responses API
        │ structured answer
        ▼
The API checks citation IDs and returns cited passages, limitations, and research questions
```

The repository contains `public/note.enc.json`, an AES-256-GCM encrypted copy of the note. The Sites build embeds the same encrypted file so it does not have to fetch it at runtime. The repository does not contain the plaintext note, the passphrase, or the OpenAI API key. The passphrase is shared separately with authorized readers. Anyone with it can read the note and use the answer service; this design does not provide individual accounts or revocation.

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
| `HOW_IT_WAS_BUILT.md` | Product and implementation case study |

## Deployment

1. Enable GitHub Pages for this repository with **GitHub Actions** as its source. `.github/workflows/pages.yml` publishes `public/` on pushes to `main`.
2. Build the Sites API with `npm run build:sites-api`. The Sites project ID is in `.openai/hosting.json`; its source is `worker/worker.mjs`. The build embeds `public/note.enc.json` in the Worker output. Set `ALLOWED_ORIGIN=https://nayanban.github.io` and `OPENAI_MODEL=gpt-6-luna` in the Sites runtime.
3. Configure the Sites runtime secret `OPENAI_API_KEY` through the OpenAI Developers integration. Never add it to this repository or `public/config.js`. The Sites API has public visitor access; the note key still controls access to the note.
4. Set the deployed Sites API URL in `public/config.js` as `apiBaseUrl`, then push that change so GitHub Pages receives it.
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

Only commit the changed `public/note.enc.json`, then rebuild and redeploy the Sites API so its encrypted copy matches. `private/` is ignored by Git. To revoke a shared passphrase, generate a new strong random passphrase, re-encrypt the note, redeploy the API, and distribute the new passphrase.

## Limits

- The browser derives a note key with PBKDF2-SHA256 (600,000 iterations). The passphrase stays in browser memory; the derived key is sent to the Sites API over HTTPS and has equivalent access to this encrypted note. The API decrypts the note for each authorized question. Only selected passages and the question are sent to OpenAI; neither the passphrase nor note key is sent. The request sets `store: false`; see [OpenAI's API data controls](https://developers.openai.com/api/docs/guides/your-data) for applicable retention details.
- Passage selection uses keyword matching. It may miss relevant sections when a viewer uses different terminology. A viewer can rephrase the question or inspect the original note if certainty matters. This standing limitation is not repeated beneath every supported answer.
- Answers are restricted to the source note. They do not search the web or confirm whether time-sensitive claims remain true.
- The API checks that citation IDs exist, but a reader should still inspect the quoted passages to decide whether they support the answer.
- A shared passphrase cannot identify individual viewers. If individual access control becomes necessary, add authenticated accounts and move the note behind that service.

Copyright (c) 2026 Nayan Banerjee. All rights reserved.
