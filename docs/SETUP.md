# SETUP — Entorno de desarrollo en una máquina nueva (DentHCE)

> Objetivo: clonar y quedar productivo en otra PC. Los **secretos y datos locales NO viajan
> por git** — se trasladan aparte con el "kit de traslado" (ver §4). Actualizado: 2026-07-28.

## 1. Instalar (una sola vez)

- **Git** · **Docker Desktop** (con WSL2 en Windows) · **Node.js 22+** · **AWS CLI v2**
- **Claude Code** (CLI o extensión VS Code) con login de la cuenta Anthropic
- VS Code (recomendado)

## 2. Clonar y configurar

```bash
git clone https://github.com/Jctpadron/denthce.git
cd denthce
```

Crear la config local del frontend (o copiarla del kit de traslado):

```bash
# opción A (kit): copiar env/.env.local y env/.env.production a hce-frontend/
# opción B (desde cero): partir de los ejemplos versionados
cp hce-frontend/.env.example hce-frontend/.env.local
cp hce-backend/.env.example  hce-backend/.env      # solo si se corre el backend fuera de Docker
```

Credenciales AWS (solo si se va a deployar desde esta PC): copiar `config` y `credentials`
del kit a `~/.aws/`, o crear una access key nueva en IAM (más seguro) y `aws configure`.

## 3. Levantar el stack

```bash
docker compose up -d
```

Servicios: `hce-database` (Postgres 16: bases `hce_fhir` + `keycloak_db`), `hce-keycloak`
(importa `configs/keycloak/hce-realm.json` al primer arranque), `hce-backend-api` (:3000),
`hce-frontend-client` (:5173).

### ⚠️ Peculiaridad CLAVE del entorno Windows + Docker
El watch (`nest --watch` / Vite) **NO detecta los cambios** a través del bind-mount
Windows→Docker. **Después de editar código, SIEMPRE:**

```bash
docker restart hce-backend-api      # tras editar hce-backend/
docker restart hce-frontend-client  # tras editar hce-frontend/
```

Olvidarlo produce "bugs fantasma" (el contenedor corre código viejo).

## 4. Datos y esquema (elegir un camino)

**Camino A — con kit de traslado (recomendado, réplica exacta):** restaurar los dumps
`db/hce_fhir.sql` y `db/keycloak_db.sql` según el `LEEME.md` del kit. Esquema + datos de
prueba + usuarios de login quedan idénticos a la PC original.

**Camino B — desde cero:** la app usa `DB_SYNCHRONIZE=false` (el esquema NO se autogenera).
Aplicar a `hce_fhir` los SQL versionados, en orden cronológico:
1. Los `scripts/*.sql` de creación base (tablas iniciales).
2. Las migraciones `hce-backend/src/migrations/*.sql` (nombre `YYYYMMDD_HHMM_*`, orden por fecha).

```bash
docker exec -i hce-database psql -U hce_admin -d hce_fhir < <archivo.sql>
```

Usuarios Keycloak: el realm versionado crea la estructura; los usuarios de prueba
(doctor_julio, etc.) vienen del dump del kit o se crean a mano en http://localhost:8080.

## 5. Verificar

- http://localhost:5173 → login `doctor_julio` / `doctor_pass_2026` (si se restauró el kit).
- `curl http://localhost:3000/clinica/finanzas/presupuesto` → **401** = backend vivo.

## 6. Continuidad de Claude Code

Una sesión nueva se orienta con: `CLAUDE.md` (raíz) → `AGENTS.md` → `tablero_control.md` →
`docs/walkthroughs/` (el más reciente = handoff vigente) → `docs/backlog.json`.
La **memoria privada** de Claude es local por máquina: copiarla del kit a
`~/.claude/projects/<slug-del-proyecto>/memory/` para continuidad fina (opcional — los
walkthroughs cubren el estado).

## 7. Deploy a producción (referencia)

- Runbook: `docs/deploy/RUNBOOK-DEPLOY-SEGURO.md` · Cambios de DB: `docs/PROTOCOLO-CAMBIOS-DB.md`.
- Backend: `aws/scripts/deploy-aws.ps1 -Backend` (genera ZIP) → subir a EB `Odontocloud-env`
  vía AWS CLI. Frontend: build Vite → `aws s3 sync` a `odontocloud-frontend-2026` →
  invalidar CloudFront `E1UKXKQOWMVBOM`. Migraciones a RDS: manuales, ANTES del deploy
  del backend, credenciales desde las env vars del EB (nunca hardcodear).
- **Nunca** deployar sin CHECKPOINT aprobado por el Super Admin.
