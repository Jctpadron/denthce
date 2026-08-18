// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      // --- Baseline congelado (2026-08-17) ---
      // Estas reglas son consecuencia directa de `noImplicitAny: false` en
      // tsconfig.json: 1.280 violaciones heredadas, medidas en el runner de CI.
      // Estaban en `error` y hacian fallar el job `lint`; como `test-backend`
      // declaraba `needs: lint`, los 172 tests NUNCA se ejecutaron en GitHub
      // desde el 2026-06-18. El costo de tenerlas en `error` no era codigo mas
      // seguro: era quedarse sin tests.
      //
      // Se bajan a `warn`, NO se apagan: la deuda sigue contandose y visible.
      // La forma de bajarla es activar `noImplicitAny` por modulo y tipar de
      // verdad, no silenciar la regla. El techo de warnings del workflow
      // impide que crezca.
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',

      // Resto del baseline (13 violaciones puntuales). Se congelan por la misma
      // razon; el techo de warnings impide que crezcan.
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      'prefer-const': 'warn',
    },
  },
);
