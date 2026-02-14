import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import type { Extension } from '@codemirror/state';

export function detectLanguageFromPath(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  const desc = LanguageDescription.matchFilename(languages, filePath);
  return desc?.name.toLowerCase();
}

export async function getLanguageExtension(language?: string): Promise<Extension[]> {
  if (!language) return [];
  const desc = LanguageDescription.matchLanguageName(languages, language, true);
  if (!desc) return [];
  const support = await desc.load();
  return [support];
}

export function getSupportedLanguages(): string[] {
  return languages.map(l => l.name);
}

export function getLanguageDisplayName(language: string): string {
  const desc = LanguageDescription.matchLanguageName(languages, language, true);
  return desc?.name || language;
}
