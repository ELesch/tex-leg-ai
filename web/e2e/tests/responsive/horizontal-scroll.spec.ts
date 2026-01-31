import { test, expect } from '../../fixtures/test-base';
import { BillsPage } from '../../fixtures/pages/bills-page';

test.describe('No Horizontal Scroll', () => {
  const pagesToTest = [
    { name: 'Bills list', path: '/bills' },
    { name: 'Home page', path: '/' },
  ];

  for (const { name, path } of pagesToTest) {
    test(`${name} has no horizontal scroll`, async ({ page, helpers }) => {
      await page.goto(path);
      await helpers.waitForHydration();
      await helpers.assertNoHorizontalScroll();
    });
  }

  test('Bill detail page has no horizontal scroll', async ({ page, helpers }) => {
    // Navigate to bills list first
    const billsPage = new BillsPage(page);
    await billsPage.goto();
    await helpers.waitForHydration();

    // Click first bill using the page object
    await billsPage.clickFirstBill();
    await helpers.waitForHydration();
    await helpers.assertNoHorizontalScroll();
  });

  test('page content fits viewport width', async ({ page, helpers }) => {
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size not available');
    }

    await page.goto('/bills');
    await helpers.waitForHydration();

    // Check that main content container doesn't exceed viewport
    const mainContent = page.locator('main');
    if (await mainContent.isVisible()) {
      const box = await mainContent.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });

  test('no elements overflow the viewport horizontally', async ({ page, helpers }) => {
    await page.goto('/bills');
    await helpers.waitForHydration();

    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size not available');
    }

    // Check for any visible elements that might overflow
    const overflowingElements = await page.evaluate((viewportWidth) => {
      const elements: string[] = [];
      document.querySelectorAll('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Check if element is visible and extends beyond viewport
        if (rect.right > viewportWidth && rect.width > 0 && rect.height > 0) {
          const tagName = el.tagName.toLowerCase();
          const className = el.className?.toString().slice(0, 50) || '';
          elements.push(`${tagName}.${className}`);
        }
      });
      return elements.slice(0, 10); // Return first 10 to avoid noise
    }, viewport.width);

    if (overflowingElements.length > 0) {
      console.log('Potentially overflowing elements:', overflowingElements);
    }

    // The main assertion - no horizontal scroll
    await helpers.assertNoHorizontalScroll();
  });
});
