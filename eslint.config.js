import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'release/', 'node_modules/', 'assets/spritesheets/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['app/main/preload.cjs', 'spikes/loader/preload.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // The loader spike (docs/platform/06-loader-spike.md): the page side runs in the browser.
    files: ['spikes/loader/runtime.js', 'spikes/loader/pack/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Playwright tests run code both in Node and inside the page (page.evaluate).
    files: [
      'tests/e2e/**/*.js',
      'scenes/*/tests/**/*.spec.js',
      'scripts/shot.mjs',
      'scripts/measure-alloc.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['app/page/**/*.js', 'scenes/**/*.js'],
    ignores: ['scenes/*/rules.js', 'scenes/*/config.js', 'scenes/*/tests/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    // A scene never reads the clock itself: host.clock is the one source of time, so the manual clock and the seed of
    // tests and `npm run shot` work for every scene (platform plan, the contract).
    files: ['scenes/**/*.js'],
    ignores: ['scenes/*/tests/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Use host.clock.now() (a scene never reads the clock).',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Use host.clock.now() or the dt given to update().',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use host.clock.now() (a scene never reads the clock).',
        },
      ],
    },
  },
  {
    // Pure rules and tuning: Node globals only, so a stray document or window is an error (a later server reuses them).
    files: ['scenes/*/rules.js', 'scenes/*/config.js'],
    languageOptions: { globals: globals.node },
  },
];
