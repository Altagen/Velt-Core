export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  originalContent: string; // Content when file was opened/saved (for dirty check)
  isDirty: boolean;
  encoding: string;
  language?: string;
}

export interface EditorTheme {
  background: string;
  foreground: string;
  lineHighlight: string;
  selection: string;
  cursor: string;
  selectionMatch?: string;
  searchMatch?: string;           // Background color for all search matches
  searchMatchBorder?: string;     // Border color for all search matches
  searchMatchSelected?: string;   // Background color for current search match
  searchMatchSelectedBorder?: string; // Border color for current search match
}

export interface GutterTheme {
  background: string;
  foreground: string;
  border: string;
}

export interface UiTheme {
  menuBar: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  textColor?: string;
  textSecondary?: string;
  textHoverColor?: string;
  textActiveColor?: string;
  background?: string;
  border?: string;
  accent?: string;
  accentHover?: string;
  accentPrimary?: string;
  accentPrimaryHover?: string;
  accentDanger?: string;
  accentDangerHover?: string;
  iconColor?: string;
  iconActiveColor?: string;
  dirtyIndicator?: string;
  sidebarActive?: string;
  sidebarActiveBorder?: string;
}

export interface IconsTheme {
  file?: string;
  folder?: string;
  save?: string;
  reload?: string;
  settings?: string;
  search?: string;
  replace?: string;
  close?: string;
  warning?: string;
  cursor?: string;
  selection?: string;
  wrap?: string;
  whitespace?: string;
  zoom?: string;
  eol?: string;
  encoding?: string;
  language?: string;
  clock?: string;
  window?: string;
}

export interface Theme {
  name: string;
  editor: EditorTheme;
  gutter: GutterTheme;
  ui: UiTheme;
  icons?: IconsTheme;
}

export interface VeltEditorOptions {
  container: HTMLElement;
  content?: string;
  language?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  theme?: Theme;
  fontSize?: number;
  fontFamily?: string;
  tabSize?: number;
  wordWrap?: boolean;
  showInvisibles?: boolean;
}

export interface TabData {
  id: string;
  filePath: string | null;
  content: string;
  originalContent: string;
  isDirty: boolean;
  encoding: string;
  language?: string;
}
