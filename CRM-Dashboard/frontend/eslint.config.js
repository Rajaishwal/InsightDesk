import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Names used only as JSX tags (<Icon />, <motion.div>) look unused to core ESLint, so they're allowed here;
      // `const { a, ...rest } = obj` deliberately leaves `a` out of `rest`.
      'no-unused-vars': ['error', { varsIgnorePattern: '^([A-Z_]|motion$)', argsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
      // Context files export their provider plus its use… hook — that's intended
      'react-refresh/only-export-components': ['error', { allowConstantExport: true, allowExportNames: ['useAuth', 'useToast', 'useConfirm', 'useSocket'] }],
    },
  },
])
