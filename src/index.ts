// Core classes
export { VeltEditor } from './core/VeltEditor';
export { TabManager } from './core/TabManager';
export type { TabChangeListener } from './core/TabManager';

// Configuration
export {
  detectLanguageFromPath,
  getLanguageExtension,
  getSupportedLanguages,
  getLanguageDisplayName,
} from './config/languages';

// Types
export type {
  Tab,
  Theme,
  VeltEditorOptions,
  TabData,
} from './types';

// Utilities
export {
  debounce,
  throttle,
  generateId,
  formatFileSize,
  getFileName,
  getFileExtension,
} from './utils';
