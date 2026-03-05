import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

import { parseAllDocuments } from './parsers.js';
import { generateSkill, validateSkill, refineSkill } from './llm-client.js';
import { generateSkillLocally, validateSkillLocally } from './local-generator.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// File upload config
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.md', '.txt', '.json', '.pdf', '.xml', '.yaml', '.yml', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// In-memory session store (for simplicity; swap for Redis in prod)
const sessions = new Map();

// ─── API Routes ─────────────────────────────────────────────────

/**
 * POST /api/generate
 * Main skill generation endpoint
 * Body: multipart/form-data with fields: goal, definitionOfDone, options (JSON), files[]
 */
const uploadMiddleware = (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      // Ignore multer errors (e.g. no files), continue with empty files
      req.files = req.files || [];
    }
    next();
  });
};

app.post('/api/generate', uploadMiddleware, async (req, res) => {
  const sessionId = uuid();
  try {
    const { goal, definitionOfDone, options: optionsStr } = req.body;
    const options = optionsStr ? JSON.parse(optionsStr) : {};

    if (!goal || goal.trim().length < 10) {
      return res.status(400).json({ error: 'Goal must be at least 10 characters' });
    }

    // Parse uploaded documents
    let documents = [];
    if (req.files && req.files.length > 0) {
      documents = await parseAllDocuments(req.files);
      // Clean up uploaded files
      for (const f of req.files) {
        await fs.unlink(f.path).catch(() => {});
      }
    }

    // Store session
    sessions.set(sessionId, { goal, definitionOfDone, documents, options, history: [] });

    const useLocal = options.useLocal === true || !hasValidApiKey();
    console.log(`[${sessionId}] Generating skill: "${goal.substring(0, 80)}..." with ${documents.length} docs (${useLocal ? 'LOCAL' : 'API'})`);

    let finalSkill, validation, refined = false;

    if (useLocal) {
      // Local template-based generation (no API key needed)
      finalSkill = generateSkillLocally({ goal, definitionOfDone, documents, options });
      validation = validateSkillLocally(finalSkill);
    } else {
      // API-based generation with fallback to local
      try {
        const skillContent = await generateSkill({ goal, definitionOfDone, documents, options });

        validation = null;
        try {
          validation = await validateSkill(skillContent);
        } catch (e) {
          console.warn(`[${sessionId}] Validation failed, using local:`, e.message);
          validation = validateSkillLocally(skillContent);
        }

        finalSkill = skillContent;
        if (validation && validation.score < 7 && validation.issues?.some(i => i.severity === 'P0')) {
          console.log(`[${sessionId}] Auto-refining (score: ${validation.score})...`);
          try {
            finalSkill = await refineSkill(skillContent, validation.issues);
            validation = await validateSkill(finalSkill);
            refined = true;
          } catch (e) {
            console.warn(`[${sessionId}] Refinement failed:`, e.message);
          }
        }
      } catch (apiErr) {
        // Fallback to local generation on API error
        console.warn(`[${sessionId}] API failed, falling back to local:`, apiErr.message);
        finalSkill = generateSkillLocally({ goal, definitionOfDone, documents, options });
        validation = validateSkillLocally(finalSkill);
      }
    }

    // Update session
    sessions.get(sessionId).history.push({ skill: finalSkill, validation });

    res.json({
      sessionId,
      skill: finalSkill,
      validation,
      refined,
      mode: useLocal ? 'local' : 'api',
      documentsUsed: documents.map(d => d.filename),
    });
  } catch (e) {
    console.error(`[${sessionId}] Generation error:`, e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/refine
 * Refine an existing generated skill
 */
app.post('/api/refine', async (req, res) => {
  try {
    const { sessionId, skill, feedback } = req.body;

    if (!skill) return res.status(400).json({ error: 'No skill content provided' });

    const issues = feedback
      ? [{ severity: 'P1', description: feedback, suggestion: feedback }]
      : [];

    // If session exists, get original context for better refinement
    const session = sessions.get(sessionId);

    let refined, validation;
    if (!hasValidApiKey()) {
      // Local mode: can't truly refine, just return original with local validation
      refined = skill; // In local mode, refinement is limited
      validation = validateSkillLocally(skill);
    } else {
      refined = await refineSkill(skill, issues);
      validation = await validateSkill(refined);
    }

    if (session) {
      session.history.push({ skill: refined, validation });
    }

    res.json({ skill: refined, validation });
  } catch (e) {
    console.error('Refinement error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/validate
 * Validate a skill without generating
 */
app.post('/api/validate', async (req, res) => {
  try {
    const { skill } = req.body;
    if (!skill) return res.status(400).json({ error: 'No skill content provided' });

    let validation;
    try {
      if (hasValidApiKey()) {
        validation = await validateSkill(skill);
      } else {
        validation = validateSkillLocally(skill);
      }
    } catch (e) {
      // Fallback to local validation on API error
      console.warn('API validation failed, using local:', e.message);
      validation = validateSkillLocally(skill);
    }
    res.json(validation);
  } catch (e) {
    console.error('Validation error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const hasKey = provider === 'ollama' || !!process.env[`${provider.toUpperCase()}_API_KEY`];
  res.json({
    status: 'ok',
    provider,
    configured: hasKey,
    localMode: !hasKey,
    version: '1.0.0',
  });
});

function hasValidApiKey() {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  if (provider === 'ollama') return true;
  const key = process.env[`${provider.toUpperCase()}_API_KEY`];
  return !!key && key.length > 10 && !key.includes('...');
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚒️  Skill Forge running on http://localhost:${PORT}`);
  console.log(`   Provider: ${process.env.LLM_PROVIDER || 'anthropic'}`);
  console.log(`   Upload limit: 20MB per file, 10 files max\n`);
});
