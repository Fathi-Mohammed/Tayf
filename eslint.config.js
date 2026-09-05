'use strict';

const js = require('@eslint/js');

const COMMON_RULES = {
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }]
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', '_backup/**', '_notes/**', 'spike/**']
  },
  js.configs.recommended,
  {
    files: [
      'src/main/**/*.js',
      'src/app/**/*.js',
      'src/providers/**/*.js',
      'src/storage/**/*.js',
      'src/strings.js',
      'src/preload.js',
      'scripts/**/*.js',
      'build/**/*.js',
      'tests/**/*.test.js',
      'eslint.config.js'
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: COMMON_RULES
  },
  {
    files: ['src/renderer/**/*.js', 'tests/**/*.test.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        Node: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly'
      }
    },
    rules: COMMON_RULES
  }
];
