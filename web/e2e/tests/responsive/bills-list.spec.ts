import { test, expect } from '../../fixtures/test-base';
import { BillsPage } from '../../fixtures/pages/bills-page';
import { TAILWIND_MD_BREAKPOINT } from '../../fixtures/viewport';

test.describe('Bills List Responsive Layout', () => {
  test('shows card view on mobile and table on desktop', async ({ page, helpers }) => {
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size not available');
    }

    if (viewport.width < TAILWIND_MD_BREAKPOINT) {
      await billsPage.assertMobileLayout();
    } else {
      await billsPage.assertDesktopLayout();
    }
  });

  test('card view displays bill information correctly on mobile', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= TAILWIND_MD_BREAKPOINT) {
      test.skip();
      return;
    }

    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Verify cards are visible
    await billsPage.assertMobileLayout();

    // Check that at least one card exists with bill type badge
    const cards = billsPage.billCards();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify first card has expected structure
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Card should contain a badge (HB or SB)
    const badge = firstCard.locator('[class*="badge"]');
    await expect(badge).toBeVisible();
  });

  test('table view displays bill information correctly on desktop', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < TAILWIND_MD_BREAKPOINT) {
      test.skip();
      return;
    }

    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Verify table is visible
    await billsPage.assertDesktopLayout();

    // Check table headers
    const table = billsPage.desktopTable();
    await expect(table.locator('th').filter({ hasText: 'Type' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Number' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Author' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Description' })).toBeVisible();

    // Check that at least one row exists
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a bill navigates to detail page', async ({ page, helpers }) => {
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Get initial URL
    const initialUrl = page.url();

    // Use the BillsPage method which handles both mobile and desktop
    await billsPage.clickFirstBill();

    // URL should have changed to a bill detail page
    await expect(page).not.toHaveURL(initialUrl);
    await expect(page).toHaveURL(/\/bills\/.+/);
  });
});
