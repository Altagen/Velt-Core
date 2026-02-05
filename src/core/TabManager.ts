import type { TabData } from '../types';

export type TabChangeListener = (tabs: TabData[], activeId: string | null) => void;

export class TabManager {
  private tabs: Map<string, TabData> = new Map();
  private activeTabId: string | null = null;
  private listeners: Set<TabChangeListener> = new Set();

  /**
   * Add a new tab
   */
  addTab(data: Omit<TabData, 'id'>): string {
    const id = crypto.randomUUID();
    const tab: TabData = { ...data, id };
    this.tabs.set(id, tab);
    this.activeTabId = id;
    this.notify();
    return id;
  }

  /**
   * Remove a tab by ID
   */
  removeTab(tabId: string): void {
    this.tabs.delete(tabId);

    // If we removed the active tab, activate the last tab
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    this.notify();
  }

  /**
   * Update tab content
   */
  updateTabContent(tabId: string, content: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.content = content;
      tab.isDirty = true;
      this.notify();
    }
  }

  /**
   * Update tab file info (path, content, encoding)
   */
  updateTabFile(tabId: string, filePath: string, content: string, encoding: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.filePath = filePath;
      tab.content = content;
      tab.encoding = encoding;
      tab.isDirty = false;
      this.notify();
    }
  }

  /**
   * Mark tab as saved
   */
  saveTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isDirty = false;
      this.notify();
    }
  }

  /**
   * Get a tab by ID
   */
  getTab(tabId: string): TabData | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all tabs
   */
  getAllTabs(): TabData[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get active tab ID
   */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId: string): void {
    if (this.tabs.has(tabId)) {
      this.activeTabId = tabId;
      this.notify();
    }
  }

  /**
   * Subscribe to tab changes
   */
  subscribe(callback: TabChangeListener): () => void {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.getAllTabs(), this.activeTabId);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notify(): void {
    const tabs = this.getAllTabs();
    this.listeners.forEach(callback => {
      callback(tabs, this.activeTabId);
    });
  }
}
