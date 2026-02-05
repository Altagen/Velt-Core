import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, highlightWhitespace, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, Panel, Decoration, DecorationSet, gutter, GutterMarker } from '@codemirror/view';
import { EditorState, Extension, Compartment, StateField, StateEffect, RangeSetBuilder, RangeSet } from '@codemirror/state';
import { search, highlightSelectionMatches, SearchQuery, setSearchQuery, findNext as cmFindNext, findPrevious as cmFindPrevious, replaceNext, replaceAll as cmReplaceAll, getSearchQuery } from '@codemirror/search';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { getLanguageExtension } from '../config/languages';
import type { VeltEditorOptions, Theme } from '../types';

// ===== CUSTOM SEARCH HIGHLIGHTING SYSTEM =====
// CodeMirror's search() extension only creates decorations when navigating,
// not when setting the query. We need custom decorations for ALL matches.

interface CustomSearchQuery {
  search: string;
  caseSensitive: boolean;
  regexp: boolean;
  wholeWord: boolean;
  cursorPos: number;
}

// StateEffect to trigger custom search highlighting
const setCustomSearch = StateEffect.define<CustomSearchQuery | null>();

// StateField for search match decorations - applies highlighting to ALL matches
const customSearchHighlight = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Map existing decorations through document changes
    decorations = decorations.map(tr.changes);

    // Check for custom search effect
    for (let effect of tr.effects) {
      if (effect.is(setCustomSearch)) {
        const query = effect.value;

        // Clear decorations if no query
        if (!query || !query.search) {
          return Decoration.none;
        }

        const text = tr.state.doc.toString();
        const builder = new RangeSetBuilder<Decoration>();
        const matches: Array<{ from: number; to: number }> = [];

        // Build regex based on options
        let flags = 'g';
        if (!query.caseSensitive) flags += 'i';

        try {
          let regex: RegExp;
          if (query.regexp) {
            regex = new RegExp(query.search, flags);
          } else if (query.wholeWord) {
            const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`\\b${escaped}\\b`, flags);
          } else {
            const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escaped, flags);
          }

          // Find all matches
          let match;
          while ((match = regex.exec(text)) !== null) {
            const from = match.index;
            const to = from + match[0].length;
            matches.push({ from, to });
          }

          // Create decorations for all matches
          for (const { from, to } of matches) {
            // Determine if this is the current match (cursor is within it)
            const isCurrentMatch = query.cursorPos >= from && query.cursorPos <= to;

            const decoration = Decoration.mark({
              class: isCurrentMatch ? 'cm-searchMatch cm-searchMatch-selected' : 'cm-searchMatch'
            });

            builder.add(from, to, decoration);
          }

          return builder.finish();
        } catch (e) {
          // Invalid regex
          console.error('[customSearchHighlight] Invalid regex:', e);
          return Decoration.none;
        }
      }
    }

    return decorations;
  },
  provide: f => EditorView.decorations.from(f)
});

// ===== BOOKMARKS SYSTEM =====

// StateEffect to toggle bookmarks
const toggleBookmarkEffect = StateEffect.define<number>();

// StateEffect to clear all bookmarks
const clearBookmarksEffect = StateEffect.define<void>();

// StateField to store bookmark line numbers
const bookmarkState = StateField.define<Set<number>>({
  create() {
    return new Set();
  },
  update(bookmarks, tr) {
    // Map bookmarks through document changes
    const newBookmarks = new Set<number>();
    bookmarks.forEach(line => {
      const pos = tr.state.doc.line(Math.min(line, tr.state.doc.lines)).from;
      const newLine = tr.state.doc.lineAt(pos).number;
      newBookmarks.add(newLine);
    });

    // Handle toggle bookmark effect
    for (let effect of tr.effects) {
      if (effect.is(toggleBookmarkEffect)) {
        const line = effect.value;
        if (newBookmarks.has(line)) {
          newBookmarks.delete(line);
        } else {
          newBookmarks.add(line);
        }
      } else if (effect.is(clearBookmarksEffect)) {
        return new Set();
      }
    }

    return newBookmarks;
  }
});

// Gutter marker for bookmarks
class BookmarkMarker extends GutterMarker {
  toDOM() {
    const marker = document.createElement('div');
    marker.className = 'cm-bookmark-marker';
    marker.textContent = '●';
    marker.title = 'Bookmark';
    return marker;
  }
}

const bookmarkMarker = new BookmarkMarker();

// Gutter extension for bookmarks
const bookmarkGutter = gutter({
  class: 'cm-bookmark-gutter',
  markers: view => {
    const bookmarks = view.state.field(bookmarkState);
    const markers: any[] = [];

    bookmarks.forEach(line => {
      if (line <= view.state.doc.lines) {
        const pos = view.state.doc.line(line).from;
        markers.push(bookmarkMarker.range(pos));
      }
    });

    return RangeSet.of(markers, true);
  },
  initialSpacer: () => bookmarkMarker,
});

export class VeltEditor {
  private view: EditorView;
  private container: HTMLElement;
  private onChangeCallback?: (content: string) => void;
  private currentTheme: Theme | null = null;
  private currentLanguage?: string;
  private languageCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private wordWrapCompartment = new Compartment();
  private showInvisiblesCompartment = new Compartment();
  private tabSizeCompartment = new Compartment();
  private gutterCompartment = new Compartment();
  private currentFontSize = 14;
  private currentFontFamily = 'Consolas, Monaco, "Courier New", monospace';

  constructor(options: VeltEditorOptions) {
    this.container = options.container;
    this.onChangeCallback = options.onChange;
    this.currentLanguage = options.language;
    this.currentTheme = options.theme || null;
    this.currentFontSize = options.fontSize || 14;
    this.currentFontFamily = options.fontFamily || 'Consolas, Monaco, "Courier New", monospace';

    const state = EditorState.create({
      doc: options.content || '',
      extensions: [
        // basicSetup WITHOUT drawSelection - we'll use native browser selection
        this.gutterCompartment.of([
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          bookmarkGutter,
        ]),
        bookmarkState,
        highlightSpecialChars(),
        history(),
        // drawSelection(), // REMOVED - use native selection
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        // Note: searchKeymap is intentionally NOT included here - we use custom Find & Replace panel
        // The search() extension provides search functionality without the default panel
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap.filter(kb => {
            // Filter out Ctrl+F and Ctrl+H from default keymap to prevent default search panel
            const key = kb.key;
            return key !== 'Mod-f' && key !== 'Mod-h';
          }),
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
        search(), // Enable search functionality (for findNext/findPrevious commands)
        customSearchHighlight, // Custom search highlighting for ALL matches
        this.languageCompartment.of(getLanguageExtension(this.currentLanguage)),
        this.wordWrapCompartment.of(options.wordWrap ? EditorView.lineWrapping : []),
        this.showInvisiblesCompartment.of(options.showInvisibles ? highlightWhitespace() : []),
        this.tabSizeCompartment.of(EditorState.tabSize.of(options.tabSize || 2)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && this.onChangeCallback) {
            this.onChangeCallback(update.state.doc.toString());
          }
        }),
        EditorView.editable.of(true),
        this.themeCompartment.of(this.createTheme()),
      ],
    });

    this.view = new EditorView({
      state,
      parent: this.container,
    });
  }

  /**
   * Create CodeMirror theme from Theme object
   */
  private createTheme(): Extension {
    const theme = this.currentTheme;
    const fontSize = this.currentFontSize;
    const fontFamily = this.currentFontFamily;

    if (!theme) {
      // Default dark theme
      return EditorView.theme({
        '&': {
          height: '100%',
          width: '100%',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-content': {
          padding: '4px 0 !important',
          caretColor: '#ffffff',
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
        },
        '.cm-gutters': {
          paddingLeft: '0 !important',
          paddingRight: '8px',
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #3e3e42',
          fontSize: `${fontSize}px`,
        },
        '.cm-lineNumbers .cm-gutterElement': {
          color: '#858585',
          paddingRight: '12px',
        },
        '.cm-activeLine': {
          backgroundColor: '#2d2d30 !important',
        },
        '.cm-line.cm-activeLine': {
          backgroundColor: '#2d2d30 !important',
        },
        // Native browser selection - keep text visible
        '& ::selection': {
          backgroundColor: 'rgba(58, 110, 165, 0.3) !important',
          color: '#d4d4d4 !important',
        },
        '& ::-moz-selection': {
          backgroundColor: 'rgba(58, 110, 165, 0.3) !important',
          color: '#d4d4d4 !important',
        },
        // Search match highlighting
        '& .cm-searchMatch': {
          backgroundColor: 'rgba(255, 213, 0, 0.5) !important', // Default yellow
          outline: '2px solid rgba(255, 200, 0, 0.9) !important',
          outlineOffset: '-1px',
          borderRadius: '2px !important',
        },
        // Current selected match
        '& .cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'rgba(255, 100, 0, 0.7) !important', // Default orange
          outline: '3px solid rgba(255, 80, 0, 1) !important',
          outlineOffset: '-1px',
          borderRadius: '2px !important',
        },
        // Force override any conflicting styles
        '& .cm-content .cm-searchMatch': {
          backgroundColor: 'rgba(255, 213, 0, 0.5) !important',
        },
        '& .cm-content .cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'rgba(255, 100, 0, 0.7) !important',
        },
        // Bookmark marker
        '& .cm-bookmark-marker': {
          color: '#00d4aa',
          fontSize: '14px',
          lineHeight: '1',
          cursor: 'pointer',
        },
      });
    }

    // Theme from JSON
    return EditorView.theme({
      '&': {
        height: '100%',
        width: '100%',
        backgroundColor: theme.editor.background,
        color: theme.editor.foreground,
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
      },
      '.cm-scroller': {
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '4px 0 !important',
        caretColor: theme.editor.cursor,
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
      },
      '.cm-gutters': {
        paddingLeft: '0 !important',
        paddingRight: '8px',
        backgroundColor: theme.gutter.background,
        borderRight: `1px solid ${theme.gutter.border}`,
        fontSize: `${fontSize}px`,
      },
      '.cm-lineNumbers .cm-gutterElement': {
        color: theme.gutter.foreground,
        paddingRight: '12px',
      },
      '.cm-activeLine': {
        backgroundColor: `${theme.editor.lineHighlight} !important`,
      },
      '.cm-line.cm-activeLine': {
        backgroundColor: `${theme.editor.lineHighlight} !important`,
      },
      // Native browser selection - keep text visible
      '& ::selection': {
        backgroundColor: `${theme.editor.selection} !important`,
        color: `${theme.editor.foreground} !important`,
      },
      '& ::-moz-selection': {
        backgroundColor: `${theme.editor.selection} !important`,
        color: `${theme.editor.foreground} !important`,
      },
      // Search match highlighting - all matches
      '& .cm-searchMatch': {
        backgroundColor: `${theme.editor.searchMatch || 'rgba(255, 213, 0, 0.5)'} !important`,
        outline: `2px solid ${theme.editor.searchMatchBorder || 'rgba(255, 200, 0, 0.9)'} !important`,
        outlineOffset: '-1px',
        borderRadius: '2px !important',
      },
      // Current selected match
      '& .cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: `${theme.editor.searchMatchSelected || 'rgba(255, 100, 0, 0.7)'} !important`,
        outline: `3px solid ${theme.editor.searchMatchSelectedBorder || 'rgba(255, 80, 0, 1)'} !important`,
        outlineOffset: '-1px',
        borderRadius: '2px !important',
      },
      // Force override any conflicting styles
      '& .cm-content .cm-searchMatch': {
        backgroundColor: `${theme.editor.searchMatch || 'rgba(255, 213, 0, 0.5)'} !important`,
      },
      '& .cm-content .cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: `${theme.editor.searchMatchSelected || 'rgba(255, 100, 0, 0.7)'} !important`,
      },
      // Bookmark marker
      '& .cm-bookmark-marker': {
        color: theme.ui.accentPrimary || '#00d4aa',
        fontSize: '14px',
        lineHeight: '1',
        cursor: 'pointer',
      },
    });
  }

  /**
   * Get current content from the editor
   */
  getContent(): string {
    return this.view.state.doc.toString();
  }

  /**
   * Set content in the editor
   */
  setContent(content: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    });
  }

  /**
   * Set the language for syntax highlighting
   */
  setLanguage(language: string): void {
    this.currentLanguage = language;
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(getLanguageExtension(language)),
    });
  }

  /**
   * Apply a theme to the editor
   */
  applyTheme(theme: Theme): void {
    this.currentTheme = theme;
    const newTheme = this.createTheme();
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(newTheme),
    });
  }

  /**
   * Get the current theme
   */
  getTheme(): Theme | null {
    return this.currentTheme;
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.view.focus();
  }

  /**
   * Destroy the editor instance
   */
  destroy(): void {
    this.view.destroy();
  }

  /**
   * Get the underlying EditorView instance (for advanced usage)
   */
  getView(): EditorView {
    return this.view;
  }

  /**
   * Search for text in the editor
   * @param searchText - The text to search for
   * @param options - Search options (caseSensitive, regexp, wholeWord)
   * @returns Object with match count and current match index
   */
  find(searchText: string, options?: { caseSensitive?: boolean; regexp?: boolean; wholeWord?: boolean }): { count: number; currentIndex: number } {
    if (!searchText) {
      this.clearSearch();
      return { count: 0, currentIndex: 0 };
    }

    const query = new SearchQuery({
      search: searchText,
      caseSensitive: options?.caseSensitive || false,
      regexp: options?.regexp || false,
      wholeWord: options?.wholeWord || false,
    });

    // Set the CodeMirror search query (needed for findNext/findPrevious to work)
    this.view.dispatch({
      effects: setSearchQuery.of(query),
      selection: this.view.state.selection, // Preserve selection
    });

    // Trigger our custom search highlighting to show ALL matches immediately
    const cursorPos = this.view.state.selection.main.from;
    this.view.dispatch({
      effects: setCustomSearch.of({
        search: searchText,
        caseSensitive: options?.caseSensitive || false,
        regexp: options?.regexp || false,
        wholeWord: options?.wholeWord || false,
        cursorPos,
      }),
    });

    // Count matches
    const matches = this.countMatches(searchText, options);
    const currentIndex = this.getCurrentMatchIndex(searchText, options);

    return { count: matches, currentIndex };
  }

  /**
   * Find first occurrence (from start of document)
   */
  findFirst(): boolean {
    // Move cursor to start of document
    this.view.dispatch({
      selection: { anchor: 0, head: 0 },
    });
    // Then find next from there
    const result = cmFindNext(this.view);

    // Update custom decorations with new cursor position
    this.updateCustomSearchHighlight();

    return result;
  }

  /**
   * Find next occurrence and move cursor to it
   */
  findNext(): boolean {
    const result = cmFindNext(this.view);

    // Update custom decorations with new cursor position
    this.updateCustomSearchHighlight();

    return result;
  }

  /**
   * Find previous occurrence and move cursor to it
   */
  findPrevious(): boolean {
    const result = cmFindPrevious(this.view);

    // Update custom decorations with new cursor position
    this.updateCustomSearchHighlight();

    return result;
  }

  /**
   * Update custom search highlighting with current cursor position
   * This re-applies decorations to highlight the current match differently
   */
  private updateCustomSearchHighlight(): void {
    const query = getSearchQuery(this.view.state);
    if (!query || !query.search) {
      return;
    }

    const cursorPos = this.view.state.selection.main.from;
    this.view.dispatch({
      effects: setCustomSearch.of({
        search: query.search,
        caseSensitive: query.caseSensitive,
        regexp: query.regexp,
        wholeWord: query.wholeWord,
        cursorPos,
      }),
    });
  }

  /**
   * Get current search information (count and current index)
   */
  getSearchInfo(): { count: number; currentIndex: number } {
    const query = getSearchQuery(this.view.state);
    if (!query || !query.search) {
      return { count: 0, currentIndex: 0 };
    }

    const count = this.countMatches(query.search, {
      caseSensitive: query.caseSensitive,
      regexp: query.regexp,
      wholeWord: query.wholeWord,
    });

    const currentIndex = this.getCurrentMatchIndex(query.search, {
      caseSensitive: query.caseSensitive,
      regexp: query.regexp,
      wholeWord: query.wholeWord,
    });

    return { count, currentIndex };
  }

  /**
   * Replace current match with replacement text
   * @param replaceText - The replacement text
   */
  replace(replaceText: string): void {
    // First set the replacement text in the search query
    const currentQuery = getSearchQuery(this.view.state);
    if (currentQuery) {
      const newQuery = new SearchQuery({
        search: currentQuery.search,
        caseSensitive: currentQuery.caseSensitive,
        regexp: currentQuery.regexp,
        wholeWord: currentQuery.wholeWord,
        replace: replaceText,
      });

      this.view.dispatch({
        effects: setSearchQuery.of(newQuery),
      });
    }

    // Then replace current match
    replaceNext(this.view);
  }

  /**
   * Replace all matches with replacement text
   * @param replaceText - The replacement text
   */
  replaceAll(replaceText: string): void {
    // First set the replacement text in the search query
    const currentQuery = getSearchQuery(this.view.state);
    if (currentQuery) {
      const newQuery = new SearchQuery({
        search: currentQuery.search,
        caseSensitive: currentQuery.caseSensitive,
        regexp: currentQuery.regexp,
        wholeWord: currentQuery.wholeWord,
        replace: replaceText,
      });

      this.view.dispatch({
        effects: setSearchQuery.of(newQuery),
      });
    }

    // Then replace all
    cmReplaceAll(this.view);
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    // Clear both CodeMirror's search query and our custom decorations
    this.view.dispatch({
      effects: [
        setSearchQuery.of(new SearchQuery({ search: '' })),
        setCustomSearch.of(null),
      ],
    });
  }

  /**
   * Count total matches in the document
   */
  private countMatches(searchText: string, options?: { caseSensitive?: boolean; regexp?: boolean; wholeWord?: boolean }): number {
    if (!searchText) return 0;

    const content = this.view.state.doc.toString();
    let count = 0;

    try {
      if (options?.regexp) {
        const flags = options.caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(searchText, flags);
        const matches = content.match(regex);
        count = matches ? matches.length : 0;
      } else {
        let searchContent = content;
        let searchPattern = searchText;

        if (!options?.caseSensitive) {
          searchContent = content.toLowerCase();
          searchPattern = searchText.toLowerCase();
        }

        if (options?.wholeWord) {
          const regex = new RegExp(`\\b${this.escapeRegExp(searchPattern)}\\b`, options.caseSensitive ? 'g' : 'gi');
          const matches = content.match(regex);
          count = matches ? matches.length : 0;
        } else {
          let pos = 0;
          while ((pos = searchContent.indexOf(searchPattern, pos)) !== -1) {
            count++;
            pos += searchPattern.length;
          }
        }
      }
    } catch (e) {
      // Invalid regex
      count = 0;
    }

    return count;
  }

  /**
   * Get the index of the current match (1-based for display)
   */
  private getCurrentMatchIndex(searchText: string, options?: { caseSensitive?: boolean; regexp?: boolean; wholeWord?: boolean }): number {
    if (!searchText) return 0;

    const totalMatches = this.countMatches(searchText, options);
    if (totalMatches === 0) return 0;

    // Get cursor position - use 'from' which is the start of the selection
    const cursorPos = this.view.state.selection.main.from;
    const content = this.view.state.doc.toString();

    // Collect all match positions
    const matchPositions: number[] = [];

    try {
      if (options?.regexp) {
        const flags = options.caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(searchText, flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          matchPositions.push(match.index);
        }
      } else {
        let searchContent = content;
        let searchPattern = searchText;

        if (!options?.caseSensitive) {
          searchContent = content.toLowerCase();
          searchPattern = searchText.toLowerCase();
        }

        if (options?.wholeWord) {
          const regex = new RegExp(`\\b${this.escapeRegExp(searchPattern)}\\b`, options.caseSensitive ? 'g' : 'gi');
          let match;

          while ((match = regex.exec(content)) !== null) {
            matchPositions.push(match.index);
          }
        } else {
          let pos = 0;
          while ((pos = searchContent.indexOf(searchPattern, pos)) !== -1) {
            matchPositions.push(pos);
            pos += searchPattern.length;
          }
        }
      }

      // Find which match contains or is closest to the cursor
      for (let i = 0; i < matchPositions.length; i++) {
        const matchPos = matchPositions[i];
        const matchEnd = matchPos + searchText.length;

        // If cursor is within this match or before it, this is the current match
        if (cursorPos >= matchPos && cursorPos <= matchEnd) {
          return i + 1; // 1-based
        }
        if (cursorPos < matchPos) {
          return i + 1; // 1-based
        }
      }

      // If we're here, cursor is after all matches, so we're at the last one
      return matchPositions.length;

    } catch (e) {
      return 1;
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get total number of lines in the document
   */
  getLineCount(): number {
    return this.view.state.doc.lines;
  }

  /**
   * Go to a specific line number
   * @param lineNumber - The line number to jump to (1-based)
   */
  goToLine(lineNumber: number): void {
    const doc = this.view.state.doc;

    // Validate line number
    if (lineNumber < 1 || lineNumber > doc.lines) {
      console.error(`[VeltEditor] Invalid line number: ${lineNumber}. Document has ${doc.lines} lines.`);
      return;
    }

    // Get the line object (CodeMirror uses 1-based line numbers internally)
    const line = doc.line(lineNumber);

    // Move cursor to the start of the line
    this.view.dispatch({
      selection: { anchor: line.from, head: line.from },
      scrollIntoView: true,
    });

    // Focus the editor
    this.view.focus();
  }

  /**
   * Get cursor position (line and column, 1-based)
   */
  getCursorPosition(): { line: number; column: number } {
    const pos = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(pos);
    return {
      line: line.number, // 1-based
      column: pos - line.from + 1, // 1-based
    };
  }

  /**
   * Get document statistics
   */
  getDocumentStats(): { lines: number; chars: number } {
    return {
      lines: this.view.state.doc.lines,
      chars: this.view.state.doc.length,
    };
  }

  /**
   * Get selection information
   */
  getSelectionInfo(): { length: number; text: string } {
    const selection = this.view.state.selection.main;
    const text = this.view.state.doc.sliceString(selection.from, selection.to);
    return {
      length: selection.to - selection.from,
      text,
    };
  }

  /**
   * Register a callback for cursor/selection changes
   */
  onCursorChange(callback: () => void): void {
    // Store the callback for potential cleanup later
    this.view.dom.addEventListener('mouseup', callback);
    this.view.dom.addEventListener('keyup', callback);
  }

  /**
   * Duplicate current line or selection (Ctrl+D)
   */
  duplicateLine(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);

    if (selection.empty) {
      // No selection - duplicate the entire line
      const lineText = line.text;
      const insertPos = line.to;
      const textToInsert = '\n' + lineText;

      this.view.dispatch({
        changes: { from: insertPos, insert: textToInsert },
        selection: { anchor: insertPos + textToInsert.length }
      });
    } else {
      // Has selection - duplicate the selected text
      const selectedText = state.doc.sliceString(selection.from, selection.to);
      const insertPos = selection.to;

      this.view.dispatch({
        changes: { from: insertPos, insert: selectedText },
        selection: { anchor: insertPos, head: insertPos + selectedText.length }
      });
    }
  }

  /**
   * Delete current line (Ctrl+Shift+K)
   */
  deleteLine(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);

    // Delete the entire line including the newline
    const from = line.from;
    const to = line.to < state.doc.length ? line.to + 1 : line.to;

    this.view.dispatch({
      changes: { from, to, insert: '' },
      selection: { anchor: from }
    });
  }

  /**
   * Move current line up (Alt+Up)
   */
  moveLineUp(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const currentLine = state.doc.lineAt(selection.from);

    // Can't move first line up
    if (currentLine.number === 1) return;

    const prevLine = state.doc.line(currentLine.number - 1);
    const currentLineText = currentLine.text;
    const prevLineText = prevLine.text;

    this.view.dispatch({
      changes: [
        { from: prevLine.from, to: prevLine.to, insert: currentLineText },
        { from: currentLine.from, to: currentLine.to, insert: prevLineText }
      ],
      selection: { anchor: prevLine.from + (selection.from - currentLine.from) }
    });
  }

  /**
   * Move current line down (Alt+Down)
   */
  moveLineDown(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const currentLine = state.doc.lineAt(selection.from);

    // Can't move last line down
    if (currentLine.number === state.doc.lines) return;

    const nextLine = state.doc.line(currentLine.number + 1);
    const currentLineText = currentLine.text;
    const nextLineText = nextLine.text;

    this.view.dispatch({
      changes: [
        { from: currentLine.from, to: currentLine.to, insert: nextLineText },
        { from: nextLine.from, to: nextLine.to, insert: currentLineText }
      ],
      selection: { anchor: nextLine.from + (selection.from - currentLine.from) }
    });
  }

  /**
   * Toggle line comment (Ctrl+/)
   * Supports common comment styles based on language
   */
  toggleLineComment(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);

    // Determine comment syntax based on language
    const commentChar = this.getCommentSyntax();
    if (!commentChar) return;

    const lineText = line.text;
    const trimmed = lineText.trim();

    if (trimmed.startsWith(commentChar)) {
      // Uncomment: remove comment characters
      const commentIndex = lineText.indexOf(commentChar);
      const newText = lineText.substring(0, commentIndex) + lineText.substring(commentIndex + commentChar.length).replace(/^\s/, '');

      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: selection.from - commentChar.length - 1 }
      });
    } else {
      // Comment: add comment characters
      const indent = lineText.match(/^\s*/)?.[0] || '';
      const newText = indent + commentChar + ' ' + lineText.substring(indent.length);

      this.view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: selection.from + commentChar.length + 1 }
      });
    }
  }

  /**
   * Get comment syntax for current language
   */
  private getCommentSyntax(): string {
    const lang = this.currentLanguage?.toLowerCase() || '';

    // JavaScript/TypeScript/C/C++/Java/etc
    if (['javascript', 'typescript', 'jsx', 'tsx', 'c', 'cpp', 'java', 'rust', 'go', 'swift', 'kotlin', 'csharp', 'php'].includes(lang)) {
      return '//';
    }

    // Python/Ruby/Bash/YAML
    if (['python', 'ruby', 'bash', 'shell', 'yaml', 'yml', 'perl', 'r'].includes(lang)) {
      return '#';
    }

    // HTML/XML
    if (['html', 'xml'].includes(lang)) {
      return '<!--';
    }

    // CSS/SCSS/LESS
    if (['css', 'scss', 'sass', 'less'].includes(lang)) {
      return '/*';
    }

    // SQL
    if (['sql'].includes(lang)) {
      return '--';
    }

    // Default to //
    return '//';
  }

  /**
   * Indent selection or current line (Tab)
   */
  indentSelection(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    if (selection.empty) {
      // No selection - insert tab at cursor
      this.view.dispatch({
        changes: { from: selection.from, insert: '  ' }, // 2 spaces
        selection: { anchor: selection.from + 2 }
      });
    } else {
      // Has selection - indent all lines in selection
      const startLine = state.doc.lineAt(selection.from);
      const endLine = state.doc.lineAt(selection.to);

      const changes: Array<{ from: number; to: number; insert: string }> = [];

      for (let i = startLine.number; i <= endLine.number; i++) {
        const line = state.doc.line(i);
        changes.push({ from: line.from, to: line.from, insert: '  ' });
      }

      this.view.dispatch({
        changes,
        selection: { anchor: selection.from + 2, head: selection.to + (changes.length * 2) }
      });
    }
  }

  /**
   * Outdent selection or current line (Shift+Tab)
   */
  outdentSelection(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const startLine = state.doc.lineAt(selection.from);
    const endLine = state.doc.lineAt(selection.to);

    const changes: Array<{ from: number; to: number; insert: string }> = [];
    let totalRemoved = 0;

    for (let i = startLine.number; i <= endLine.number; i++) {
      const line = state.doc.line(i);
      const lineText = line.text;

      // Remove up to 2 spaces or 1 tab from the beginning
      if (lineText.startsWith('  ')) {
        changes.push({ from: line.from, to: line.from + 2, insert: '' });
        totalRemoved += 2;
      } else if (lineText.startsWith('\t')) {
        changes.push({ from: line.from, to: line.from + 1, insert: '' });
        totalRemoved += 1;
      } else if (lineText.startsWith(' ')) {
        changes.push({ from: line.from, to: line.from + 1, insert: '' });
        totalRemoved += 1;
      }
    }

    if (changes.length > 0) {
      this.view.dispatch({
        changes,
        selection: { anchor: Math.max(startLine.from, selection.from - totalRemoved), head: selection.to - totalRemoved }
      });
    }
  }

  /**
   * Convert selected text to UPPERCASE
   */
  convertToUppercase(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    if (selection.empty) {
      // No selection - do nothing
      return;
    }

    const selectedText = state.doc.sliceString(selection.from, selection.to);
    const uppercaseText = selectedText.toUpperCase();

    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: uppercaseText },
      selection: { anchor: selection.from, head: selection.to }
    });
  }

  /**
   * Convert selected text to lowercase
   */
  convertToLowercase(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    if (selection.empty) {
      // No selection - do nothing
      return;
    }

    const selectedText = state.doc.sliceString(selection.from, selection.to);
    const lowercaseText = selectedText.toLowerCase();

    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: lowercaseText },
      selection: { anchor: selection.from, head: selection.to }
    });
  }

  /**
   * Convert selected text to Title Case
   */
  convertToTitleCase(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    if (selection.empty) {
      // No selection - do nothing
      return;
    }

    const selectedText = state.doc.sliceString(selection.from, selection.to);

    // Convert to title case: capitalize first letter of each word
    const titleCaseText = selectedText.replace(/\b\w/g, char => char.toUpperCase());

    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: titleCaseText },
      selection: { anchor: selection.from, head: selection.to }
    });
  }

  /**
   * Invert case of selected text (uppercase -> lowercase, lowercase -> uppercase)
   */
  invertCase(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    if (selection.empty) {
      // No selection - do nothing
      return;
    }

    const selectedText = state.doc.sliceString(selection.from, selection.to);

    // Invert each character's case
    const invertedText = selectedText.split('').map(char => {
      if (char === char.toUpperCase() && char !== char.toLowerCase()) {
        return char.toLowerCase();
      } else if (char === char.toLowerCase() && char !== char.toUpperCase()) {
        return char.toUpperCase();
      }
      return char;
    }).join('');

    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: invertedText },
      selection: { anchor: selection.from, head: selection.to }
    });
  }

  /**
   * Sort selected lines in ascending order (A-Z)
   * If no selection, sorts all lines in document
   */
  sortLinesAscending(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    let startLine: number;
    let endLine: number;

    if (selection.empty) {
      // No selection - sort all lines
      startLine = 1;
      endLine = state.doc.lines;
    } else {
      // Sort selected lines
      startLine = state.doc.lineAt(selection.from).number;
      endLine = state.doc.lineAt(selection.to).number;
    }

    // Extract lines
    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lines.push(state.doc.line(i).text);
    }

    // Sort ascending (A-Z)
    const sortedLines = [...lines].sort((a, b) => a.localeCompare(b));

    // Check if anything changed
    const hasChanged = lines.some((line, index) => line !== sortedLines[index]);
    if (!hasChanged) {
      return; // Already sorted
    }

    // Replace lines with sorted version
    const fromPos = state.doc.line(startLine).from;
    const toPos = state.doc.line(endLine).to;
    const sortedText = sortedLines.join('\n');

    this.view.dispatch({
      changes: { from: fromPos, to: toPos, insert: sortedText },
      selection: { anchor: fromPos, head: fromPos + sortedText.length }
    });
  }

  /**
   * Sort selected lines in descending order (Z-A)
   * If no selection, sorts all lines in document
   */
  sortLinesDescending(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    let startLine: number;
    let endLine: number;

    if (selection.empty) {
      // No selection - sort all lines
      startLine = 1;
      endLine = state.doc.lines;
    } else {
      // Sort selected lines
      startLine = state.doc.lineAt(selection.from).number;
      endLine = state.doc.lineAt(selection.to).number;
    }

    // Extract lines
    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lines.push(state.doc.line(i).text);
    }

    // Sort descending (Z-A)
    const sortedLines = [...lines].sort((a, b) => b.localeCompare(a));

    // Check if anything changed
    const hasChanged = lines.some((line, index) => line !== sortedLines[index]);
    if (!hasChanged) {
      return; // Already sorted
    }

    // Replace lines with sorted version
    const fromPos = state.doc.line(startLine).from;
    const toPos = state.doc.line(endLine).to;
    const sortedText = sortedLines.join('\n');

    this.view.dispatch({
      changes: { from: fromPos, to: toPos, insert: sortedText },
      selection: { anchor: fromPos, head: fromPos + sortedText.length }
    });
  }

  /**
   * Remove duplicate lines (keeping first occurrence)
   * If no selection, removes duplicates from entire document
   */
  removeDuplicateLines(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    let startLine: number;
    let endLine: number;

    if (selection.empty) {
      // No selection - process all lines
      startLine = 1;
      endLine = state.doc.lines;
    } else {
      // Process selected lines
      startLine = state.doc.lineAt(selection.from).number;
      endLine = state.doc.lineAt(selection.to).number;
    }

    // Extract lines
    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lines.push(state.doc.line(i).text);
    }

    // Remove duplicates (keep first occurrence)
    const seen = new Set<string>();
    const uniqueLines: string[] = [];

    for (const line of lines) {
      if (!seen.has(line)) {
        seen.add(line);
        uniqueLines.push(line);
      }
    }

    // Check if anything changed
    if (uniqueLines.length === lines.length) {
      return; // No duplicates found
    }

    // Replace lines with deduplicated version
    const fromPos = state.doc.line(startLine).from;
    const toPos = state.doc.line(endLine).to;
    const uniqueText = uniqueLines.join('\n');

    this.view.dispatch({
      changes: { from: fromPos, to: toPos, insert: uniqueText },
      selection: { anchor: fromPos, head: fromPos + uniqueText.length }
    });
  }

  /**
   * Trim trailing whitespace (spaces and tabs) from lines
   * If no selection, processes entire document
   */
  trimTrailingSpaces(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    let startLine: number;
    let endLine: number;

    if (selection.empty) {
      // No selection - process all lines
      startLine = 1;
      endLine = state.doc.lines;
    } else {
      // Process selected lines
      startLine = state.doc.lineAt(selection.from).number;
      endLine = state.doc.lineAt(selection.to).number;
    }

    // Extract and trim lines
    const lines: string[] = [];
    let hasChanged = false;

    for (let i = startLine; i <= endLine; i++) {
      const originalLine = state.doc.line(i).text;
      const trimmedLine = originalLine.replace(/[ \t]+$/, ''); // Remove trailing spaces and tabs

      if (originalLine !== trimmedLine) {
        hasChanged = true;
      }

      lines.push(trimmedLine);
    }

    // Check if anything changed
    if (!hasChanged) {
      return; // No trailing spaces found
    }

    // Replace lines with trimmed version
    const fromPos = state.doc.line(startLine).from;
    const toPos = state.doc.line(endLine).to;
    const trimmedText = lines.join('\n');

    this.view.dispatch({
      changes: { from: fromPos, to: toPos, insert: trimmedText },
      selection: { anchor: fromPos, head: fromPos + trimmedText.length }
    });
  }

  /**
   * Remove blank lines (empty lines or lines containing only whitespace)
   * If no selection, processes entire document
   */
  removeBlankLines(): void {
    const state = this.view.state;
    const selection = state.selection.main;

    let startLine: number;
    let endLine: number;

    if (selection.empty) {
      // No selection - process all lines
      startLine = 1;
      endLine = state.doc.lines;
    } else {
      // Process selected lines
      startLine = state.doc.lineAt(selection.from).number;
      endLine = state.doc.lineAt(selection.to).number;
    }

    // Extract lines and filter out blank ones
    const lines: string[] = [];
    let hasChanged = false;

    for (let i = startLine; i <= endLine; i++) {
      const lineText = state.doc.line(i).text;

      // Check if line is blank (empty or only whitespace)
      if (lineText.trim() === '') {
        hasChanged = true;
        // Skip this line (don't add to array)
      } else {
        lines.push(lineText);
      }
    }

    // Check if anything changed
    if (!hasChanged) {
      return; // No blank lines found
    }

    // Replace lines with non-blank version
    const fromPos = state.doc.line(startLine).from;
    const toPos = state.doc.line(endLine).to;
    const nonBlankText = lines.join('\n');

    this.view.dispatch({
      changes: { from: fromPos, to: toPos, insert: nonBlankText },
      selection: { anchor: fromPos, head: fromPos + nonBlankText.length }
    });
  }

  /**
   * Convert all line endings to LF (Unix/Linux style: \n)
   */
  convertToLF(): void {
    const content = this.view.state.doc.toString();

    // Replace CRLF (\r\n) and CR (\r) with LF (\n)
    const convertedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Check if anything changed
    if (content === convertedContent) {
      return;
    }

    // Replace entire document
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: convertedContent },
      selection: this.view.state.selection
    });
  }

  /**
   * Convert all line endings to CRLF (Windows style: \r\n)
   */
  convertToCRLF(): void {
    const content = this.view.state.doc.toString();

    // First normalize all to LF, then convert to CRLF
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const convertedContent = normalizedContent.replace(/\n/g, '\r\n');

    // Check if anything changed
    if (content === convertedContent) {
      return;
    }

    // Replace entire document
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: convertedContent },
      selection: this.view.state.selection
    });
  }

  /**
   * Convert all line endings to CR (Old Mac style: \r)
   */
  convertToCR(): void {
    const content = this.view.state.doc.toString();

    // First normalize all to LF, then convert to CR
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const convertedContent = normalizedContent.replace(/\n/g, '\r');

    // Check if anything changed
    if (content === convertedContent) {
      return;
    }

    // Replace entire document
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: convertedContent },
      selection: this.view.state.selection
    });
  }

  /**
   * Detect the line ending style used in the document
   * Returns 'LF', 'CRLF', 'CR', or 'MIXED'
   */
  detectLineEnding(): string {
    const content = this.view.state.doc.toString();

    const hasCRLF = content.includes('\r\n');
    const hasCR = content.includes('\r') && !content.includes('\r\n');
    const hasLF = content.includes('\n') && !content.includes('\r\n');

    // If document has no line breaks, default to LF
    if (!hasCRLF && !hasCR && !hasLF) {
      return 'LF';
    }

    // Count each type
    let crlfCount = 0;
    let crCount = 0;
    let lfCount = 0;

    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\r') {
        if (content[i + 1] === '\n') {
          crlfCount++;
          i++; // Skip the \n
        } else {
          crCount++;
        }
      } else if (content[i] === '\n') {
        lfCount++;
      }
    }

    // Determine predominant type
    const total = crlfCount + crCount + lfCount;
    if (total === 0) return 'LF';

    // If more than one type exists (more than 10% minority), it's mixed
    const crlfPercent = (crlfCount / total) * 100;
    const crPercent = (crCount / total) * 100;
    const lfPercent = (lfCount / total) * 100;

    const typesPresent = [
      crlfCount > 0 ? 1 : 0,
      crCount > 0 ? 1 : 0,
      lfCount > 0 ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    if (typesPresent > 1 && Math.min(crlfPercent, crPercent, lfPercent) > 10) {
      return 'MIXED';
    }

    // Return the predominant type
    if (crlfCount >= crCount && crlfCount >= lfCount) {
      return 'CRLF';
    } else if (crCount >= lfCount) {
      return 'CR';
    } else {
      return 'LF';
    }
  }

  /**
   * Set font size for the editor
   */
  setFontSize(size: number): void {
    this.currentFontSize = size;

    // Reconfigure theme and gutter
    this.view.dispatch({
      effects: [
        this.themeCompartment.reconfigure(this.createTheme()),
        this.gutterCompartment.reconfigure([
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          bookmarkGutter,
        ])
      ]
    });

    // Force DOM reflow to recalculate gutter dimensions
    void this.view.dom.offsetHeight;

    // Force CodeMirror to measure again after reflow
    this.view.requestMeasure();
  }

  /**
   * Set font family for the editor
   */
  setFontFamily(family: string): void {
    this.currentFontFamily = family;
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(this.createTheme())
    });
  }

  /**
   * Set tab size (number of spaces)
   */
  setTabSize(size: number): void {
    this.view.dispatch({
      effects: this.tabSizeCompartment.reconfigure(EditorState.tabSize.of(size))
    });
  }

  /**
   * Enable or disable word wrap
   */
  setWordWrap(enabled: boolean): void {
    this.view.dispatch({
      effects: this.wordWrapCompartment.reconfigure(enabled ? EditorView.lineWrapping : [])
    });
  }

  /**
   * Show or hide invisible characters (spaces, tabs, etc.)
   */
  setShowInvisibles(enabled: boolean): void {
    this.view.dispatch({
      effects: this.showInvisiblesCompartment.reconfigure(enabled ? highlightWhitespace() : [])
    });
  }

  /**
   * Toggle bookmark on current line
   */
  toggleBookmark(): void {
    const state = this.view.state;
    const cursorLine = state.doc.lineAt(state.selection.main.head).number;

    this.view.dispatch({
      effects: toggleBookmarkEffect.of(cursorLine)
    });
  }

  /**
   * Jump to next bookmark
   */
  nextBookmark(): void {
    const state = this.view.state;
    const bookmarks = state.field(bookmarkState);
    const currentLine = state.doc.lineAt(state.selection.main.head).number;

    if (bookmarks.size === 0) {
      return;
    }

    // Find next bookmark after current line
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => a - b);
    let nextLine = sortedBookmarks.find(line => line > currentLine);

    // If no bookmark after current line, wrap to first bookmark
    if (nextLine === undefined) {
      nextLine = sortedBookmarks[0];
    }

    // Jump to the bookmark line
    const pos = state.doc.line(nextLine).from;
    this.view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true
    });
  }

  /**
   * Jump to previous bookmark
   */
  previousBookmark(): void {
    const state = this.view.state;
    const bookmarks = state.field(bookmarkState);
    const currentLine = state.doc.lineAt(state.selection.main.head).number;

    if (bookmarks.size === 0) {
      return;
    }

    // Find previous bookmark before current line
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => b - a); // reverse order
    let prevLine = sortedBookmarks.find(line => line < currentLine);

    // If no bookmark before current line, wrap to last bookmark
    if (prevLine === undefined) {
      prevLine = sortedBookmarks[0];
    }

    // Jump to the bookmark line
    const pos = state.doc.line(prevLine).from;
    this.view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true
    });
  }

  /**
   * Clear all bookmarks
   */
  clearBookmarks(): void {
    this.view.dispatch({
      effects: clearBookmarksEffect.of()
    });
  }
}
