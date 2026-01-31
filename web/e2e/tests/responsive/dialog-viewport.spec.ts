import { test, expect } from '../../fixtures/test-base';
import { BillsPage } from '../../fixtures/pages/bills-page';
import { TAILWIND_MD_BREAKPOINT } from '../../fixtures/viewport';

test.describe('Dialog Viewport Fit', () => {
  test('dialogs fit within viewport on all screen sizes', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size not available');
    }

    // Navigate to a bill detail page where dialogs are available
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Click first bill to go to detail
    await billsPage.clickFirstBill();
    await helpers.waitForHydration();

    // On mobile, open the more menu which contains Add to Team
    if (viewport.width < TAILWIND_MD_BREAKPOINT) {
      const moreButton = page.locator('button.md\\:hidden').filter({
        has: page.locator('svg.lucide-more-horizontal'),
      });

      // More button might not be visible if user is not authenticated
      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForSelector('[role="menu"]', { state: 'visible' });

        // Try to click Add to Team if it exists
        const addToTeamItem = page.locator('[role="menuitem"]').filter({ hasText: 'Add to Team' });
        if (await addToTeamItem.isVisible()) {
          await addToTeamItem.click();

          // Wait for dialog to appear
          const dialog = page.locator('[role="dialog"]');
          if (await dialog.isVisible({ timeout: 2000 })) {
            // Verify dialog fits within viewport
            const dialogBox = await dialog.boundingBox();
            if (dialogBox) {
              expect(dialogBox.width).toBeLessThanOrEqual(viewport.width);
              expect(dialogBox.x).toBeGreaterThanOrEqual(0);
              expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
            }

            // Close the dialog
            const closeButton = dialog.locator('button').filter({ hasText: /Cancel|Close/i }).or(
              dialog.locator('button[aria-label="Close"]')
            );
            if (await closeButton.isVisible()) {
              await closeButton.click();
            } else {
              await page.keyboard.press('Escape');
            }
          }
        }
      }
    } else {
      // On desktop, try to click Add to Team button directly
      const addToTeamButton = page.getByRole('button', { name: /Add to Team/i });

      if (await addToTeamButton.isVisible()) {
        await addToTeamButton.click();

        // Wait for dialog to appear
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.isVisible({ timeout: 2000 })) {
          // Verify dialog fits within viewport
          const dialogBox = await dialog.boundingBox();
          if (dialogBox) {
            expect(dialogBox.width).toBeLessThanOrEqual(viewport.width);
            expect(dialogBox.x).toBeGreaterThanOrEqual(0);
            expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
          }

          // Close the dialog
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('dropdown menus fit within viewport on mobile', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= TAILWIND_MD_BREAKPOINT) {
      test.skip();
      return;
    }

    // Navigate to a bill detail page
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    await billsPage.clickFirstBill();
    await helpers.waitForHydration();

    // Open the more menu
    const moreButton = page.locator('button.md\\:hidden').filter({
      has: page.locator('svg.lucide-more-horizontal'),
    });

    if (await moreButton.isVisible()) {
      await moreButton.click();

      // Wait for menu to appear
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible({ timeout: 2000 });

      // Verify menu fits within viewport
      const menuBox = await menu.boundingBox();
      if (menuBox) {
        expect(menuBox.width).toBeLessThanOrEqual(viewport.width);
        expect(menuBox.x).toBeGreaterThanOrEqual(0);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });
});
