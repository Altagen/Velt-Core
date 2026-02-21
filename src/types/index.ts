export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  originalContent: string; // Content when file was opened/saved (for dirty check)
  isDirty: boolean;
  encoding: string;
  language?: string;
  isPreview?: boolean;
  sourceTabId?: string;
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

export interface SyntaxTheme {
  keyword?: string;
  string?: string;
  number?: string;
  comment?: string;
  function?: string;
  variable?: string;
  type?: string;
  operator?: string;
  punctuation?: string;
  attribute?: string;
  tag?: string;
  regexp?: string;
  builtin?: string;
  meta?: string;
  property?: string;
  constant?: string;
}

export interface HeadingStyle {
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  borderBottom?: string;
  opacity?: string;
}

export interface CodeSyntaxTheme {
  keyword?: string;
  string?: string;
  comment?: string;
  number?: string;
  function?: string;
  type?: string;
  attribute?: string;
  builtin?: string;
  regexp?: string;
  variable?: string;
  meta?: string;
  tag?: string;
  operator?: string;
  punctuation?: string;
}

export interface AdmonitionStyle {
  background?: string;
  borderColor?: string;
  titleColor?: string;
  textColor?: string;
  icon?: string;
}

export interface AdmonitionsTheme {
  borderRadius?: string;
  borderWidth?: string;
  titleFontWeight?: string;
  info?: AdmonitionStyle;
  warning?: AdmonitionStyle;
  danger?: AdmonitionStyle;
  tip?: AdmonitionStyle;
  note?: AdmonitionStyle;
  custom?: Record<string, AdmonitionStyle>;
}

export interface MarkdownPreviewTheme {
  // General
  background?: string;
  foreground?: string;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  maxWidth?: string;
  padding?: string;

  // Links
  linkColor?: string;
  linkHoverColor?: string;
  linkDecoration?: string;

  // Headings (shared defaults)
  headingColor?: string;
  headingFontFamily?: string;
  headingFontWeight?: string;
  // Per-level heading overrides
  h1?: HeadingStyle;
  h2?: HeadingStyle;
  h3?: HeadingStyle;
  h4?: HeadingStyle;
  h5?: HeadingStyle;
  h6?: HeadingStyle;

  // Blockquotes
  blockquoteBorder?: string;
  blockquoteBackground?: string;
  blockquoteTextColor?: string;
  blockquoteBorderWidth?: string;

  // Code
  codeInlineBg?: string;
  codeInlineColor?: string;
  codeInlineFontFamily?: string;
  codeBlockBg?: string;
  codeBlockColor?: string;
  codeBlockFontFamily?: string;
  codeBlockBorderRadius?: string;
  // Code syntax highlighting in preview
  codeSyntax?: CodeSyntaxTheme;

  // Tables
  tableBorder?: string;
  tableHeaderBackground?: string;
  tableHeaderColor?: string;
  tableRowEvenBg?: string;
  tableRowHoverBg?: string;

  // HR
  hrColor?: string;
  hrStyle?: string;

  // Lists
  listMarkerColor?: string;
  taskListCheckColor?: string;

  // Images
  imageBorderRadius?: string;
  imageBorder?: string;

  // Admonitions
  admonitions?: AdmonitionsTheme;
  // Legacy flat admonition properties (backwards compat)
  admonitionInfoBg?: string;
  admonitionWarningBg?: string;
  admonitionDangerBg?: string;
  admonitionTipBg?: string;
  admonitionNoteBg?: string;

  // KaTeX
  katexColor?: string;
  katexFontSize?: string;

  // Emphasis
  strongColor?: string;
  emphasisColor?: string;
  strikethroughOpacity?: string;
}

export interface Theme {
  name: string;
  editor: EditorTheme;
  gutter: GutterTheme;
  ui: UiTheme;
  icons?: IconsTheme;
  syntax?: SyntaxTheme;
  markdownPreview?: MarkdownPreviewTheme;
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
  autoIndent?: boolean;
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
