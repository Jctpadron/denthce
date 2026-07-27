# 🗄️ PROTOCOLO DE CAMBIOS DE BASE DE DATOS — HCE (DentHCE)

> **Estado:** ✅ VIGENTE · **Creado:** 2026-07-21 · **Aplica a:** todos los agentes (Claude · Gemini · …)
> **Autoridad:** subordinado a `docs/REGLAS-ESTABILIDAD.md`. Complementa `docs/deploy/RUNBOOK-DEPLOY-SEGURO.md`.
>
> **Dato clínico = vida.** Un cambio de esquema mal hecho puede tumbar prod (500s) o perder datos de pacientes. Leer ANTES de tocar el esquema.

---

## 0. Principio base
- **`DB_SYNCHRONIZE=false` NO se toca.** `synchronize=true` en prod puede DROPear columnas/datos solo. TypeORM NO aplica el esquema en prod.
- Todo cambio de esquema = **un archivo de migración nuevo** (SQL) + **actualizar la entidad TypeORM** (para que ambos queden en sync). **Nunca editar una migración ya aplicada** (si tiene bug, se corrige con una migración NUEVA).
- Las migraciones las aplica el **runner** (ver GOV.7); hoy, hasta que exista, se aplican a mano siguiendo este protocolo.

## 1. Nomenclatura (timestamp — evita colisión multi-agente)
```
hce-backend/db/migrations/
  0000_baseline_2026-07-21.sql                          ← "todo el esquema previo = aplicado" (NO re-ejecuta nada)
  20260721_1530_agregar_col_estado_pago_a_protesis_orders.sql
  20260722_0900_fk_clinica_pagos_a_presupuestos.sql
```
- Formato: **`YYYYMMDD_HHMM_<verbo>_<objeto>[_a_<destino>].sql`**. El nombre describe la **acción** (que se entienda sin abrirlo).
  - ✅ `agregar_col_...`, `fk_..._a_...`, `crear_tabla_...` · ❌ `fix.sql`, `cambios.sql`.
- **Por qué timestamp y no `001,002`:** varios agentes trabajan en paralelo sin memoria compartida → la numeración secuencial colisiona (dos `0043_` rompen el orden y el deploy). El timestamp deja que cada agente numere solo, sin coordinación.
- El baseline `0000_` reconcilia el runner con el esquema actual de prod (27 tablas ya aplicadas a mano): marca todo lo previo como aplicado en `schema_migrations`, **sin re-ejecutarlo**.

## 2. Reglas de oro (todas obligatorias)
1. **Snapshot RDS antes** de cualquier cambio (ver RUNBOOK §3).
2. **Probar contra una COPIA del snapshot**, no en vacío (los datos reales pueden violar constraints nuevas).
3. **Idempotente:** correr la migración **dos veces** sin fallar. DDL con `IF NOT EXISTS`; **datos** con `WHERE ... IS NULL` / `ON CONFLICT DO NOTHING` (para no pisar correcciones manuales).
4. **`SET lock_timeout='3s';`** al inicio → si un `ALTER` no consigue el lock (encolado detrás de una query larga), **falla rápido** en vez de colgar prod.
5. **Transacción por migración** (rollback limpio) — **excepción:** `CREATE INDEX CONCURRENTLY` NO puede ir en transacción → va en su propio archivo sin `BEGIN/COMMIT`.
6. **`IF NOT EXISTS` no reconcilia estructura, solo existencia.** Si el objeto ya existe con estructura distinta, lo saltea en silencio → divergencia oculta. Verificar la estructura esperada, no confiar ciegamente.
7. **Data-safe:** prohibido `DELETE`/`TRUNCATE` masivo sobre datos de pacientes. Todo borrado rastrea a una tarea explícita.

## 3. EXPAND / CONTRACT (la clave para cero downtime)
Nunca hacer un cambio destructivo en el **mismo** paso que el código nuevo. Separar en:
1. **Expand** — agregar lo nuevo, **100% compatible** con el código viejo (columna nullable, tabla nueva, FK `NOT VALID`).
2. **Deploy** del código que usa lo nuevo.
3. **Contract** — quitar lo viejo, en una migración **posterior**, cuando ya nadie lo usa.
Así el esquema y el código **nunca** quedan incompatibles → sin 500s, sin downtime.

## 4. Recetas por tipo de cambio (SQL seguro)

### Alta de tabla
```sql
SET lock_timeout='3s';
CREATE TABLE IF NOT EXISTS mi_tabla (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    varchar NOT NULL,            -- multi-inquilino: SIEMPRE
  -- ... columnas ...
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mi_tabla_tenant ON mi_tabla(tenant_id);  -- toda query filtra por tenant
```

### Agregar columna
```sql
SET lock_timeout='3s';
ALTER TABLE mi_tabla ADD COLUMN IF NOT EXISTS c text;         -- nullable = seguro/instantáneo
```
- **`NOT NULL`** → expand/contract: (1) agregar nullable, (2) backfill `UPDATE ... SET c=... WHERE c IS NULL`, (3) migración posterior `ALTER ... ALTER COLUMN c SET NOT NULL`.
- **DEFAULT:** constante en PG11+ es instantáneo; un default **volátil** (`gen_random_uuid()`, `now()` por fila) **REESCRIBE toda la tabla** (lock largo) → hacerlo por lotes.

### FK / relación
```sql
SET lock_timeout='3s';
-- 1) resolver huérfanos (solo se pueden NULL-ear si la columna es nullable; si es NOT NULL, hay que arreglar/borrar los datos con criterio)
UPDATE child SET parent_id = NULL
 WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM parent);
-- 2) agregar la constraint SIN validar (rápido, no escanea la tabla entera)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_child_parent') THEN
    ALTER TABLE child ADD CONSTRAINT fk_child_parent
      FOREIGN KEY (parent_id) REFERENCES parent(id) NOT VALID;
  END IF;
END $$;
-- 3) validar aparte (no bloquea escrituras tan fuerte)
ALTER TABLE child VALIDATE CONSTRAINT fk_child_parent;
```
> `ADD CONSTRAINT` sin `NOT VALID` valida TODA la tabla con lock → en tablas grandes = bloqueo largo.

### PK
Rara vez se cambia. Toda FK que apunte a esa PK se rompe → hay que dropear/recrear esas FKs. Agregar PK exige que la columna sea única y NOT NULL (datos duplicados/null lo bloquean). Expand/contract + snapshot.

### Rename de columna/tabla ⚠️
**Nunca rename directo** (rompe el código viejo durante el deploy). Expand/contract **con dual-write**:
1. Agregar la columna/tabla nueva.
2. **Dual-write:** el código escribe en la vieja Y la nueva (o un trigger las sincroniza) — si no, se **pierden** las filas escritas durante la ventana de migración.
3. Backfill de lo histórico.
4. Deploy del código que lee la nueva.
5. Migración posterior: dropear la vieja.

### Drop de columna/tabla
Solo en fase **contract**, cuando el código ya NO la usa. Es **irreversible** (dato perdido → snapshot antes). Manejar dependencias (índices/vistas/constraints) o `CASCADE` consciente.
```sql
ALTER TABLE mi_tabla DROP COLUMN IF EXISTS c;
```

## 5. ⚠️ Efecto colateral crítico de la HCE: aislamiento a nivel APP (no RLS)
A diferencia de proyectos con Row-Level Security en Postgres, la HCE **filtra por `tenant_id` en el código**, no en la BD. Por lo tanto:
> **Una migración que crea una tabla NO protege nada por sí sola.** Si el código que la consulta olvida filtrar por `tenant_id`, hay **fuga de datos entre clínicas**. La migración y el filtro de tenant en el servicio son **inseparables** — se revisan juntos (Quality Gate de `security`).

## 6. Checklist antes de commitear una migración
- [ ] Nombre timestamp descriptivo de la acción · entidad TypeORM actualizada.
- [ ] Idempotente (corre 2×) · `lock_timeout` · transacción (o CONCURRENTLY aparte).
- [ ] Sin `DELETE`/`TRUNCATE` masivo sobre dato clínico.
- [ ] FK con `NOT VALID`+`VALIDATE` · huérfanos resueltos · índice de `tenant_id` si es tabla nueva.
- [ ] Cambio destructivo → está en fase **contract** (no junto al código nuevo).
- [ ] Probada contra **copia** del snapshot de prod.
- [ ] Si crea/consulta datos de inquilino → el servicio filtra por `tenant_id` (revisión `security`).

## 7. Relación con el resto
- El **runner** (GOV.7) aplica estas migraciones automáticamente en cada deploy (hook predeploy EB) usando `schema_migrations`. Hasta que exista, se aplican a mano con este protocolo + snapshot.
- El **deploy** de código que depende de una migración va DESPUÉS de que la migración esté aplicada (expand primero). Ver `RUNBOOK-DEPLOY-SEGURO.md`.
