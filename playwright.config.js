import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.js', 'scenes/*/tests/**/*.spec.js'],
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
