import { test, expect } from '../../fixtures/test-base';
import { BillDetailPage, BillsPage } from '../../fixtures/pages/bills-page';
import { TAILWIND_MD_BREAKPOINT } from '../../fixtures/viewport';

test.describe('Bill Detail Responsive Layout', () => {
  test.beforeEach(async ({ page, helpers }) => {
    // Navigate to bills list first, then to a bill detail
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Click the first bill to navigate to detail
    await billsPage.clickFirstBill();
    await helpers.waitForHydration();
  });

  test('shows correct action buttons based on viewport', async ({ page, helpers }) => {
    const billDetail = new BillDetailPage(page);
    const viewport = page.viewportSize();

    if (!viewport) {
      throw new Error('Viewport size not available');
    }

    if (viewport.width < TAILWIND_MD_BREAKPOINT) {
      await billDetail.assertMobileLayout();
    } else {
      await billDetail.assertDesktopLayout();
    }
  });

  test('mobile more menu contains expected options', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= TAILWIND_MD_BREAKPOINT) {
      test.skip();
      return;
    }

    const billDetail = new BillDetailPage(page);
    await billDetail.openMobileMenu();
    await billDetail.assertMobileMenuContainsExpectedItems();
  });

  test('Follow button is always visible and functional', async ({ page }) => {
    const billDetail = new BillDetailPage(page);
    const followButton = billDetail.followButton();

    await expect(followButton).toBeVisible();
    await expect(followButton).toBeEnabled();

    // Click should trigger action (will show toast for non-authenticated users)
    await followButton.click();

    // Toast should appear - check for various toast implementations
    const toast = page.locator('[role="status"]')
      .or(page.locator('[data-state="open"]'))
      .or(page.locator('li:has-text("Sign in required")'));
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
  });

  test('Share button is always visible and functional', async ({ page }) => {
    const billDetail = new BillDetailPage(page);
    const shareButton = billDetail.shareButton();

    await expect(shareButton).toBeVisible();
    await expect(shareButton).toBeEnabled();
  });

  test('back to bills link works', async ({ page }) => {
    const billDetail = new BillDetailPage(page);
    const backLink = billDetail.backLink();

    await expect(backLink).toBeVisible();
    await backLink.click();

    await expect(page).toHaveURL('/bills');
  });

  test('bill info panel is collapsible', async ({ page }) => {
    // Find the expand/collapse button directly
    const expandButton = page.getByRole('button', { name: /Expand/i }).first();
    const collapseButton = page.getByRole('button', { name: /Collapse/i }).first();

    // One of the buttons should be visible (either Expand or Collapse depending on initial state)
    const initialExpandVisible = await expandButton.isVisible().catch(() => false);
    const initialCollapseVisible = await collapseButton.isVisible().catch(() => false);

    expect(initialExpandVisible || initialCollapseVisible).toBe(true);

    // Click the visible button
    if (initialExpandVisible) {
      await expandButton.click();
      // After expanding, Collapse button should be visible
      await expect(collapseButton).toBeVisible();
    } else {
      await collapseButton.click();
      // After collapsing, Expand button should be visible
      await expect(expandButton).toBeVisible();
    }
  });
});
