import './styles.css';

// ═══════════════════════════════════════════════
// SKILL FORGE — Frontend Application
// Vanilla JS, zero-dependency, embeddable
// ═══════════════════════════════════════════════

const API = '/api';

const state = {
  step: 'input', // input | loading | result
  files: [],
  result: null,
  validation: null,
  sessionId: null,
  showOptions: false,
  loadingMessage: '',
};

// ─── Render Engine ───

function render() {
  const app = document.getElementById('app');
  const isEmbed = new URLSearchParams(window.location.search).has('embed');

  app.innerHTML = `
    <div class="app ${isEmbed ? 'embed' : ''}">
      ${renderHeader()}
      ${renderSteps()}
      ${state.step === 'input' ? renderInputForm() : ''}
      ${state.step === 'loading' ? renderLoading() : ''}
      ${state.step === 'result' ? renderResult() : ''}
    </div>
  `;

  bindEvents();
}

function renderHeader() {
  return `
    <header class="header">
      <span class="header__icon">⚒️</span>
      <h1 class="header__title">Skill Forge</h1>
      <p class="header__subtitle">Generate production-ready AI agent skills from goals & documents</p>
    </header>
  `;
}

function renderSteps() {
  const steps = ['input', 'loading', 'result'];
  const currentIdx = steps.indexOf(state.step);
  return `
    <div class="steps">
      ${steps.map((s, i) => `
        <div class="step-dot ${i === currentIdx ? 'active' : ''} ${i < currentIdx ? 'completed' : ''}"></div>
      `).join('')}
    </div>
  `;
}

function renderInputForm() {
  return `
    <!-- Goal -->
    <div class="card">
      <div class="card__label">① Skill Goal</div>
      <textarea
        id="goal"
        class="goal-input"
        placeholder="Describe what the skill should do. Be specific about functionality, triggers, and expected behavior..."
      ></textarea>
    </div>

    <!-- Definition of Done -->
    <div class="card">
      <div class="card__label">② Definition of Done (optional)</div>
      <textarea
        id="dod"
        class="dod-input"
        placeholder="When is the skill 'done'? E.g.: Must handle edge cases X/Y, output must include Z, must not do W..."
      ></textarea>
    </div>

    <!-- Documents -->
    <div class="card">
      <div class="card__label">③ Reference Documents (optional)</div>
      <div class="upload-zone" id="uploadZone">
        <input type="file" id="fileInput" multiple
          accept=".md,.txt,.json,.pdf,.xml,.yaml,.yml,.docx" />
        <div class="upload-zone__icon">📄</div>
        <div class="upload-zone__text">Drop files here or click to upload</div>
        <div class="upload-zone__hint">md, txt, json, pdf, xml, yaml, docx — max 20MB each</div>
      </div>
      ${state.files.length > 0 ? `
        <div class="file-list">
          ${state.files.map((f, i) => `
            <span class="file-chip">
              📎 ${f.name}
              <span class="file-chip__remove" data-remove="${i}">✕</span>
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Options -->
    <div class="card">
      <button class="options-toggle" id="toggleOptions">
        ${state.showOptions ? '▾' : '▸'} Advanced Options
      </button>
      <div class="options-panel ${state.showOptions ? '' : 'hidden'}" id="optionsPanel">
        <div class="option-row">
          <label>Skill Name</label>
          <input type="text" id="optName" placeholder="auto-generated if empty" />
        </div>
        <div class="option-row">
          <label>Language</label>
          <input type="text" id="optLang" placeholder="auto-detect from goal" />
        </div>
        <div class="option-row">
          <label>Constraints</label>
          <input type="text" id="optConstraints" placeholder="e.g.: No external API calls, must work offline" />
        </div>
      </div>
    </div>

    <!-- Generate Button -->
    <div class="actions">
      <button class="btn btn-primary" id="generateBtn">
        ⚒️ Forge Skill
      </button>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="loading">
      <div class="spinner"></div>
      <div class="loading__text">${state.loadingMessage || 'Forging your skill...'}</div>
      <div class="loading__subtext">Analyzing documents, designing workflow, generating SKILL.md</div>
    </div>
  `;
}

function renderResult() {
  const v = state.validation;
  const score = v?.score || 0;
  const badgeClass = score >= 8 ? 'pass' : score >= 5 ? 'warn' : 'fail';
  const badgeText = score >= 8 ? '✓ Quality Pass' : score >= 5 ? '⚠ Acceptable' : '✗ Needs Work';

  return `
    <div class="card">
      <div class="result-header">
        <div class="card__label">Generated SKILL.md</div>
        ${v ? `<span class="result-badge ${badgeClass}">${badgeText} · ${score}/10</span>` : ''}
      </div>
      <div class="skill-preview" id="skillPreview">${escapeHtml(state.result)}</div>
    </div>

    ${v && v.issues?.length ? `
      <div class="card">
        <div class="card__label">Quality Report</div>
        <div class="validation__summary">${v.summary || ''}</div>
        <div class="validation__issues">
          ${v.issues.map(i => `
            <div class="issue">
              <span class="issue__severity ${i.severity}">${i.severity}</span>
              <span>${escapeHtml(i.description)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Refine -->
    <div class="card">
      <div class="card__label">Refine</div>
      <div class="refine-input">
        <input type="text" id="refineInput" placeholder="Describe what to change or improve..." />
        <button class="btn btn-secondary" id="refineBtn">Refine</button>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn btn-primary" id="downloadBtn">⬇ Download SKILL.md</button>
      <button class="btn btn-secondary" id="copyBtn">📋 Copy</button>
      <button class="btn btn-ghost" id="newBtn">← New Skill</button>
    </div>
  `;
}

// ─── Event Binding ───

function bindEvents() {
  // File upload
  const fileInput = document.getElementById('fileInput');
  const uploadZone = document.getElementById('uploadZone');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      addFiles(Array.from(e.target.files));
    });
  }

  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files));
    });
  }

  // Remove file chips
  document.querySelectorAll('[data-remove]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.remove);
      state.files.splice(idx, 1);
      render();
    });
  });

  // Options toggle
  const toggleBtn = document.getElementById('toggleOptions');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.showOptions = !state.showOptions;
      render();
    });
  }

  // Generate
  const generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerate);
  }

  // Download
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([state.result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SKILL.md';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded SKILL.md');
    });
  }

  // Copy
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(state.result);
      showToast('Copied to clipboard');
    });
  }

  // New
  const newBtn = document.getElementById('newBtn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      state.step = 'input';
      state.result = null;
      state.validation = null;
      state.sessionId = null;
      state.files = [];
      render();
    });
  }

  // Refine
  const refineBtn = document.getElementById('refineBtn');
  if (refineBtn) {
    refineBtn.addEventListener('click', handleRefine);
  }
}

function addFiles(newFiles) {
  const allowed = ['.md', '.txt', '.json', '.pdf', '.xml', '.yaml', '.yml', '.docx'];
  for (const f of newFiles) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (allowed.includes(ext) && !state.files.find(x => x.name === f.name)) {
      state.files.push(f);
    }
  }
  render();
}

// ─── API Calls ───

async function handleGenerate() {
  const goal = document.getElementById('goal')?.value?.trim();
  const dod = document.getElementById('dod')?.value?.trim();

  if (!goal || goal.length < 10) {
    showToast('Please describe the skill goal (at least 10 characters)');
    return;
  }

  const options = {};
  const optName = document.getElementById('optName')?.value?.trim();
  const optLang = document.getElementById('optLang')?.value?.trim();
  const optConstraints = document.getElementById('optConstraints')?.value?.trim();
  if (optName) options.skillName = optName;
  if (optLang) options.language = optLang;
  if (optConstraints) options.additionalConstraints = optConstraints;

  state.step = 'loading';
  state.loadingMessage = 'Forging your skill...';
  render();

  try {
    const formData = new FormData();
    formData.append('goal', goal);
    if (dod) formData.append('definitionOfDone', dod);
    formData.append('options', JSON.stringify(options));
    for (const f of state.files) {
      formData.append('files', f);
    }

    const res = await fetch(`${API}/generate`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Generation failed');
    }

    const data = await res.json();
    state.result = data.skill;
    state.validation = data.validation;
    state.sessionId = data.sessionId;
    state.step = 'result';
    render();

    if (data.refined) {
      showToast('Auto-refined for quality');
    }
    if (data.mode === 'local') {
      showToast('Generated in local mode (no API key). Add an API key for AI-powered generation.');
    }
  } catch (e) {
    state.step = 'input';
    render();
    showToast(`Error: ${e.message}`);
  }
}

async function handleRefine() {
  const feedback = document.getElementById('refineInput')?.value?.trim();
  if (!feedback) {
    showToast('Enter what you want to change');
    return;
  }

  state.step = 'loading';
  state.loadingMessage = 'Refining skill...';
  render();

  try {
    const res = await fetch(`${API}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        skill: state.result,
        feedback,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Refinement failed');
    }

    const data = await res.json();
    state.result = data.skill;
    state.validation = data.validation;
    state.step = 'result';
    render();
    showToast('Skill refined ✓');
  } catch (e) {
    state.step = 'result';
    render();
    showToast(`Error: ${e.message}`);
  }
}

// ─── Utilities ───

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Init ───

async function init() {
  // Check backend health
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    if (!data.configured) {
      console.warn('⚠ LLM provider not configured. Set API key in .env');
    }
  } catch {
    console.warn('⚠ Backend not reachable');
  }

  render();
}

init();
