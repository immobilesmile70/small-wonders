import { test, expect } from '@playwright/test';

test.describe('Small Wonders End-to-End Field Journal Workflow', () => {
  test('Unauthenticated users are redirected from protected routes and full CRUD lifecycle works', async ({
    page,
  }) => {
    // 1. Verify protected route guard redirects signed-out user to /sign-in
    await page.goto('/app/journal');
    await expect(page).toHaveURL(/\/sign-in/);

    // 2. Navigate to landing page and verify Hero & 3D scene / fallback
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Not everything meaningful announces itself/i })
    ).toBeVisible();

    // 3. Sign up a new user
    await page.getByRole('link', { name: /Start your journal/i }).first().click();
    await page.getByLabel(/First name or pen name/i).fill('Clara Vance');
    await page.getByLabel(/Email address/i).fill('clara.vance@example.com');
    await page.getByLabel(/Password/i).fill('FieldNotes2026!');
    await page.getByRole('button', { name: /Start your journal/i }).click();

    // 4. Confirm dashboard renders
    await expect(
      page.getByRole('heading', { name: /There is still something to notice/i })
    ).toBeVisible();

    // 5. Create a new observation
    await page.getByRole('link', { name: /Record an observation/i }).first().click();
    await page
      .getByLabel(/Observation title/i)
      .fill('Morning frost along the botanical conservatory glass');
    await page
      .getByLabel(/Field note/i)
      .fill('Feathery ice crystals forming along the lower iron mullions before sunrise.');
    await page.getByRole('button', { name: 'Nature' }).click();
    await page.getByLabel(/Place label/i).fill('North Conservatory');
    await page.getByRole('button', { name: /Save observation/i }).click();

    // 6. Confirm entry appears in detail view
    await expect(
      page.getByRole('heading', {
        name: /Morning frost along the botanical conservatory glass/i,
      })
    ).toBeVisible();

    // 7. Edit the observation
    await page.getByRole('button', { name: /Edit observation/i }).click();
    await page
      .getByLabel(/Observation title/i)
      .fill('Morning frost patterns on the conservatory ironwork');
    await page.getByRole('button', { name: /Save changes/i }).click();
    await expect(
      page.getByRole('heading', {
        name: /Morning frost patterns on the conservatory ironwork/i,
      })
    ).toBeVisible();

    // 8. Delete the observation and confirm removal
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: /Permanently delete/i }).click();
    await expect(
      page.getByRole('heading', { name: /Collected observations/i })
    ).toBeVisible();
  });
});
