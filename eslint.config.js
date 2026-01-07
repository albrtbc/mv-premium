import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: [
      'node_modules/',
      '.output/',
      '.wxt/',
      'dist/',
      '*.config.js',
      '*.config.ts',
    ],
  },
  
  // Base config for all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.es2022,
      },
    },
  },
  
  // JavaScript recommended rules
  pluginJs.configs.recommended,
  
  // TypeScript recommended rules
  ...tseslint.configs.recommended,
  
  // React recommended rules
  pluginReact.configs.flat.recommended,
  
  // React JSX runtime (no need to import React)
  pluginReact.configs.flat['jsx-runtime'],
  
  // React Hooks
  {
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    rules: pluginReactHooks.configs.recommended.rules,
  },
  
  // Project-specific rules
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Temporarily disabled - too many violations to fix at once
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      
      // React
      'react/prop-types': 'off',
      
      // React Hooks - disable overly strict rules that produce false positives
      'react-hooks/set-state-in-effect': 'off', // False positives for lazy loading patterns
      'react-hooks/static-components': 'off',    // False positives for icon maps
      'react-hooks/immutability': 'off',         // False positives for Shadow DOM
      
      // General - temporarily disabled
      'no-console': 'off',
      'no-useless-escape': 'off', // Too many false positives in regex patterns
    },
  },
]
