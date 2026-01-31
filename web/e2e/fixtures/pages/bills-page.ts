import { Page, expect } from '@playwright/test';
import { TAILWIND_MD_BREAKPOINT } from '../viewport';

export class BillsPage {
  constructor(private page: Page) {}

  // Locators for bills list
  mobileCards = () => this.page.locator('.space-y-3.md\\:hidden');
  desktopTable = () => this.page.locator('.hidden.md\\:block table');
  billCards = () => this.page.locator('.space-y-3.md\\:hidden > a');
  desktopFirstBillLink = () => this.page.locator('.hidden.md\\:block tbody tr:first-child a').first();

  async goto() {
    await this.page.goto('/bills');
    await this.page.waitForLoadState('networkidle');
  }

  async assertMobileLayout() {
    await expect(this.mobileCards()).toBeVisible();
    await expect(this.desktopTable()).toBeHidden();
  }

  async assertDesktopLayout() {
    await expect(this.mobileCards()).toBeHidden();
    await expect(this.desktopTable()).toBeVisible();
  }

  async clickFirstBill() {
    const viewport = this.page.viewportSize();
    const isMobile = viewport ? viewport.width < TAILWIND_MD_BREAKPOINT : false;

    // Wait for the page to be fully loaded and not showing rate limit error
    await this.page.waitForLoadState('domcontentloaded');

    // Check if there's a rate limit error and wait if so
    const rateLimitError = this.page.locator('text=Too many requests');
    if (await rateLimitError.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Wait and reload
      await this.page.waitForTimeout(5000);
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
    }

    // Get the href before clicking so we can wait for navigation
    let targetHref: string | null = null;

    if (isMobile) {
      const firstCard = this.billCards().first();
      await expect(firstCard).toBeVisible({ timeout: 30000 });
      targetHref = await firstCard.getAttribute('href');
      await firstCard.click();
    } else {
      // Wait for the table to be visible first
      await expect(this.desktopTable()).toBeVisible({ timeout: 30000 });

      // On desktop, click the first link in the table row
      const firstLink = this.page.locator('.hidden.md\\:block tbody tr:first-child a').first();
      await expect(firstLink).toBeVisible({ timeout: 10000 });
      targetHref = await firstLink.getAttribute('href');
      await firstLink.click();
    }

    // Wait for URL to change to the bill detail page
    if (targetHref) {
      await this.page.waitForURL(targetHref, { timeout: 30000 });
    }
    await this.page.waitForLoadState('networkidle');
  }
}

export class BillDetailPage {
  constructor(private page: Page) {}

  // Action buttons
  followButton = () => this.page.getByRole('button', { name: /Follow/i });
  shareButton = () => this.page.getByRole('button', { name: /Share/i });
  addToTeamButton = () => this.page.getByRole('button', { name: /Add to Team/i });
  // More menu button - the button next to Share that only has an icon (triggers dropdown)
  // On mobile, it's the only button without visible text in the action area
  moreMenuButton = () => {
    // Find all buttons near the Share button, get the one with no text
    return this.page.locator('button').filter({ has: this.page.locator('svg') }).filter({ hasNotText: /\w+/ });
  };

  // Desktop-only links (visible at md breakpoint and above)
  capitolGovLink = () => this.page.getByRole('link', { name: /Capitol\.gov/i });
  companionsLink = () => this.page.getByRole('link', { name: /Companions/i });

  // Back link
  backLink = () => this.page.getByRole('link', { name: /Back to Bills/i });

  async goto(billId: string) {
    await this.page.goto(`/bills/${billId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async assertMobileLayout() {
    // Follow and Share should always be visible
    await expect(this.followButton()).toBeVisible();
    await expect(this.shareButton()).toBeVisible();

    // On mobile, desktop-only links should be hidden (in overflow menu instead)
    await expect(this.capitolGovLink()).toBeHidden();
    await expect(this.companionsLink()).toBeHidden();

    // More menu button should be visible on mobile (button with just an icon)
    const moreButton = this.moreMenuButton();
    await expect(moreButton.first()).toBeVisible();
  }

  async assertDesktopLayout() {
    // Follow and Share should always be visible
    await expect(this.followButton()).toBeVisible();
    await expect(this.shareButton()).toBeVisible();

    // Desktop-only links should be visible
    await expect(this.capitolGovLink()).toBeVisible();
    await expect(this.companionsLink()).toBeVisible();
  }

  async openMobileMenu() {
    const moreButton = this.moreMenuButton().first();
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    // Wait for dropdown to appear
    await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
  }

  async assertMobileMenuContainsExpectedItems() {
    const menu = this.page.locator('[role="menu"]');
    await expect(menu.getByText('Capitol.gov')).toBeVisible();
    await expect(menu.getByText('Companions')).toBeVisible();
  }
}
