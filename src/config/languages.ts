import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';

export function detectLanguageFromPath(filePath: string | null): string | undefined {
  if (!filePath) return undefined;

  const ext = filePath.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    // JavaScript / TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    'less': 'css',
    'xml': 'xml',
    'svg': 'xml',

    // Data
    'json': 'json',
    'jsonc': 'json',

    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',

    // Python
    'py': 'python',
    'pyw': 'python',
    'pyi': 'python',

    // Rust
    'rs': 'rust',

    // C / C++
    'c': 'cpp',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'hh': 'cpp',
    'hxx': 'cpp',

    // Java
    'java': 'java',

    // PHP
    'php': 'php',
    'phtml': 'php',

    // SQL
    'sql': 'sql',
    'mysql': 'sql',
    'pgsql': 'sql',
  };

  return ext ? languageMap[ext] : undefined;
}

export function getLanguageExtension(language?: string): Extension[] {
  if (!language) return [];

  switch (language) {
    case 'javascript':
      return [javascript({ jsx: true, typescript: false })];
    case 'typescript':
      return [javascript({ jsx: true, typescript: true })];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'json':
      return [json()];
    case 'markdown':
      return [markdown()];
    case 'python':
      return [python()];
    case 'rust':
      return [rust()];
    case 'cpp':
      return [cpp()];
    case 'java':
      return [java()];
    case 'php':
      return [php()];
    case 'xml':
      return [xml()];
    case 'sql':
      return [sql()];
    default:
      return [];
  }
}

/**
 * Get list of all supported languages
 */
export function getSupportedLanguages(): string[] {
  return [
    'javascript',
    'typescript',
    'html',
    'css',
    'json',
    'markdown',
    'python',
    'rust',
    'cpp',
    'java',
    'php',
    'xml',
    'sql',
  ];
}

/**
 * Get human-readable name for a language
 */
export function getLanguageDisplayName(language: string): string {
  const displayNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'markdown': 'Markdown',
    'python': 'Python',
    'rust': 'Rust',
    'cpp': 'C/C++',
    'java': 'Java',
    'php': 'PHP',
    'xml': 'XML',
    'sql': 'SQL',
  };

  return displayNames[language] || language;
}
