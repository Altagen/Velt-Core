# Velt Core

Core editor components for building modern code editors. Built on [CodeMirror 6](https://codemirror.net/), Velt Core provides a high-level API for creating feature-rich text editors.

## Features

- **VeltEditor** - A fully-featured code editor with syntax highlighting, search/replace, bookmarks, and more
- **TabManager** - Tab management system for multi-file editing
- **Theme Support** - Customizable themes with editor, gutter, UI, and icon color configuration
- **Language Support** - Built-in syntax highlighting for JavaScript, TypeScript, Python, Rust, HTML, CSS, JSON, and more
- **Framework Agnostic** - Works with React, Svelte, Vue, or vanilla JavaScript

## Installation

```bash
npm install @altagen/velt-core
```

## Quick Start

```typescript
import { VeltEditor } from '@altagen/velt-core';

const editor = new VeltEditor({
  container: document.getElementById('editor'),
  content: 'console.log("Hello, World!");',
  language: 'javascript',
  onChange: (content) => {
    console.log('Content changed:', content);
  }
});
```

## API Reference

### VeltEditor

The main editor class.

```typescript
interface VeltEditorOptions {
  container: HTMLElement;     // DOM element to mount the editor
  content?: string;           // Initial content
  language?: string;          // Language for syntax highlighting
  onChange?: (content: string) => void;
  readOnly?: boolean;
  theme?: Theme;
  fontSize?: number;
  fontFamily?: string;
  tabSize?: number;
  wordWrap?: boolean;
  showInvisibles?: boolean;
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `getContent()` | Get current editor content |
| `setContent(content)` | Set editor content |
| `setLanguage(language)` | Change syntax highlighting language |
| `applyTheme(theme)` | Apply a theme |
| `focus()` | Focus the editor |
| `destroy()` | Destroy the editor instance |
| `find(text, options)` | Search for text |
| `findNext()` | Find next occurrence |
| `findPrevious()` | Find previous occurrence |
| `replace(text)` | Replace current match |
| `replaceAll(text)` | Replace all matches |
| `goToLine(line)` | Jump to a specific line |
| `toggleBookmark()` | Toggle bookmark on current line |
| `nextBookmark()` | Jump to next bookmark |
| `previousBookmark()` | Jump to previous bookmark |

### TabManager

Manages multiple editor tabs.

```typescript
import { TabManager } from '@altagen/velt-core';

const tabManager = new TabManager();

// Add a new tab
const tabId = tabManager.addTab({
  filePath: '/path/to/file.ts',
  content: 'const x = 1;',
  originalContent: 'const x = 1;',
  isDirty: false,
  encoding: 'utf-8',
  language: 'typescript'
});

// Subscribe to changes
tabManager.subscribe((tabs, activeId) => {
  console.log('Tabs updated:', tabs);
});
```

### Theme Interface

```typescript
interface Theme {
  name: string;
  editor: {
    background: string;
    foreground: string;
    lineHighlight: string;
    selection: string;
    cursor: string;
    searchMatch?: string;
    searchMatchSelected?: string;
  };
  gutter: {
    background: string;
    foreground: string;
    border: string;
  };
  ui: {
    menuBar: string;
    tabBar: string;
    tabActive: string;
    tabInactive: string;
    // ... more UI colors
  };
  icons?: {
    file?: string;
    folder?: string;
    save?: string;
    // ... more icon colors
  };
}
```

### Language Detection

```typescript
import { detectLanguageFromPath, getSupportedLanguages } from '@altagen/velt-core';

const language = detectLanguageFromPath('/path/to/file.tsx');
// Returns: 'typescript'

const languages = getSupportedLanguages();
// Returns: ['javascript', 'typescript', 'html', 'css', 'json', ...]
```

### Utilities

```typescript
import { debounce, throttle, generateId, formatFileSize, getFileName } from '@altagen/velt-core';

// Debounce function calls
const debouncedSave = debounce(save, 300);

// Generate unique IDs
const id = generateId();

// Format file sizes
formatFileSize(1024); // "1 KB"

// Get filename from path
getFileName('/path/to/file.txt'); // "file.txt"
```

## Supported Languages

- JavaScript / TypeScript (JSX/TSX)
- HTML
- CSS / SCSS / SASS / LESS
- JSON
- Markdown
- Python
- Rust
- C / C++
- Java
- PHP
- XML / SVG
- SQL

## Framework Examples

### React

```tsx
import { useEffect, useRef } from 'react';
import { VeltEditor, type Theme } from '@altagen/velt-core';

function Editor({ content, onChange, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<VeltEditor | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = new VeltEditor({
        container: containerRef.current,
        content,
        onChange,
        theme
      });
    }

    return () => {
      editorRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
```

### Svelte

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { VeltEditor, type Theme } from '@altagen/velt-core';

  export let content: string;
  export let onChange: (content: string) => void;
  export let theme: Theme;

  let container: HTMLDivElement;
  let editor: VeltEditor;

  onMount(() => {
    editor = new VeltEditor({
      container,
      content,
      onChange,
      theme
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });
</script>

<div bind:this={container} style="height: 100%;"></div>
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/Altagen/Velt-Core).
