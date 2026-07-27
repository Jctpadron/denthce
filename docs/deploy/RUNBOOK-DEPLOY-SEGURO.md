# 🚀 RUNBOOK — Deploy Seguro (HCE / DentHCE)

> **Estado:** ✅ VIGENTE · **Creado:** 2026-07-21 · **Aplica a:** todos los agentes (Claude · Gemini · …)
> **Autoridad:** subordinado a `docs/REGLAS-ESTABILIDAD.md` (si contradice, manda REGLAS).
> Adaptado del `RUNBOOK-DEPLOY-SEGURO.md` del proyecto gemelo LabFlow LIS. Leer ANTES de desplegar.

---

## 0. Datos de producción (verificados contra AWS, 2026-07-21)

| Recurso | Valor |
|:--|:--|
| Backend EB | app `odontocloud` · entorno **`Odontocloud-env`** (Ready/Green) · versión viva `prod-20260616-180717` |
| Keycloak EB | entorno `Odontocloud-Keycloak-env` · realm **`hce-realm`** |
| RDS | `hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com` · user `hce_admin` · db `hce_fhir` · `DB_SYNCHRONIZE=false` |
| Frontend | bucket `odontocloud-frontend-2026` · CloudFront **`E1UKXKQOWMVBOM`** |
| DNS (CloudFront) | `app.systia.ar` (frontend) · `api.systia.ar` → `odontocloud-env` (CNAME) · `auth.systia.ar` → Keycloak |
| Región | `us-east-1` · cuenta `751835847253` |
| Secretos | en env vars de EB (NO en el repo). Ver GOV.6. |

---

## 1. Catálogo de anomalías (síntoma → causa → fix)

### 🟢 A1 — EIP swap (la más grave de LabFlow) — NO aplica igual a la HCE
- En LabFlow, Cloudflare apuntaba a una EIP y el deploy la desasociaba → 522.
- **La HCE usa CloudFront → CNAME de EB** (`odontocloud-env.eba-qis2brnr...`, estable), no una EIP. El swap no la afecta. *(Verificar igual el smoke post-deploy.)*

### 🔴 A2 — El script backend NO compila (solo copia `dist`)
- `aws/scripts/deploy-aws.ps1 -Backend` copia `hce-backend/dist` **sin buildear**. Si `dist` está viejo → se despliega código viejo.
- **Fix / regla:** SIEMPRE `cd hce-backend && npm run build` ANTES de empaquetar.

### 🟡 A3 — `s3 sync --delete` del frontend
- `deploy-aws.ps1 -Frontend` hace `aws s3 sync dist/ s3://odontocloud-frontend-2026 --delete`. Correcto (borra assets viejos de un build completo del SPA), pero **exige un build completo y bueno** (si `dist` está parcial, borra archivos vivos).
- **Regla:** compilar el frontend completo antes del sync. Si es un fix puntual, `aws s3 cp` en vez de `sync --delete`.

### 🟡 A4 — Migraciones SQL manuales SIN tracking
- `DB_SYNCHRONIZE=false` (correcto). Pero NO hay tabla `schema_migrations` → no se sabe qué SQL se aplicó salvo a ojo. Riesgo: aplicar dos veces o saltear una.
- **Mitigación HOY:** SQL **idempotente** (`IF NOT EXISTS`/`ON CONFLICT`), **snapshot RDS antes**, aplicar a mano con cuidado, verificar.
- **Estado objetivo (GOV.7):** runner de migraciones automático + tabla `schema_migrations` (modelo LabFlow). `synchronize` se queda en `false`.

### 🟡 A5 — "Ready" de EB NO garantiza que el API responda
- EB puede decir Ready mientras el API está caído. **Smoke externo vía CloudFront obligatorio** tras cada deploy.

### 🟡 A6 — Gating rompe usuarios sin `tenant_id`
- Desplegar el guard de módulos con usuarios que tienen `tenant_id` vacío en Keycloak (`protesista_juan`, `nurse_maria`, `sergio`) → 403 / portal bloqueado.
- **Fix (prep obligatoria antes de desplegar el gating):** setear `tenant_id` en Keycloak + registrar/habilitar módulos en `platform_modules`/`tenant_modules`. Ver diagnóstico del handoff de deploy.

---

## 2. Procedimiento seguro de deploy (checklist)

### PRE-DEPLOY
1. `git status` **limpio** (todo commiteado) y en el **commit/rama que se quiere en prod** (idealmente `main`). Avisar en el tablero: nadie toca backend/migraciones durante el deploy.
2. Compila: `cd hce-backend && npm run build` **verde** · `cd hce-frontend && npm run build` **verde**.
3. Migraciones nuevas: **idempotentes** + **data-safe** (sin `DELETE`/`TRUNCATE` masivo sobre dato clínico). **Snapshot RDS antes** (ver §3).
4. **Anotar la versión EB actual (rollback):**
   ```bash
   aws elasticbeanstalk describe-environments --application-name odontocloud --environment-names Odontocloud-env \
     --region us-east-1 --query "Environments[0].VersionLabel" --output text
   ```

### DEPLOY
5. **Backend:** `cd hce-backend && npm run build`, empaquetar (`deploy-aws.ps1 -Backend`) y subir la versión a EB:
   ```bash
   aws s3 cp <zip> s3://elasticbeanstalk-us-east-1-751835847253/odontocloud/<zip>
   aws elasticbeanstalk create-application-version --application-name odontocloud --version-label deploy-<sha> \
     --source-bundle S3Bucket=elasticbeanstalk-us-east-1-751835847253,S3Key=odontocloud/<zip> --region us-east-1
   aws elasticbeanstalk update-environment --application-name odontocloud --environment-name Odontocloud-env \
     --version-label deploy-<sha> --region us-east-1
   aws elasticbeanstalk wait environment-updated --environment-name Odontocloud-env --region us-east-1
   ```
6. **Frontend (camino separado):** `cd hce-frontend && npm run build`, luego `aws s3 sync dist/ s3://odontocloud-frontend-2026 --delete` + invalidación:
   ```bash
   aws cloudfront create-invalidation --distribution-id E1UKXKQOWMVBOM --paths "/*"
   ```

### POST-DEPLOY (obligatorio)
7. **Smoke externo vía CloudFront** (no alcanza el "Ready" de EB):
   ```bash
   curl -s -o /dev/null -w "health %{http_code}\n"  -H "User-Agent: Mozilla/5.0" https://api.systia.ar/health          # 200
   curl -s -o /dev/null -w "sin token %{http_code}\n" -H "User-Agent: Mozilla/5.0" https://api.systia.ar/fhir/r4/Patient # 401
   ```
8. **Smoke de rutas críticas** (detecta endpoints borrados/renombrados). Sin token: ruta registrada → `401`, inexistente → `404`. Un `404` inesperado = **REGRESIÓN → NO liberar**:
   ```bash
   for ep in fhir/r4/Patient api/tenant/config api/superadmin/clinics; do
     curl -s -o /dev/null -w "$ep -> %{http_code}\n" -H "User-Agent: Mozilla/5.0" https://api.systia.ar/$ep
   done   # esperado 401/403; un 404 = ruta perdida.
   ```
9. **Frontend:** abrir `https://app.systia.ar` (recargar duro) → landing/login OK; probar 1 flujo (login → paciente).
10. **Si algo falla → ROLLBACK inmediato:**
    ```bash
    aws elasticbeanstalk update-environment --application-name odontocloud --environment-name Odontocloud-env \
      --version-label prod-20260616-180717 --region us-east-1
    ```

---

## 3. Snapshot RDS antes de tocar el esquema/datos (obligatorio)
```bash
aws rds create-db-snapshot --db-instance-identifier hce-database-3 \
  --db-snapshot-identifier hce-pre-deploy-$(date +%Y%m%d-%H%M) --region us-east-1
aws rds wait db-snapshot-available --db-snapshot-identifier hce-pre-deploy-<...> --region us-east-1
```
Restore (si hace falta): crea una instancia nueva desde el snapshot y repunta `DB_HOST` (no sobrescribe la viva).

---

## 4. Regla de oro (una línea)
> Buildear SIEMPRE antes de empaquetar · **snapshot RDS antes de tocar datos** · desplegar backend por versión EB (rollback por `version-label`) · frontend por `s3 sync` + invalidación CloudFront · y **validar TODO con smoke externo vía CloudFront** — nunca confiando solo en el "Ready" de EB.
