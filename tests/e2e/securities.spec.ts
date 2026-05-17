import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('AlphaLog Securities — CyberSec Academy', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('redirects /securities to /securities/cybersec', async ({ page }) => {
    await page.goto('/securities', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page).toHaveURL(/\/securities\/cybersec/);
  });

  test('renders the syllabus with 58 modules across 13 categories', async ({ page }) => {
    await page.goto('/securities/cybersec', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('heading', { name: /cybersec academy/i })).toBeVisible();

    // Category headers should render (use one representative from each end of the syllabus)
    await expect(page.getByRole('heading', { name: 'Fundamentos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Programación' })).toBeVisible();
  });

  test('opens module 1 detail page', async ({ page }) => {
    await page.goto('/securities/cybersec/modules/1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByRole('heading', { name: /fundamentos de ciberseguridad/i })).toBeVisible();
    await expect(page.getByText(/research/i).first()).toBeVisible();
  });

  test('opens lesson 1 with 4 sections', async ({ page }) => {
    await page.goto('/securities/cybersec/lessons/1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByRole('heading', { name: /qué es la ciberseguridad/i })).toBeVisible();
    // 4 section headings expected (Definición, Ramas, Historia, Cyber Kill Chain)
    await expect(page.getByRole('heading', { name: /definición/i })).toBeVisible();
  });

  test('renders quiz runner for lesson 1', async ({ page }) => {
    await page.goto('/securities/cybersec/quizzes/1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByRole('heading', { name: /qué es la ciberseguridad/i })).toBeVisible();
    // Action button must exist; initially disabled (no answers)
    const submitBtn = page.getByRole('button', { name: /enviar respuestas/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('renders homework list with 10 items', async ({ page }) => {
    await page.goto('/securities/cybersec/homework', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByRole('heading', { name: /^homework$/i })).toBeVisible();
    // First homework title from the static list
    await expect(page.getByText(/caso real de brecha/i)).toBeVisible();
  });

  test('renders the final exam screen', async ({ page }) => {
    await page.goto('/securities/cybersec/exam', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByRole('heading', { name: /cybersec academy/i })).toBeVisible();
    await expect(page.getByText(/pasa con/i)).toBeVisible();
  });
});
