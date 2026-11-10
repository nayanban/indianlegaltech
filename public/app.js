const $ = selector => document.querySelector(selector);
const apiBaseUrl = (window.APP_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
let sessionNoteKey = '';

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}

async function api(path, body) {
  if (!apiBaseUrl) throw new Error('The answer service has not been connected yet.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The service is unavailable.');
  return result;
}

async function deriveNoteKey(passphrase) {
  const response = await fetch('./note.enc.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('The encrypted note is unavailable.');
  const bundle = await response.json();
  if (bundle.version !== 1 || bundle.kdf !== 'PBKDF2-SHA256' || bundle.cipher !== 'AES-256-GCM'
    || !Number.isInteger(bundle.iterations) || bundle.iterations < 600_000) {
    throw new Error('The encrypted note has an unsupported format.');
  }
  const salt = Uint8Array.from(atob(bundle.salt), character => character.charCodeAt(0));
  const passwordKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: bundle.iterations }, passwordKey, 256,
  ));
  return btoa(String.fromCharCode(...bits));
}

function renderSuggestions(questions) {
  const container = $('#suggested-questions');
  container.replaceChildren();
  for (const question of questions.slice(0, 6)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-button';
    button.textContent = question;
    button.addEventListener('click', () => {
      $('#question').value = question;
      $('#question').focus();
      $('#question-form').requestSubmit();
    });
    container.append(button);
  }
}

function renderAnswer(data) {
  const labels = { answered: 'Answered from the note', partial: 'Partially answered', unavailable: 'No supported answer found' };
  const evidenceLabels = { preliminary_analysis: 'Preliminary analysis', market_note: 'Market notes', mixed: 'Mixed evidence', none: 'No supporting passage' };
  const badge = $('#status-badge');
  badge.textContent = labels[data.status] || labels.unavailable;
  badge.className = `status-badge status-${data.status}`;
  $('#evidence-type').textContent = evidenceLabels[data.evidence_type] || evidenceLabels.none;
  $('#answer-text').textContent = data.answer || 'The note does not establish an answer to this question.';
  $('#limitations-text').textContent = data.limitations || 'No further limitation was provided.';

  const research = $('#research-list');
  research.replaceChildren();
  for (const question of data.research_questions || []) {
    const item = document.createElement('li');
    item.textContent = question;
    research.append(item);
  }
  $('#research-section').hidden = research.children.length === 0;

  const evidence = $('#evidence-list');
  evidence.replaceChildren();
  for (const passage of data.evidence || []) {
    const details = document.createElement('details');
    details.className = 'evidence-item';
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = `${passage.section} · ${passage.id}`;
    const type = document.createElement('small');
    type.textContent = passage.kind === 'preliminary' ? 'Preliminary analysis' : 'Market note';
    summary.append(label, type);
    const text = document.createElement('p');
    text.textContent = passage.text;
    details.append(summary, text);
    evidence.append(details);
  }
  $('#evidence-section').hidden = evidence.children.length === 0;
  $('#answer-content').hidden = false;
}

const unlockButton = $('#unlock-button');
const askButton = $('#ask-button');
unlockButton.dataset.label = unlockButton.textContent;
askButton.dataset.label = askButton.textContent;
if (!apiBaseUrl) {
  $('#access-title').textContent = 'Private access is being prepared';
  $('#access-description').textContent = 'The note and its answers are reserved for authorized readers.';
  $('#unlock-form label').hidden = true;
  $('#passphrase').hidden = true;
  unlockButton.hidden = true;
  $('#passphrase').disabled = true;
  unlockButton.disabled = true;
  $('#service-status').hidden = false;
}

$('#unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  const passphrase = $('#passphrase').value;
  $('#unlock-error').hidden = true;
  setBusy(unlockButton, true, 'Unlocking…');
  try {
    const noteKey = await deriveNoteKey(passphrase);
    const info = await api('/unlock', { note_key: noteKey });
    sessionNoteKey = noteKey;
    $('#passphrase').value = '';
    $('#note-title').textContent = info.title || 'Advisory note';
    renderSuggestions(info.suggested_questions || []);
    $('#lock-view').hidden = true;
    $('#explorer-view').hidden = false;
    $('#question').focus();
  } catch (error) {
    $('#unlock-error').textContent = error.message;
    $('#unlock-error').hidden = false;
  } finally {
    setBusy(unlockButton, false);
  }
});

$('#question-form').addEventListener('submit', async event => {
  event.preventDefault();
  const question = $('#question').value.trim();
  if (!question) return;
  $('#answer-content').hidden = true;
  $('#empty-state').hidden = true;
  $('#answer-error').hidden = true;
  $('#loading-state').hidden = false;
  setBusy(askButton, true, 'Checking…');
  try {
    const answer = await api('/ask', { note_key: sessionNoteKey, question });
    renderAnswer(answer);
  } catch (error) {
    $('#answer-error').textContent = error.message;
    $('#answer-error').hidden = false;
  } finally {
    $('#loading-state').hidden = true;
    setBusy(askButton, false);
  }
});

$('#lock-button').addEventListener('click', () => {
  sessionNoteKey = '';
  $('#question').value = '';
  $('#answer-content').hidden = true;
  $('#empty-state').hidden = false;
  $('#explorer-view').hidden = true;
  $('#lock-view').hidden = false;
  $('#passphrase').focus();
});
