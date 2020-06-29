module.exports = {
  env: {
    browser: true,
    es2020: true,
  },
  extends: [
    'airbnb-typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    indent: ['error', 4],
    '@typescript-eslint/indent': ['error', 4],
  },
};
