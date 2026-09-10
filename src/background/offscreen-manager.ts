/**
 * Offscreen Document Lifecycle Manager for Chrome MV3.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

export class OffscreenManager {
  private static OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
  private static creatingPromise: Promise<void> | null = null;

  /**
   * Ensures the offscreen document is open and active
   */
  static async ensureDocument(): Promise<void> {
    if (await this.hasDocument()) {
      return;
    }

    if (this.creatingPromise) {
      await this.creatingPromise;
      return;
    }

    this.creatingPromise = chrome.offscreen.createDocument({
      url: this.OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.WORKERS],
      justification: 'Process and assemble HLS stream segments without service worker timeout',
    });

    try {
      await this.creatingPromise;
    } finally {
      this.creatingPromise = null;
    }
  }

  /**
   * Closes the offscreen document when no streaming tasks are active
   */
  static async closeDocument(): Promise<void> {
    if (await this.hasDocument()) {
      await chrome.offscreen.closeDocument();
    }
  }

  /**
   * Checks if an offscreen document is currently active
   */
  static async hasDocument(): Promise<boolean> {
    if ('hasDocument' in chrome.offscreen) {
      return await chrome.offscreen.hasDocument();
    }
    // Fallback for older Chromium versions
    const clients = await (self as any).clients.matchAll();
    return clients.some((c: any) => c.url.includes(this.OFFSCREEN_PATH));
  }
}
