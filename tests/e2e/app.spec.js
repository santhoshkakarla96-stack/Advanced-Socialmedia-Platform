/**
 * End-to-End Tests
 * Run with: npx playwright test
 * Install: npm install -D @playwright/test
 */

// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const TEST_USER = { email: 'e2e@test.com', password: 'Password123', username: 'e2euser' };

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    await page.fill('[name="username"]', TEST_USER.username);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.fill('[name="confirmPassword"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/feed`);
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/feed`);
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-btn"]');
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

test.describe('Post Creation and Feed', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/feed`);
  });

  test('should create a text post', async ({ page }) => {
    const postContent = 'E2E test post - ' + Date.now();
    await page.fill('[data-testid="post-input"]', postContent);
    await page.click('[data-testid="post-submit"]');
    await expect(page.locator(`text=${postContent}`)).toBeVisible();
  });

  test('should like and unlike a post', async ({ page }) => {
    // Find first post and like it
    const likeBtn = page.locator('[data-testid="like-btn"]').first();
    const initialCount = await likeBtn.locator('[data-testid="like-count"]').innerText();
    
    await likeBtn.click();
    const likedCount = await likeBtn.locator('[data-testid="like-count"]').innerText();
    expect(parseInt(likedCount)).toBe(parseInt(initialCount) + 1);
    
    // Unlike
    await likeBtn.click();
    const unlikedCount = await likeBtn.locator('[data-testid="like-count"]').innerText();
    expect(parseInt(unlikedCount)).toBe(parseInt(initialCount));
  });

  test('should add a comment to a post', async ({ page }) => {
    await page.click('[data-testid="comment-btn"]').first();
    await page.fill('[data-testid="comment-input"]', 'Great post!');
    await page.click('[data-testid="comment-submit"]');
    await expect(page.locator('text=Great post!')).toBeVisible();
  });
});

test.describe('User Profile', () => {
  test('should view user profile', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/${TEST_USER.username}`);
    await expect(page.locator('[data-testid="profile-username"]')).toContainText(TEST_USER.username);
  });
});

test.describe('Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('should redirect authenticated users away from login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(`${BASE_URL}/feed`);
  });
});
