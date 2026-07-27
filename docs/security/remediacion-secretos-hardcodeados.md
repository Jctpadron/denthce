# Remediación de secretos hardcodeados + salvaguarda de claves (GOV.6)

> **Estado:** 🔴 PENDIENTE · **Responsable:** libre (cualquier agente puede ejecutarlo) · **Detectado:** 2026-07-21 (Claude, durante diagnóstico de deploy).
> **Prioridad:** Alta (secretos reales expuestos en el repo y en el historial de git).
> Este doc es vendor-neutral: contiene todo lo necesario para que **cualquier agente** (Claude/Gemini/…) lo lleve adelante sin contexto previo.

## Contexto / hallazgo
Durante el diagnóstico previo a un deploy se encontraron **secretos REALES** (no placeholders) hardcodeados en archivos **trackeados** y presentes también en el **historial de git**. Como ya están expuestos, **removerlos del árbol NO alcanza: hay que ROTARLOS**.

## Inventario (por archivo:línea — NO se listan los valores acá a propósito)
| Ubicación | Tipo de secreto |
|---|---|
| `hce-backend/src/tenant/keycloak-admin.service.ts:20-21,51` | usuario+password del admin master de Keycloak + `client_secret` del client `hce-backend` (hardcodeados, sin `process.env`) |
| `hce-backend/src/app.module.ts:54` | fallback de DB password (`process.env.DB_PASSWORD \|\| '<hardcoded>'`) |
| `aws/keycloak/hce-realm.json:81` · `configs/keycloak/hce-realm.json:93` | `client_secret` embebido en el export del realm |
| `aws/scripts/build-backend/` (**115 archivos trackeados**) | artefacto de build commiteado con TODO lo anterior duplicado — no debería estar en el repo |
| `testing/scripts/*.js` (~14 archivos) | DB password + password del admin de Keycloak |

> Los valores reales viven en el entorno EB: `Odontocloud-env` (`DB_PASSWORD`) y `Odontocloud-Keycloak-env` (`KEYCLOAK_ADMIN_USER`/`KEYCLOAK_ADMIN_PASSWORD`, `RDS_PASSWORD`).

## Mecanismo de salvaguarda a implementar
1. **Código sin secretos:** todo secreto por `process.env.X`. **Fail-fast** si falta (lanzar error claro al arrancar; NUNCA un fallback con valor real).
2. **Almacenamiento:**
   - **Prod:** ya en env vars de EB → migrar a **AWS Secrets Manager / SSM Parameter Store** (EB los referencia; permite rotación centralizada).
   - **Local/dev:** `.env` **gitignored**, generado desde `.env.example` (solo placeholders).
3. **Prevención forzada por máquina (alineado a la gobernanza Solución 1):**
   - **Secret-scanning en CI** (gitleaks/trufflehog) que **bloquea el PR** si detecta un secreto.
   - **Pre-commit hook** local (gitleaks).
   - **`.gitignore` endurecido:** `.env`, artefactos de build, `*.zip`.

## Remediación (orden recomendado)
1. **Prevención primero** (impide nuevos hardcodes): agregar job gitleaks a `.github/workflows/ci.yml` + `.gitignore` + hook.
2. **Sacar el artefacto de build** `aws/scripts/build-backend/` del tracking (`git rm -r --cached`) + gitignore.
3. **Reemplazar hardcodes por `process.env`** en los archivos del inventario. ⚠️ Antes de tocar `keycloak-admin.service.ts`, **verificar que el entorno EB del backend (`Odontocloud-env`) tenga** `KEYCLOAK_ADMIN_USER`/`KEYCLOAK_ADMIN_PASSWORD` y el `client_secret`; si no, el admin de Keycloak se rompe en el próximo deploy.
4. **Sanear los `testing/scripts/*.js`** (leer de `.env`, no literales).
5. **ROTAR los secretos expuestos** (⚠️ toca prod, coordinar con devops — hacerlo atómico para no romper):
   - DB password de `hce_admin` en RDS + `DB_PASSWORD` en EB `Odontocloud-env`.
   - Password del admin de Keycloak + `client_secret` del client `hce-backend` (en Keycloak + realm export + EB).
6. **(Opcional) Scrub del historial** (`git filter-repo`/BFG) — pesado y reescribe historia; evaluar si vale la pena vs. solo rotar.

## Definición de done
- `git grep` de patrones de secreto (sufijos de año conocidos, literales `password/secret/client_secret = '...'`) → **cero** en archivos trackeados (salvo `.env.example` con placeholders).
- CI falla si se intenta commitear un secreto (gitleaks verde en un test negativo).
- Secretos reales **rotados** y funcionando desde env/Secrets Manager; prod sano (smoke E2E).
- `aws/scripts/build-backend/` fuera del tracking.
