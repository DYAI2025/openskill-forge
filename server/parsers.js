import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { parseString } from 'xml2js';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

/**
 * Parse any supported document into plain text
 * Supported: .md, .txt, .json, .pdf, .xml, .yaml, .yml, .docx
 */
export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  switch (ext) {
    case '.md':
    case '.txt':
      return buffer.toString('utf-8');

    case '.json':
      return formatJSON(buffer.toString('utf-8'));

    case '.yaml':
    case '.yml':
      return formatYAML(buffer.toString('utf-8'));

    case '.xml':
      return await formatXML(buffer.toString('utf-8'));

    case '.pdf':
      return await parsePDF(buffer);

    case '.docx':
      return await parseDOCX(filePath);

    default:
      // Try as plain text
      return buffer.toString('utf-8');
  }
}

function formatJSON(text) {
  try {
    const obj = JSON.parse(text);
    return `[JSON Document]\n${JSON.stringify(obj, null, 2)}`;
  } catch {
    return `[JSON Document - raw]\n${text}`;
  }
}

function formatYAML(text) {
  try {
    const obj = yaml.load(text);
    return `[YAML Document]\n${yaml.dump(obj, { lineWidth: 120 })}`;
  } catch {
    return `[YAML Document - raw]\n${text}`;
  }
}

function formatXML(text) {
  return new Promise((resolve) => {
    parseString(text, { explicitArray: false }, (err, result) => {
      if (err) {
        resolve(`[XML Document - raw]\n${text}`);
      } else {
        resolve(`[XML Document]\n${JSON.stringify(result, null, 2)}`);
      }
    });
  });
}

async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return `[PDF Document - ${data.numpages} pages]\n${data.text}`;
  } catch (e) {
    return `[PDF Document - parse error: ${e.message}]`;
  }
}

async function parseDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return `[DOCX Document]\n${result.value}`;
  } catch (e) {
    return `[DOCX Document - parse error: ${e.message}]`;
  }
}

/**
 * Parse multiple uploaded files and return combined context
 */
export async function parseAllDocuments(files) {
  const results = [];
  for (const file of files) {
    try {
      const text = await parseDocument(file.path, file.originalname);
      results.push({
        filename: file.originalname,
        content: text,
        size: file.size,
      });
    } catch (e) {
      results.push({
        filename: file.originalname,
        content: `[Parse error: ${e.message}]`,
        size: file.size,
      });
    }
  }
  return results;
}
