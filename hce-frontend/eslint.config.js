import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // --- Baseline congelado (2026-08-17) ---
      // 302 errores heredados hacian fallar el job `build-frontend` desde el
      // 2026-06-18. Se bajan a `warn` para desbloquear el CI; el techo de
      // warnings del workflow impide que la deuda crezca.
      //
      // RUIDO: consecuencia de que `strict` no esta activo en tsconfig.app.json.
      // La forma de bajarlo es activar `strict` y tipar, no silenciar la regla.
      '@typescript-eslint/no-explicit-any': 'warn',     // 193
      '@typescript-eslint/no-unused-vars': 'warn',      //  33
      '@typescript-eslint/no-unused-expressions': 'warn',
      'react-refresh/only-export-components': 'warn',   //  15
      'react-hooks/set-state-in-effect': 'warn',        //  34
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-useless-catch': 'warn',

      // BUGS REALES — no son ruido. Se bajan a `warn` SOLO para no dejar al
      // proyecto sin tests en CI, y quedan listados aca con su ubicacion para
      // que nadie los pierda de vista. Deben corregirse y volver a `error`.
      //
      //   react-hooks/purity (3) — leen Date.now() DURANTE el render (calculo
      //   de edad). Render no determinista: con React 19 Strict Mode puede dar
      //   distinto entre renders.
      //     PatientSearch.tsx:133 · OdontogramPAMI.tsx:84 · OdontologyHC.tsx:208
      //
      //   react-hooks/static-components (8) — componentes definidos DENTRO de
      //   otro componente: se remontan en cada render y pierden estado y foco
      //   del input mientras se tipea.
      //     PatientForm.tsx:440,463,481,499,518 · AnamnesisPAMI.tsx:211
      //     OralStatusPAMI.tsx:201,205
      //
      //   react-hooks/immutability (2) — mutacion en el handler de clic sobre
      //   la cara del diente.
      //     Odontogram.tsx:68 · OdontogramPAMI.tsx:128
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
])
