# Diseño de modelo de datos y contrato de captura — Firma de conformidad del PACIENTE por tratamiento

> **Agente:** architect · **Fecha:** 2026-07-27 · **Estado:** Diseño propuesto (NO implementado)
> **Task:** firma de conformidad del paciente por CADA tratamiento realizado (granularidad por prestación).
> **Requerimiento confirmado con Super Admin:** una firma manuscrita (canvas táctil → PNG) por línea de la
> "Ficha de Atención", como evidencia legal de conformidad / no repudio, inmutable y auditable, al mismo
> nivel que la firma del profesional que ya existe en el encounter.
> **Alcance:** SOLO diseño. La implementación (entidades, servicio, controller, migración aplicada) es posterior.

---

## 0. Contexto verificado (leído del repo, no asumido)

| Hecho | Evidencia en código |
| :--- | :--- |
| Firma del PROFESIONAL ya existe, inmutable, con hash | `odontology-encounter.service.ts` `sign()` (líneas ~209-266): `signedBy`/`signedById`/`signedAt`/`contentHash` (SHA-256), `status='finished'`. |
| Inmutabilidad es por **regla de servicio**, NO por trigger de DB | `odontology.service.ts` `assertResourceMutable()` (líneas 57-63): lanza `ForbiddenException` si el encounter está `finished`. No hay trigger en Postgres. |
| Un tratamiento realizado = `Procedure` en `odontology_clinical_resources` con `status:'completed'` + `performedDateTime`, capa `existing`, con `encounterId` (nullable) | `odontology.service.ts` `completeResource()` (líneas 302-330); entidad `odontology-resource.entity.ts`. |
| Auditoría dedicada estilo FHIR AuditEvent ya existe para el encounter | `odontology-encounter-audit.entity.ts` (`odontology_encounter_audit_log`), acciones `OPEN`/`SIGN`/`CANCEL`/`ADDENDA`. |
| **NO existe S3 todavía** | No hay `@aws-sdk` en `hce-backend/package.json`. Todo upload es `multer` `diskStorage` a `process.cwd()/uploads`, URL RELATIVA `/uploads/...` (`file-upload.controller.ts`, `odontology.service.ts` `saveFile()` líneas 245-296). |
| Multi-inquilino Zero Trust: todo filtra por `tenant_id` a nivel app | `assertPatient(patientId, tenantId)` y `where: { ..., tenantId }` en todo el servicio. |
| Rol operador en consultorio | Controllers odonto: `@Roles('medico','enfermero','administrador')`. |

> ⚠️ **Corrección al enunciado del requerimiento:** el requerimiento asume "Almacenamiento S3". **No hay S3
> implementado hoy** (el pendiente "uploads→S3" sigue abierto). Este diseño es **agnóstico del backend de
> almacenamiento**: la tabla guarda un puntero abstracto (`storage_backend` + `storage_key`) + hash, de modo
> que arranca con el disco local existente (`/uploads/...`) y migra a S3 sin cambio de esquema el día que
> `security`/`devops` implementen S3. El hash SHA-256 hace la evidencia **independiente del blob**: aunque el
> archivo migre de disco a S3, la integridad se verifica contra el hash registrado.

---

## 1. Decisión: DÓNDE vive la firma → **(b) tabla nueva dedicada, append-only**

**Elegido: (b) `odontology_patient_signatures` — una fila por firma.**

Descarto (a) columnas en `odontology_clinical_resources` y (c) colgarla del encounter, por estas razones:

| Criterio | (a) columnas en el Procedure | (c) en el encounter | **(b) tabla dedicada (ELEGIDO)** |
| :--- | :--- | :--- | :--- |
| **Granularidad "1 firma por tratamiento"** | Encaja, pero mezcla evidencia legal del paciente con el payload clínico FHIR del odontograma. | ✗ El encounter es 1:N con prestaciones → una sola firma no representa "por tratamiento". | ✓ Modela exactamente la relación N firmas ↔ 1 Procedure / 1 encounter. |
| **Append-only real** | ✗ `odontology_clinical_resources` se **UPDATE-ea** constantemente (`completeResource`, `saveResource` reusa la fila). Una columna ahí NO es inmutable por diseño. | Igual problema si se agregara a `addenda`/payload. | ✓ Tabla sin UPDATE ni DELETE por contrato de servicio + trigger. Inmutabilidad limpia. |
| **Valor probatorio / no repudio** | Contaminado: para reconstruir la evidencia hay que aislar columnas dentro de un JSONB mutable. | Débil: no ata la firma a la prestación concreta. | ✓ Fila autocontenida: qué firmó, cuándo, quién capturó, hash, puntero al PNG. |
| **Auditoría** | Difusa (la fila del recurso ya se audita como dato clínico, no como firma legal). | Difusa. | ✓ Entidad separada = trazabilidad legal separada, replicando el patrón del `audit_log` del encounter. |
| **Reintentos / recaptura** | Sobrescribir = perder evidencia previa. | — | ✓ Recapturar = fila nueva; la anterior queda (marcada `superseded_by`), nunca se borra. |
| **Coste** | 5-6 columnas nullable. | 2-3 columnas. | 1 tabla nueva + 2 índices. Delta chico y contenido. |

**Conclusión:** una firma manuscrita de conformidad es **evidencia médico-legal**, con ciclo de vida y garantías
(inmutabilidad, no repudio, auditoría) distintas al dato clínico. Merece su propia entidad append-only, igual que
`odontology_encounter_audit_log` es una entidad aparte del encounter. Coincide con la hipótesis (b) del Super Admin.

**Nota sobre el "Presupuesto" (`docs/design/presupuesto-odontologico-modelo-datos.md`):** ahí la decisión fue
*reusar* Finanzas porque los campos faltantes eran **atributos del mismo presupuesto**. Acá es lo opuesto: la firma
NO es un atributo del Procedure, es una **entidad legal distinta** con requisitos de inmutabilidad que la tabla de
recursos (mutable por diseño) no puede dar. Las dos decisiones son coherentes bajo el mismo criterio: "¿es el mismo
objeto o uno nuevo con ciclo de vida propio?".

---

## 2. Modelo de datos — `odontology_patient_signatures`

### 2.1 Entidad TypeORM (propuesta)

```ts
@Entity('odontology_patient_signatures')
@Index('idx_odo_patsig_tenant_resource', ['tenantId', 'resourceId'])
@Index('idx_odo_patsig_tenant_encounter', ['tenantId', 'encounterId'])
@Index('idx_odo_patsig_tenant_patient', ['tenantId', 'patientId'])
export class OdontologyPatientSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Aislamiento y vínculos ---
  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;                       // Zero Trust: filtro obligatorio

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;                      // sujeto de la conformidad

  /** Procedure/tratamiento firmado (FK lógica a odontology_clinical_resources.id). NO NULL: la firma es POR prestación. */
  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  /** Visita en la que se firmó (FK lógica a odontology_encounters.id). Nullable = prestación suelta/legacy. */
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  // --- Puntero al blob (NUNCA el blob en DB) ---
  /** Backend de almacenamiento: 'local' (hoy, /uploads) | 's3' (futuro). Permite migrar sin cambiar esquema. */
  @Column({ name: 'storage_backend', type: 'varchar', default: 'local' })
  storageBackend: string;

  /** Puntero al PNG: nombre de archivo local ('sig-...png') o key S3 ('tenant/.../sig-...png'). */
  @Column({ name: 'storage_key', type: 'varchar' })
  storageKey: string;

  @Column({ name: 'mime_type', type: 'varchar', default: 'image/png' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes: number | null;

  // --- Integridad / no repudio ---
  /** SHA-256 (hex) del PNG. Evidencia independiente del blob; verifica que la imagen no se alteró. */
  @Column({ name: 'content_hash', type: 'varchar' })
  contentHash: string;

  /** Timestamp de SERVIDOR (no del cliente) — momento legal de la firma. */
  @Column({ name: 'signed_at', type: 'timestamp with time zone' })
  signedAt: Date;

  /** Quién CAPTURÓ la firma (usuario clínico logueado): sub del JWT. */
  @Column({ name: 'captured_by_id', type: 'varchar' })
  capturedById: string;

  /** Nombre legible del que capturó (preferred_username). */
  @Column({ name: 'captured_by_name', type: 'varchar', nullable: true })
  capturedByName: string | null;

  /** Contexto del acto de firma para no repudio (device/plataforma). NO datos personales del paciente. */
  @Column({ name: 'device_info', type: 'varchar', nullable: true })
  deviceInfo: string | null;              // p.ej. userAgent recortado / "tablet-consultorio-1"

  /** IP de origen del request (opcional, para reforzar no repudio). security decide si se persiste (ePHI/privacidad). */
  @Column({ name: 'source_ip', type: 'varchar', nullable: true })
  sourceIp: string | null;

  // --- Ciclo de vida append-only ---
  /** Si esta firma fue reemplazada por una recaptura, apunta a la nueva. La vieja NUNCA se borra. */
  @Column({ name: 'superseded_by', type: 'uuid', nullable: true })
  supersededBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
  // Deliberadamente SIN @UpdateDateColumn: la fila no se actualiza (salvo el único campo superseded_by, vía trigger permitido).
}
```

### 2.2 Campos mínimos para valor probatorio (respuesta al punto 2)

El set mínimo pedido está cubierto: `storage_key` (imagen), `content_hash` (SHA-256), `signed_at` (timestamp
servidor), `captured_by_id`/`captured_by_name` (quién capturó), `resource_id`+`encounter_id` (a qué refiere),
`tenant_id`. **Agregados justificados para no repudio sin sobredimensionar:**

- `storage_backend`: para no atar la evidencia a "S3" que hoy no existe, y migrar sin cambio de esquema.
- `mime_type` / `size_bytes`: validación e integridad del artefacto (que sea el PNG esperado).
- `device_info`: refuerza el "dónde/cómo" del acto de firma. **Sin datos personales del paciente.**
- `source_ip`: opcional; **decisión de `security`** (aporta a no repudio pero es ePHI/privacidad).
- `superseded_by`: permite recaptura sin violar append-only.

**Deliberadamente NO incluido** (evitar sobredimensionar): geolocalización, nombre del paciente duplicado
(ya está por `patient_id`), firma criptográfica del profesional sobre la firma del paciente (el `content_hash`
+ el `contentHash` del encounter ya encadenan integridad; una PKI del paciente es sobreingeniería para este caso).

---

## 3. Inmutabilidad (respuesta al punto 3) → **regla de servicio + trigger de DB (ambos)**

El encounter hoy protege su firma **solo por regla de servicio** (`assertResourceMutable`). Para una firma de
conformidad del paciente, que es evidencia legal pura, se recomienda **defensa en profundidad**: regla de servicio
(UX/errores claros) **+** trigger de Postgres (garantía dura, aunque un bug del servicio intente un UPDATE/DELETE).

1. **Regla de servicio (capa app):**
   - No existe método `update`/`delete` de firmas en el `PatientSignatureService`. Solo `register` (INSERT) y
     `getByResource`/`getByEncounter` (SELECT).
   - "Recapturar" = INSERT de una fila nueva + set de `superseded_by` en la vieja (única mutación permitida, acotada).

2. **Trigger de DB (capa persistencia):** un `BEFORE UPDATE OR DELETE` que **rechaza** cualquier cambio salvo el
   set idempotente de `superseded_by` de `NULL` a un uuid. Esto convierte la tabla en append-only a nivel motor,
   independiente de bugs de aplicación. Es la mejora respecto al encounter (que confía solo en el servicio).

> Si el equipo prefiere no introducir triggers (consistencia con el resto del repo, que hoy no usa triggers),
> la alternativa mínima es **solo regla de servicio** + revocar `UPDATE`/`DELETE` de la tabla al rol de conexión de
> la app vía `GRANT`. Recomendación del architect: **trigger**, por ser evidencia legal y auto-contenida.
> Queda como punto explícito para que `security` valide.

---

## 4. Contrato de API (respuesta al punto 4)

Módulo odontológico, montado junto al resto de endpoints odonto. Filtro por `tenant_id` (de `req.user.tenantId`)
obligatorio en los tres. Roles: **`medico`, `administrador`** (el profesional en el consultorio presencia y captura
la conformidad del paciente en el dispositivo). Se excluye `recepcionista`/`enfermero` de registrar (acto clínico-legal),
pero SÍ pueden **leer** para mostrar la Ficha.

### 4.1 Estrategia de subida de la imagen → **multipart al backend (hoy), presigned el día de S3**

Dado que **hoy no hay S3**, se usa el patrón ya probado del repo: `FileInterceptor` + `multer` `diskStorage`
(igual que `file-upload.controller.ts`), el backend calcula el SHA-256 del buffer/archivo recibido, persiste el PNG
en `/uploads` y guarda la fila con `storage_backend='local'`.

El día que exista S3 (`security`/`devops`), se cambia a **presigned PUT** sin tocar la tabla:
1. `POST .../signature/presign` → devuelve URL presignada + `storageKey`.
2. El cliente hace PUT del PNG directo a S3.
3. `POST .../signature/confirm` con `storageKey` + hash calculado en cliente (y re-verificado por el backend con un
   HEAD/GET de integridad) → INSERT de la fila con `storage_backend='s3'`.

Para no bloquear el diseño en el pendiente de S3, **el contrato v1 es multipart** (funciona ya):

### 4.2 Endpoints

**(i) Registrar la firma de una prestación**
```
POST /odontology/patient/:patientId/resource/:resourceId/signature
Roles: medico, administrador
Content-Type: multipart/form-data
Body:
  - file: <PNG>                (campo 'file', FileInterceptor; fileFilter solo image/png; limit ~2 MB)
  - encounterId?: uuid         (opcional; si la prestación pertenece a una visita)
  - deviceInfo?: string        (opcional)
Backend:
  1. assertPatient(patientId, tenantId) + verifica que resourceId pertenece a (patientId, tenantId) y es Procedure completed.
  2. Rechaza si ya existe firma vigente para ese resourceId (no supersedida) salvo modo 'recaptura' explícito.
  3. Calcula sha256 del PNG, guarda blob (local/S3), INSERT de la fila con signed_at = now() de servidor,
     captured_by_id/name = req.user, source_ip/deviceInfo del request.
  4. Audita el acto: action 'PATIENT_SIGN' en el audit_log (ver §5).
Response 201:
  {
    "id": "...", "resourceId": "...", "encounterId": "...|null",
    "signedAt": "2026-07-27T...Z", "contentHash": "sha256-hex",
    "capturedByName": "dra.gomez", "storageBackend": "local",
    "imageUrl": "/uploads/sig-....png"   // URL para render; en S3 sería presigned GET de corta vida
  }
```

**(ii) Recuperar la firma para mostrarla en la Ficha**
```
GET /odontology/patient/:patientId/resource/:resourceId/signature
Roles: medico, enfermero, recepcionista, administrador   (lectura para armar la Ficha)
Response 200:  { ...misma forma... } | 404 si no hay firma
```

**(ii-bis) Recuperar todas las firmas de una visita (para la Ficha de Atención completa)**
```
GET /odontology/patient/:patientId/encounter/:encounterId/signatures
Roles: medico, enfermero, recepcionista, administrador
Response 200:  [{ resourceId, signedAt, contentHash, imageUrl, capturedByName }, ...]
```
> Esto alimenta directamente la columna "Firma de conformidad" de la Ficha (§6): una consulta por encounter
> devuelve el estado firmado/no-firmado de cada línea, sin N+1.

Todos: 403 si el `tenantId` del recurso no coincide con `req.user.tenantId` (Zero Trust).

---

## 5. SQL de migración (propuesta, NO aplicar) — sigue `docs/PROTOCOLO-CAMBIOS-DB.md`

Archivo propuesto: `hce-backend/src/migrations/20260727_1600_firma_conformidad_paciente.sql`
(aditivo, idempotente `IF NOT EXISTS`, sin DROP/DELETE, `\c hce_fhir;`, `SET lock_timeout='3s'`).

```sql
-- 20260727_1600_firma_conformidad_paciente.sql
-- Firma de conformidad del paciente por prestación (append-only). Aditivo e idempotente.
\c hce_fhir;
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS odontology_patient_signatures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        varchar NOT NULL,
  patient_id       uuid NOT NULL,
  resource_id      uuid NOT NULL,
  encounter_id     uuid NULL,
  storage_backend  varchar NOT NULL DEFAULT 'local',
  storage_key      varchar NOT NULL,
  mime_type        varchar NOT NULL DEFAULT 'image/png',
  size_bytes       integer NULL,
  content_hash     varchar NOT NULL,
  signed_at        timestamptz NOT NULL DEFAULT now(),
  captured_by_id   varchar NOT NULL,
  captured_by_name varchar NULL,
  device_info      varchar NULL,
  source_ip        varchar NULL,
  superseded_by    uuid NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_resource  ON odontology_patient_signatures (tenant_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_encounter ON odontology_patient_signatures (tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_odo_patsig_tenant_patient   ON odontology_patient_signatures (tenant_id, patient_id);

-- Una sola firma VIGENTE (no supersedida) por prestación:
CREATE UNIQUE INDEX IF NOT EXISTS uq_odo_patsig_resource_vigente
  ON odontology_patient_signatures (tenant_id, resource_id)
  WHERE superseded_by IS NULL;

-- Inmutabilidad append-only a nivel motor (defensa en profundidad).
-- Rechaza UPDATE (salvo set único de superseded_by NULL->uuid) y todo DELETE.
CREATE OR REPLACE FUNCTION odo_patsig_no_mutate() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Firma de conformidad inmutable: DELETE no permitido';
  END IF;
  -- UPDATE: solo se tolera marcar superseded_by por primera vez.
  IF OLD.superseded_by IS NOT NULL
     OR NEW.id <> OLD.id OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.resource_id <> OLD.resource_id OR NEW.content_hash <> OLD.content_hash
     OR NEW.storage_key <> OLD.storage_key OR NEW.signed_at <> OLD.signed_at
     OR NEW.captured_by_id <> OLD.captured_by_id THEN
    RAISE EXCEPTION 'Firma de conformidad inmutable: solo se permite marcar superseded_by una vez';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_odo_patsig_no_mutate ON odontology_patient_signatures;
CREATE TRIGGER trg_odo_patsig_no_mutate
  BEFORE UPDATE OR DELETE ON odontology_patient_signatures
  FOR EACH ROW EXECUTE FUNCTION odo_patsig_no_mutate();
```

> `gen_random_uuid()` requiere `pgcrypto` (habitual en RDS); si no está, el default de la entidad TypeORM
> (`PrimaryGeneratedColumn('uuid')`) lo cubre desde la app. El `DROP TRIGGER IF EXISTS` antes del `CREATE` mantiene
> idempotencia sin violar la regla (no borra datos, solo redefine el guard). Revisar con `security`/`devops` si el
> repo acepta triggers (hoy no hay ninguno) o si se prefiere `GRANT`/regla de servicio (§3).

---

## 6. Relación con la Ficha de Atención (respuesta al punto 6)

La "Ficha de Atención" lista las prestaciones realizadas (Procedures `completed`) de una visita. Su columna
**"Firma de conformidad"** se alimenta 1:1 de esta tabla:

- Por cada línea (Procedure), el frontend consulta `GET .../encounter/:encounterId/signatures` y hace match por
  `resourceId`:
  - **Con firma vigente** → muestra thumbnail del PNG (`imageUrl`) + tooltip "Firmado por el paciente el {signed_at},
    capturado por {captured_by_name}". Verificable por `content_hash`.
  - **Sin firma** → botón "Capturar firma" (abre el canvas táctil) → `POST .../resource/:resourceId/signature`.
- **Coherencia con `presupuesto-odontologico-modelo-datos.md`:** la Ficha de Atención combina dos fuentes distintas
  y complementarias — el **detalle económico** viene de Finanzas (`clinica_presupuesto_items`, reusado) y la
  **conformidad legal** viene de esta tabla nueva. No se mezclan: el presupuesto es "qué se cobra", la firma es
  "el paciente conforma que se le hizo". Ambas se muestran en la misma grilla pero son entidades separadas, cada
  una en su tabla apropiada. Ninguna migración pisa a la otra (distintos archivos, distintas tablas).

---

## 7. Riesgos, dependencias y handoff a otros agentes (respuesta al punto 7)

### 7.1 Dependencias de flujo
- **Depende del ciclo "completar/firmar visita":** la firma se captura sobre un Procedure `completed`. Definir la
  regla de negocio con `product`: ¿se puede firmar antes de firmar la visita (recomendado: sí, la conformidad del
  paciente es por acto, ocurre en el momento) o solo después? Recomendación architect: **permitir firmar la
  conformidad mientras la visita está `in-progress`**, porque el paciente firma cuando se le hace el tratamiento,
  no al cierre administrativo. La firma del PROFESIONAL (cierre de visita) y la del PACIENTE (por prestación) son
  independientes y no se bloquean entre sí.

### 7.2 Legacy (prestaciones ya realizadas sin firma)
- Prestaciones `completed` previas a esta feature NO tendrán firma. **No se retro-firma** (violaría el no repudio:
  el paciente no estuvo presente). La Ficha las muestra como "Sin firma de conformidad (registro previo)". `product`
  confirma el texto. `superseded_by`/append-only garantizan que nunca se fabrique evidencia retroactiva.

### 7.3 Imagen: tamaño y formato
- Formato fijo **PNG** (canvas → `toBlob('image/png')`). Límite sugerido **~2 MB** (una firma monocroma comprime muy
  por debajo). `fileFilter` rechaza todo lo que no sea `image/png`. Recomendable normalizar dimensiones del canvas
  en el frontend (p.ej. 600×200) para acotar peso — lo define `ux`.

### 7.4 Para `security` (revisar explícitamente)
- **No repudio:** validar el set de campos (§2.2), decisión sobre persistir `source_ip` (ePHI/privacidad) y si se
  exige trigger de DB o basta regla de servicio + `GRANT` (§3).
- **Cifrado en reposo:** hoy el blob va a disco local sin cifrar (igual que el resto de `/uploads`). Definir cifrado
  en reposo (SSE-S3/KMS cuando exista S3; o cifrado de volumen mientras sea local). El hash NO reemplaza cifrado.
- **Auditoría:** registrar el acto de firma como `AuditEvent`. Recomendación: **reusar el patrón de
  `odontology_encounter_audit_log`** con una acción nueva `PATIENT_SIGN` (y `PATIENT_SIGN_SUPERSEDE`), imputable a
  `captured_by_id`. Decidir si va en ese log o en uno propio.
- **Autorización de lectura del PNG:** el binario de la firma es ePHI; su GET debe pasar por auth + filtro tenant
  (hoy `/uploads` se sirve estático — revisar que la firma no quede accesible sin token; con S3, presigned GET de
  corta vida).

### 7.5 Para `fhir-mcp` (mapear)
- Mapear la firma a **FHIR `Signature`** (datatype): `type` = código de "consent/conformidad", `when` = `signed_at`,
  `who` = `Patient/{patientId}`, `data` = referencia al PNG (no el base64 en DB), `sigFormat` = `image/png`.
- Envolver el acto en **`Provenance`** (`target` = el Procedure, `agent` = paciente firmante + `captured_by` como
  agente de transcripción, `signature` = el `Signature` anterior) para la cadena de custodia.
- Evaluar **`Consent`** si legalmente la conformidad por tratamiento debe modelarse como consentimiento; si es solo
  "acuse de recibo de la prestación", `Provenance`+`Signature` alcanza. Que `fhir-mcp` decida el recurso canónico y
  cómo se expone en `/fhir/r4/...` (probablemente `Provenance` como recurso de salida derivado de esta tabla).

### 7.6 Riesgo técnico
- El repo hoy **no usa triggers**; introducir uno es una novedad de patrón (aunque justificada para evidencia legal).
  Si `revisor`/`devops` lo objetan por consistencia, el fallback es regla de servicio + `GRANT` sin `UPDATE/DELETE`.
  Documentado como decisión abierta para el Quality Gate.

---

## 8. Resumen accionable

- **Decisión:** opción **(b)** — tabla nueva `odontology_patient_signatures`, append-only, 1 fila por firma por
  Procedure. (No columnas en el recurso, no en el encounter.)
- **Almacenamiento:** agnóstico (`storage_backend`); arranca `local` (multer, como el repo ya hace), migra a S3 sin
  cambio de esquema. **S3 NO existe aún** — el enunciado lo asumía; corregido acá.
- **Inmutabilidad:** regla de servicio (sin métodos update/delete) **+** trigger de DB (recomendado) o `GRANT`
  (fallback). Recaptura = fila nueva + `superseded_by`.
- **API:** `POST/GET .../resource/:resourceId/signature` (registrar/leer) y `GET .../encounter/:id/signatures`
  (Ficha). Registrar: `medico`/`administrador`; leer: todos los roles clínicos. Filtro tenant obligatorio.
- **Migración:** propuesta escrita en §5, NO aplicada, cumple el PROTOCOLO.
- **Handoff:** `security` (no repudio, cifrado en reposo, AuditEvent, trigger vs GRANT), `fhir-mcp`
  (`Signature`/`Provenance`/`Consent`), `product` (momento de firma, texto legacy), `ux` (canvas + columna en Ficha).
```
