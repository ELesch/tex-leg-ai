import { test as base, expect, Page } from '@playwright/test';
import { TAILWIND_MD_BREAKPOINT } from './viewport';

export interface PageHelpers {
  waitForHydration: () => Promise<void>;
  assertNoHorizontalScroll: () => Promise<void>;
  isMobile: () => Promise<boolean>;
}

export const test = base.extend<{ helpers: PageHelpers }>({
  helpers: async ({ page }, use) => {
    await use({
      async waitForHydration() {
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.readyState === 'complete');
      },

      async assertNoHorizontalScroll() {
        const hasScroll = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(hasScroll).toBe(false);
      },

      async isMobile() {
        const viewport = page.viewportSize();
        return viewport ? viewport.width < TAILWIND_MD_BREAKPOINT : false;
      },
    });
  },
});

export { expect };
