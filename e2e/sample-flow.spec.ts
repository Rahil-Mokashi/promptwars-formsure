import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Real-browser axe scan, including colour contrast (which jsdom cannot measure). */
async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}

test.use({ reducedMotion: 'reduce' });

test('sample applicant: 50 % with one fix and one advisory warning, then 100 % after the re-check', async ({ page }) => {
  await page.goto('/');
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: /try sample applicant/i }).click();
  await expect(page.getByRole('heading', { name: 'Which scholarship are you applying for?' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: /continue to upload/i }).click();
  await expect(page.getByRole('heading', { name: 'Upload your documents' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: /run formsure check/i }).click();
  await page.getByRole('button', { name: /see readiness report/i }).click();
  await expect(page.getByRole('heading', { name: /1 passed, 1 need fixing/ })).toBeVisible();
  await expect(page.getByText('50%')).toBeVisible();
  await expect(page.getByText('Advisory', { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'मराठी' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'mr');

  await page.getByRole('button', { name: /re-check/i }).click();
  await expect(page.getByRole('heading', { name: 'Pre-check complete' })).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('no horizontal scrolling at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
