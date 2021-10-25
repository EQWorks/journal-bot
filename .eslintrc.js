module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: 'eslint:recommended',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'linebreak-style': ['error', 'unix'],
    'comma-dangle': ['error', 'always-multiline'],
    'eol-last': ['error', 'always'],
    indent: ['error', 2],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'never'],
    'quote-props': ['error', 'as-needed'],
    'no-console': ['warn', { allow: ['error'] }],
    'no-trailing-spaces': ['error'],
  },
}
