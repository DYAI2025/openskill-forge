/**
 * Skill Forge — Local Generator (No API key needed)
 * Uses template-based generation from the kit mechanics.
 * Produces a solid SKILL.md from goal + documents using pattern matching.
 */

/**
 * Generate a skill locally using template mechanics
 */
export function generateSkillLocally({ goal, definitionOfDone, documents, options }) {
  const lang = detectLanguage(goal);
  const name = options?.skillName || generateName(goal);
  const description = generateDescription(goal, lang);
  const inputs = extractInputs(goal, definitionOfDone, documents);
  const workflow = generateWorkflow(goal, definitionOfDone, documents);
  const outputFormat = generateOutputFormat(goal, documents);
  const examples = generateExamples(goal, inputs, outputFormat);
  const whenToUse = generateWhenToUse(goal, lang);

  const sections = lang === 'de' ? {
    when: 'Wann verwenden',
    inputs: 'Eingaben',
    workflow: 'Workflow / Anweisungen',
    output: 'Ausgabeformat',
    examples: 'Beispiele',
    safety: 'Sicherheit & Grenzen',
  } : {
    when: 'When to Use',
    inputs: 'Inputs',
    workflow: 'Workflow / Instructions',
    output: 'Output Format',
    examples: 'Examples',
    safety: 'Safety & Limitations',
  };

  let skill = `---
name: ${name}
description: ${description}
---

## ${sections.when}
${whenToUse}

## ${sections.inputs}
${inputs.map(i => `- \`${i.name}\`: ${i.type} — ${i.description}`).join('\n')}

## ${sections.workflow}
${workflow}

## ${sections.output}
${outputFormat}

## ${sections.examples}
${examples}
`;

  if (definitionOfDone) {
    skill += `\n## ${sections.safety}\n`;
    skill += `- ${lang === 'de' ? 'Dieser Skill ersetzt keine manuelle Prüfung bei kritischen Anwendungen.' : 'This skill does not replace manual review for critical applications.'}\n`;
    skill += `- ${lang === 'de' ? 'Ergebnisse sind heuristisch und sollten validiert werden.' : 'Results are heuristic and should be validated.'}\n`;
  }

  return skill;
}

function generateWhenToUse(goal, lang) {
  // Extract the core action from the goal (strip "Create a skill that..." prefixes)
  let core = goal.replace(/\n/g, ' ').trim();
  core = core.replace(/^(erstelle|erzeuge|baue|create|build|make|generate)\s+(einen?\s+)?(skill\s+)?(der|die|das|that|which)?\s*/i, '');
  core = core.charAt(0).toUpperCase() + core.slice(1);

  if (lang === 'de') {
    return `- ${core}
- Wenn strukturierte, wiederholbare Ergebnisse in diesem Bereich benötigt werden.
- Wenn Automatisierung und Konsistenz wichtiger sind als manuelle Einzelfallentscheidungen.
- **Nicht verwenden** bei unstrukturierten Aufgaben ohne klare Erfolgskriterien.`;
  }
  return `- ${core}
- When structured, repeatable results are needed in this domain.
- When automation and consistency matter more than manual case-by-case decisions.
- **Do NOT use** for unstructured tasks without clear success criteria.`;
}

function detectLanguage(text) {
  const deWords = /\b(und|oder|ein|eine|einen|einem|einer|der|die|das|ist|wird|soll|wenn|dass|für|mit|von|zu|auf|nicht|auch|als|nach|über|bei|noch|nur|kann|werden|sein|erstelle|erzeuge|analysiert|berechnet)\b/gi;
  const matches = text.match(deWords) || [];
  return matches.length >= 2 ? 'de' : 'en';
}

function generateName(goal) {
  // Extract key nouns and create kebab-case name
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'be', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'it', 'from', 'by', 'as', 'can', 'will', 'should', 'must', 'create', 'build', 'make', 'generate', 'ein', 'eine', 'der', 'die', 'das', 'und', 'oder', 'ist', 'für', 'mit', 'von', 'zu', 'erstelle', 'baue', 'erzeuge']);
  
  const words = goal.toLowerCase()
    .replace(/[^a-zäöüß\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 4);

  return words.join('-') || 'custom-skill';
}

function generateDescription(goal, lang) {
  // Condense goal to one line
  const clean = goal.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= 120) return clean;
  return clean.substring(0, 117) + '...';
}

function extractInputs(goal, dod, documents) {
  const inputs = [];
  const goalLower = goal.toLowerCase();

  // Common input patterns
  const patterns = [
    { match: /text|content|input|nachricht|message/i, name: 'input_text', type: 'string', description: 'Main text or content to process' },
    { match: /file|datei|document|dokument/i, name: 'input_file', type: 'file path', description: 'Path to input file or document' },
    { match: /url|link|website|seite/i, name: 'url', type: 'string (URL)', description: 'Target URL to process' },
    { match: /repo|repository|git/i, name: 'repo_path', type: 'string', description: 'Path to the repository' },
    { match: /image|bild|photo|foto/i, name: 'image', type: 'file path', description: 'Path to image file' },
    { match: /data|daten|dataset/i, name: 'data', type: 'object | array', description: 'Input data to analyze or process' },
    { match: /config|konfiguration|settings|einstellungen/i, name: 'config', type: 'object', description: 'Configuration options' },
    { match: /query|abfrage|search|suche/i, name: 'query', type: 'string', description: 'Search query or question' },
    { match: /format|ausgabe|output_format/i, name: 'output_format', type: 'string', description: 'Desired output format (e.g., "json", "markdown", "text")' },
  ];

  for (const p of patterns) {
    if (p.match.test(goalLower)) {
      inputs.push(p);
    }
  }

  // Always have at least one input
  if (inputs.length === 0) {
    inputs.push({ name: 'input', type: 'string', description: 'Primary input for processing' });
  }

  // Add optional context
  inputs.push({ name: 'context', type: 'object (optional)', description: 'Additional context or metadata' });

  return inputs;
}

function generateWorkflow(goal, dod, documents) {
  const steps = [];
  let stepNum = 1;

  // Step 1: Input validation
  steps.push(`${stepNum}. **Input Validation & Preparation**
   - Verify all required inputs are present and well-formed.
   - Normalize input data (encoding, format, structure).
   - Set defaults for optional parameters.`);
  stepNum++;

  // Extract domain-specific steps from documents
  if (documents && documents.length > 0) {
    const docContent = documents.map(d => d.content).join('\n');
    
    // Look for workflow-like patterns in documents
    const workflowHints = extractWorkflowHints(docContent);
    for (const hint of workflowHints.slice(0, 5)) {
      steps.push(`${stepNum}. **${hint.title}**
   - ${hint.details.join('\n   - ')}`);
      stepNum++;
    }
  }

  // Core processing step
  steps.push(`${stepNum}. **Core Processing**
   - Apply the main logic based on the skill's purpose.
   - Process each input element systematically.
   - Track progress and intermediate results.`);
  stepNum++;

  // Analysis/transformation step based on goal keywords
  const goalLower = goal.toLowerCase();
  if (/analy/i.test(goalLower)) {
    steps.push(`${stepNum}. **Analysis & Pattern Recognition**
   - Identify key patterns, trends, and anomalies in the data.
   - Categorize findings by relevance and confidence.
   - Cross-reference results for consistency.`);
    stepNum++;
  }
  if (/generat|erzeu|erstell/i.test(goalLower)) {
    steps.push(`${stepNum}. **Content Generation**
   - Generate output based on analyzed inputs and defined templates.
   - Ensure consistency with style rules and constraints.
   - Validate generated content against quality criteria.`);
    stepNum++;
  }
  if (/valid|prüf|check|verif/i.test(goalLower)) {
    steps.push(`${stepNum}. **Validation & Quality Check**
   - Run all validation rules against the produced output.
   - Flag any inconsistencies or quality issues.
   - Apply auto-corrections where safe to do so.`);
    stepNum++;
  }

  // Self-check
  steps.push(`${stepNum}. **Self-Check & Quality Assurance**
   - Verify output completeness against Definition of Done.
   - Check for edge cases and error conditions.
   - Ensure output format matches specification.`);
  stepNum++;

  // Output assembly
  steps.push(`${stepNum}. **Output Assembly**
   - Compile final results into the specified output format.
   - Include metadata (timestamp, version, processing notes).
   - Return structured output to the user.`);

  // Add DoD as verification step if provided
  if (dod) {
    stepNum++;
    const dodItems = dod.split(/[,;.\n]/).filter(s => s.trim().length > 5).map(s => s.trim());
    steps.push(`${stepNum}. **Definition of Done Verification**
   - ${dodItems.map(d => `✓ ${d}`).join('\n   - ')}`);
  }

  return steps.join('\n\n');
}

function extractWorkflowHints(docContent) {
  const hints = [];
  const lines = docContent.split('\n');
  let currentHint = null;
  let inWorkflowSection = false;

  // Only extract from Workflow/Instructions/Anweisungen sections
  for (const line of lines) {
    const headerMatch = line.match(/^#{1,4}\s+(.+)/);

    // Track if we're in a workflow-related section
    if (headerMatch) {
      const title = headerMatch[1].toLowerCase();
      if (/workflow|anweisungen|instructions|ablauf|prozess|schritte/i.test(title)) {
        inWorkflowSection = true;
      } else if (/^##\s/.test(line)) {
        // New top-level section = leave workflow
        inWorkflowSection = false;
      }
    }

    if (!inWorkflowSection) continue;

    const numberedMatch = line.match(/^\d+[.)]\s+\*?\*?(.+?)\*?\*?\s*$/);
    const boldStepMatch = line.match(/^\d+[.)]\s+\*\*(.+?)\*\*/);

    if (boldStepMatch || numberedMatch) {
      if (currentHint && currentHint.details.length > 0) {
        hints.push(currentHint);
      }
      currentHint = {
        title: (boldStepMatch?.[1] || numberedMatch?.[1] || '').replace(/[*#]/g, '').trim(),
        details: [],
      };
    } else if (currentHint && line.trim().startsWith('-')) {
      const detail = line.trim().replace(/^-\s*/, '');
      if (detail.length > 5 && detail.length < 200) {
        currentHint.details.push(detail);
      }
    }
  }
  if (currentHint && currentHint.details.length > 0) {
    hints.push(currentHint);
  }

  // Only return hints that are actual workflow steps (not section headers like "Wann verwenden")
  return hints.filter(h => 
    h.title.length > 3 && 
    h.details.length > 0 &&
    !/wann verwenden|when to use|eingaben|inputs|ausgabe|output|beispiel|example/i.test(h.title)
  );
}

function generateOutputFormat(goal, documents) {
  const goalLower = goal.toLowerCase();
  let format = '';

  if (/json/i.test(goalLower)) {
    format += `The skill produces a structured JSON output:\n\`\`\`json\n{\n  "status": "success",\n  "data": { ... },\n  "metadata": {\n    "processed_at": "ISO-8601",\n    "version": "1.0"\n  }\n}\n\`\`\`\n`;
  } else if (/markdown|md/i.test(goalLower)) {
    format += `The skill produces a Markdown document with:\n- Title and summary section\n- Structured content sections\n- Code blocks where applicable\n`;
  } else {
    format += `The skill produces structured output containing:\n- Main result data\n- Processing metadata (timestamp, status)\n- Any warnings or notes\n\nBoth human-readable summary and machine-parseable format (JSON) are supported.\n`;
  }

  return format;
}

function generateExamples(goal, inputs, outputFormat) {
  const inputExample = inputs
    .filter(i => !i.name.includes('optional') && i.name !== 'context')
    .map(i => `${i.name}: "${getExampleValue(i)}"`)
    .join(', ');

  return `**Example 1 — Basic Usage**

**Input:**
${inputExample}

**Output:**
A complete result containing the processed data, validated against quality checks, formatted as specified.

**Example 2 — With Options**

**Input:**
${inputExample}, context: { "verbose": true }

**Output:**
Extended result with additional detail, processing notes, and confidence scores.
`;
}

function getExampleValue(input) {
  const examples = {
    'input_text': 'Your sample text content here...',
    'input_file': '/path/to/document.md',
    'url': 'https://example.com/page',
    'repo_path': '/path/to/repository',
    'image': '/path/to/image.png',
    'data': '[structured data]',
    'config': '{ "option": "value" }',
    'query': 'search term or question',
    'output_format': 'json',
    'input': 'sample input data',
  };
  return examples[input.name] || 'example value';
}

/**
 * Local validation of a generated skill
 */
export function validateSkillLocally(skillContent) {
  const issues = [];
  let score = 10;

  // Check frontmatter
  if (!skillContent.startsWith('---')) {
    issues.push({ severity: 'P0', description: 'Missing YAML frontmatter', suggestion: 'Add --- delimited frontmatter with name and description' });
    score -= 3;
  } else {
    if (!/name:\s*.+/i.test(skillContent)) {
      issues.push({ severity: 'P0', description: 'Missing name in frontmatter', suggestion: 'Add name: field' });
      score -= 2;
    }
    if (!/description:\s*.+/i.test(skillContent)) {
      issues.push({ severity: 'P1', description: 'Missing description in frontmatter', suggestion: 'Add description: field' });
      score -= 1;
    }
  }

  // Check required sections
  const requiredSections = [
    { pattern: /##\s*(Wann verwenden|When to Use)/i, name: 'When to Use' },
    { pattern: /##\s*(Eingaben|Inputs)/i, name: 'Inputs' },
    { pattern: /##\s*(Workflow|Instructions|Anweisungen)/i, name: 'Workflow' },
    { pattern: /##\s*(Ausgabeformat|Output Format)/i, name: 'Output Format' },
    { pattern: /##\s*(Beispiele|Examples)/i, name: 'Examples' },
  ];

  for (const sec of requiredSections) {
    if (!sec.pattern.test(skillContent)) {
      issues.push({ severity: 'P1', description: `Missing section: ${sec.name}`, suggestion: `Add ## ${sec.name} section` });
      score -= 1;
    }
  }

  // Check for concrete workflow steps
  const workflowMatch = skillContent.match(/##\s*(Workflow|Instructions|Anweisungen)[\s\S]*?(?=##|$)/i);
  if (workflowMatch) {
    const stepCount = (workflowMatch[0].match(/^\d+\./gm) || []).length;
    if (stepCount < 3) {
      issues.push({ severity: 'P1', description: `Only ${stepCount} workflow steps found`, suggestion: 'Add more detailed steps (aim for 5+)' });
      score -= 1;
    }
  }

  // Check for examples
  const hasExamples = /\*\*Input\*\*|Beispiel|Example/i.test(skillContent);
  if (!hasExamples) {
    issues.push({ severity: 'P2', description: 'No concrete examples found', suggestion: 'Add at least one Input → Output example' });
    score -= 1;
  }

  score = Math.max(1, Math.min(10, score));

  return {
    status: score >= 7 ? 'PASS' : 'NEEDS_REFINEMENT',
    score,
    issues,
    summary: score >= 8 ? 'Skill meets quality standards' : score >= 5 ? 'Acceptable but could be improved' : 'Needs significant improvements',
  };
}
