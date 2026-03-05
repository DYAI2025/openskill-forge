/**
 * Skill Forge — LLM Client
 * Supports OpenAI, Anthropic, and Ollama backends
 */

import { buildSystemPrompt, buildUserPrompt, buildValidationPrompt } from './prompt-engine.js';

/**
 * Call the configured LLM provider
 */
async function callLLM(systemPrompt, userPrompt, config = {}) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const maxTokens = config.maxTokens || 8192;

  switch (provider) {
    case 'openai':
      return callOpenAI(systemPrompt, userPrompt, maxTokens);
    case 'anthropic':
      return callAnthropic(systemPrompt, userPrompt, maxTokens);
    case 'ollama':
      return callOllama(systemPrompt, userPrompt, maxTokens);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

async function callOpenAI(systemPrompt, userPrompt, maxTokens) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(systemPrompt, userPrompt, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

async function callOllama(systemPrompt, userPrompt, maxTokens) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.message.content;
}

/**
 * Generate a skill from goal + documents
 */
export async function generateSkill({ goal, definitionOfDone, documents, options }) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ goal, definitionOfDone, documents, options });

  const raw = await callLLM(systemPrompt, userPrompt, { maxTokens: 8192 });

  // Clean: remove wrapping code fences if the LLM added them
  let skill = raw.trim();
  if (skill.startsWith('```')) {
    skill = skill.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '');
  }

  return skill;
}

/**
 * Validate a generated skill and return assessment
 */
export async function validateSkill(skillContent) {
  const validationPrompt = buildValidationPrompt(skillContent);

  const raw = await callLLM(
    'You are a Skill QA evaluator. Respond ONLY with the requested JSON, no surrounding text.',
    validationPrompt,
    { maxTokens: 2048 }
  );

  // Extract JSON from response
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];

  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      status: 'UNKNOWN',
      score: 0,
      issues: [{ severity: 'P2', description: 'Validation response was not valid JSON', suggestion: 'Manual review recommended' }],
      summary: 'Validation parse error — review manually',
    };
  }
}

/**
 * Refine a skill based on validation feedback
 */
export async function refineSkill(skillContent, issues) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = `<refinement_request>
<current_skill>
${skillContent}
</current_skill>

<issues_to_fix>
${issues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.description} — Suggestion: ${i.suggestion}`).join('\n')}
</issues_to_fix>

<instructions>
Fix the issues listed above in the skill. Output ONLY the complete, updated SKILL.md content.
Start directly with the YAML frontmatter (---). Do not wrap in code fences.
Preserve all good parts of the current skill — only fix what's broken.
</instructions>
</refinement_request>`;

  const raw = await callLLM(systemPrompt, userPrompt, { maxTokens: 8192 });

  let skill = raw.trim();
  if (skill.startsWith('```')) {
    skill = skill.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '');
  }

  return skill;
}
