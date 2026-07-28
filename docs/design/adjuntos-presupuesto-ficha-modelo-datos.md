# Diseño de modelo de datos y contrato de carga — Adjuntos (RX + archivos) en Presupuesto y Ficha de Atención

> **Agente:** architect · **Fecha:** 2026-07-27 · **Estado:** Diseño propuesto (NO implementado)
> **Task:** adjuntar RX y archivos (imágenes JPG/PNG + PDF) en DOS puntos de anclaje: (1) al presupuesto
> (cabecera, coherente con `rx_presentadas`) y (2) a cada tratamiento realizado (Procedure de la Ficha de Atención).
> **Alcance:** SOLO diseño. La implementación (entidad, servicio, controller, migración aplicada) es posterior.
> **Documento hermano:** `docs/design/firma-conformidad-paciente-modelo-datos.md` (reusa su patrón de storage agnóstico).

---

## 0. Contexto verificado (leído del repo, no asumido)

| Hecho | Evidencia en código |
| :--- | :--- |
| **NO existe S3.** Todo upload es `multer diskStorage` a `process.cwd()/uploads`, URL relativa `/uploads/...` | `hce-backend/src/patient/file-upload.controller.ts` (líneas 44-97); `odontology.service.ts` `saveFile()` (245-296). |
| Whitelist de MIME y límite de tamaño ya existen como patrón | `file-upload.controller.ts` (25-35): `ALLOWED_MIME_TYPES` + `MAX_FILE_SIZE_BYTES = 20 MB` + `fileFilter`. |
| Sanitización de nombre ya se hace al borrar | `file-upload.controller.ts` (107): `filename.replace(/[^a-zA-Z0-9.\-_]/g, '')`; ídem `odontology.service.ts` (342). |
| Un tratamiento realizado = `Procedure` en `odontology_clinical_resources`, `status:'completed'`, con `encounterId` | `odontology.service.ts` `completeResource()` (302-330); `odontology-resource.entity.ts`. |
| El presupuesto vive en `clinica_presupuestos` (PK uuid, `tenant_id`, `patient_id`) + `clinica_presupuesto_items` | `clinical-presupuesto.entity.ts`; `rx_presentadas` en línea 52-53. |
| `rx_presentadas int` ya existe en la cabecera (conteo manual hoy) | `clinical-presupuesto.entity.ts` (52-53); migración `20260721_1500_presupuesto_odontologico_campos.sql` (45-46). |
| Multi-inquilino Zero Trust: todo filtra por `tenant_id` a nivel app (no RLS) | `assertPatient(patientId, tenantId)`, `where: { ..., tenantId }` en todo `odontology.service.ts`. |
| **`/uploads` se sirve estático SIN autenticación** | `main.ts` (24): `app.use('/uploads', express.static(uploadsDir))`. ⚠️ hallazgo de seguridad — ver §3.4 y handoff a `security`. |

> ⚠️ **Corrección de premisa (igual que en el doc de firma):** el requerimiento hablaba de "almacenamiento S3".
> **Hoy no hay S3.** Este diseño es **agnóstico de backend de almacenamiento** (`storage_backend` + `storage_key` + `hash`),
> arranca con el disco local existente y migra a S3 sin cambio de esquema el día que `security`/`devops` lo implementen.

---

## 1. Decisión de modelo de datos → **tabla única polimórfica `clinical_attachments`**

**Elegido: una sola tabla `clinical_attachments` con anclaje polimórfico** (`owner_type` ∈ `'presupuesto' | 'procedure'`, `owner_id`).
Descarto dos tablas separadas (`presupuesto_attachments` + `procedure_attachments`).

| Criterio | Dos tablas separadas | **Tabla única polimórfica (ELEGIDO)** |
| :--- | :--- | :--- |
| **El adjunto es el MISMO objeto** en ambos anclajes (RX/PDF con idéntico ciclo de vida) | ✗ Duplica columnas idénticas (storage, hash, mime, soft-delete, auditoría) en 2 tablas. | ✓ Un solo esquema, un solo servicio, un solo validador de MIME, una sola lógica de borrado/descarga. |
| **Superficie de código** (servicio, DTO, tests, migración) | ✗ Doble de todo; dos controllers casi calcados → deuda de mantenimiento. | ✓ Un `AttachmentService` con `ownerType` como parámetro. DRY. |
| **Consultar "todos los adjuntos de un paciente"** (galería/timeline futuro) | ✗ UNION de dos tablas. | ✓ `WHERE tenant_id=? AND patient_id=?` en una tabla. |
| **Integridad referencial dura (FK real)** | ✓ FK a cada tabla padre. | ✗ No hay FK polimórfica en Postgres → integridad por regla de servicio (igual que el resto del repo, que ya usa FK lógicas: `encounterId`, `source_resource_id`). |
| **Riesgo de owner_id apuntando a la tabla equivocada** | No aplica. | Mitigado: el servicio valida que `owner_id` existe en la tabla correcta según `owner_type` **y pertenece al mismo `tenant_id`** antes de insertar (mismo patrón que `assertPatient`). |

**Conclusión.** El adjunto NO es un atributo del presupuesto ni del Procedure: es un artefacto binario con ciclo de vida propio
(subir, listar, ver, borrar/reemplazar) idéntico sin importar a qué se ancle. Es exactamente el caso de uso de una tabla
polimórfica. La única desventaja (sin FK dura) ya es el patrón del repo (todas las relaciones odonto son FK lógicas filtradas
por `tenant_id` en el servicio), así que no introduce un patrón nuevo. Coherente con el criterio del doc de firma: "¿es el mismo
objeto o uno nuevo con ciclo de vida propio?" → acá **es el mismo objeto** en dos anclajes → una tabla.

### 1.1 Diferencia clave con la firma: los adjuntos SÍ se borran/reemplazan → **soft-delete**

La firma de conformidad es evidencia legal **append-only** (nunca se borra). Un adjunto es distinto: una RX se puede subir mal
(mal encuadrada, paciente equivocado, duplicada) y hay que corregirla. Decisión:

- **Soft-delete, NO hard-delete.** Columna `deleted_at` + `deleted_by`. El binario en disco NO se borra en el borrado lógico
  (permite recuperación y auditoría); su purga física es un proceso posterior/manual (fuera de alcance v1). Esto contrasta con
  `odontology.service.ts` `deleteResource()` (332-349) que sí `unlink`ea el archivo — acá **no** lo hacemos en el borrado del usuario,
  por trazabilidad de ePHI (un adjunto clínico borrado debe poder auditarse).
- **Reemplazar = soft-delete del viejo + insert del nuevo** (misma semántica que el `superseded_by` de la firma, pero más simple:
  aquí no hay valor probatorio que preservar como cadena, solo trazabilidad de auditoría vía `deleted_at`).
- **Quién puede borrar (regla de rol):** `medico` y `administrador`. El `recepcionista` puede **cargar** RX administrativas del
  presupuesto (acto administrativo, ver §2.3) pero **no borra** adjuntos clínicos. `enfermero` no borra. Un adjunto anclado a un
  Procedure de un encounter `finished` (visita firmada): el borrado se **bloquea** (el adjunto es parte de la evidencia clínica ya
  cerrada) — reusar `assertResourceMutable()` del encounter. `security`/`product` confirman esta regla.

---

## 2. Modelo de datos — `clinical_attachments`

### 2.1 Entidad TypeORM (propuesta)

```ts
@Entity('clinical_attachments')
@Index('idx_clin_attach_tenant_owner', ['tenantId', 'ownerType', 'ownerId'])
@Index('idx_clin_attach_tenant_patient', ['tenantId', 'patientId'])
export class ClinicalAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Aislamiento y anclaje polimórfico ---
  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;                       // Zero Trust: filtro obligatorio en TODA query

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;                      // desnormalizado: permite listar adjuntos por paciente sin joins

  /** A qué se ancla: 'presupuesto' (clinica_presupuestos.id) | 'procedure' (odontology_clinical_resources.id). */
  @Column({ name: 'owner_type', type: 'varchar' })
  ownerType: 'presupuesto' | 'procedure';

  /** id de la fila padre (FK lógica, validada en servicio contra la tabla que indica owner_type + tenant_id). */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  // --- Puntero al blob (NUNCA el blob en DB) — patrón del doc de firma ---
  /** 'local' (hoy, /uploads) | 's3' (futuro). Migra sin cambiar esquema. */
  @Column({ name: 'storage_backend', type: 'varchar', default: 'local' })
  storageBackend: string;

  /** Nombre de archivo local ('att-...jpg') o key S3 ('tenant/.../att-...jpg'). */
  @Column({ name: 'storage_key', type: 'varchar' })
  storageKey: string;

  /** Nombre original que subió el usuario (para mostrar). NO se usa como ruta en disco. */
  @Column({ name: 'filename', type: 'varchar' })
  filename: string;

  /** MIME validado por whitelist: solo image/jpeg | image/png | application/pdf. */
  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  /** SHA-256 (hex) del blob. Integridad + dedupe opcional + evidencia independiente del backend. */
  @Column({ name: 'hash', type: 'varchar' })
  hash: string;

  /** Clasificación opcional: 'rx' | 'foto' | 'documento' | 'consentimiento'... (default derivado del MIME). */
  @Column({ name: 'kind', type: 'varchar', nullable: true })
  kind: string | null;

  /** Descripción libre opcional (ej. "RX periapical pieza 36 pre-endodoncia"). */
  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string | null;

  // --- Auditoría de carga ---
  @Column({ name: 'uploaded_by', type: 'varchar' })
  uploadedById: string;                   // sub del JWT

  @Column({ name: 'uploaded_by_name', type: 'varchar', nullable: true })
  uploadedByName: string | null;          // preferred_username (legible)

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamp with time zone' })
  uploadedAt: Date;

  // --- Soft-delete (los adjuntos SÍ se borran, a diferencia de la firma) ---
  @Column({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'varchar', nullable: true })
  deletedById: string | null;
}
```

> Se usa `owner_id uuid`: tanto `clinica_presupuestos.id` como `odontology_clinical_resources.id` son uuid (verificado en las
> entidades). El `patient_id` desnormalizado (redundante con el padre) es deliberado: habilita "galería de adjuntos del paciente"
> con un solo `WHERE` y refuerza el filtro tenant sin joins.

---

## 3. Validación de seguridad de archivos (respuesta al punto 3)

### 3.1 Whitelist de MIME (más estricta que la del repo)

El repo hoy acepta `image/webp`, `image/gif`, `doc`, `docx` (`file-upload.controller.ts`). Para adjuntos clínicos el
requerimiento acota a **solo 3 tipos**:

```ts
const ATTACHMENT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const ATTACHMENT_MAX_SIZE = 15 * 1024 * 1024; // 15 MB (RX de alta resolución) — ver §6
```

- `fileFilter` de multer rechaza todo lo que no esté en la whitelist (`BadRequestException` en español, como ya hace el repo).
- **Doble verificación (defensa en profundidad):** el `Content-Type` declarado por el cliente es falsificable. `security` debe
  validar además los **magic bytes** reales del archivo (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `25 50 44 46`) tras recibirlo,
  y rechazar si el contenido no coincide con el MIME declarado. (Hoy el repo NO hace esta verificación de firma binaria — es una
  mejora que introduce este módulo; marcarlo en el Quality Gate de `security`.)

### 3.2 Sanitización de nombre y anti path-traversal

- El nombre en disco lo genera el backend (`att-{timestamp}-{rand}{ext}`), **nunca** el `originalname` del cliente (patrón ya usado
  en `file-upload.controller.ts` línea 54-58). La extensión se deriva del MIME validado, no del nombre subido.
- `originalname` se guarda solo en la columna `filename` (para mostrar), **nunca** se usa como ruta.
- En descarga/borrado, sanitizar cualquier input de nombre con `replace(/[^a-zA-Z0-9.\-_]/g, '')` (patrón ya en el repo).

### 3.3 Límite de tamaño y cantidad

- `ATTACHMENT_MAX_SIZE = 15 MB` por archivo (multer `limits.fileSize`). Ajustable por `security`/`product`.
- Límite de cantidad por owner (ej. máx 20 adjuntos por presupuesto/procedure): regla de servicio, no de multer. Evita abuso de disco.

### 3.4 Autorización de descarga (⚠️ hallazgo crítico)

**Hoy `/uploads` se sirve estático SIN autenticación** (`main.ts` línea 24: `express.static`). Esto significa que cualquier
adjunto (RX = ePHI) accesible por URL relativa queda **públicamente descargable si se conoce/adivina el nombre**. Este módulo
NO debe reusar ese canal para ePHI. Decisión:

- La descarga pasa por un **endpoint autenticado** (`GET .../attachment/:id/download`) que: valida JWT + rol + `tenant_id` del
  adjunto, y recién ahí hace `res.sendFile()` del blob local (o `presigned GET` de corta vida cuando exista S3). El binario **no**
  se expone por `/uploads` directo.
- `security` debe decidir si además se mueve el almacén de adjuntos clínicos fuera de `process.cwd()/uploads` (que es público) a
  una carpeta privada servida solo por el endpoint. **Recomendación architect: sí** (`process.cwd()/private-uploads` o similar),
  para que ningún adjunto de ePHI cuelgue de la estática pública.

### 3.5 Qué debe revisar `security` explícitamente (handoff)

- **Path traversal:** nombre en disco generado por backend, sanitización en descarga/borrado (§3.2). ✓ diseñado, validar.
- **Contenido malicioso:** magic-bytes vs MIME (§3.1); PDF con JavaScript embebido / imágenes con payload — decidir si se
  desactiva render inline peligroso (servir siempre `Content-Disposition: attachment` o sandbox del visor PDF en el front).
- **Cifrado en reposo:** el blob va a disco local sin cifrar (igual que el resto de `/uploads`). Definir cifrado de volumen ahora,
  SSE-S3/KMS cuando exista S3. El `hash` NO reemplaza cifrado.
- **AuditEvent de ePHI:** registrar `ATTACH_UPLOAD`, `ATTACH_DOWNLOAD` y `ATTACH_DELETE` (acceso a ePHI es auditable). Reusar el
  patrón `odontology_encounter_audit_log`. Descargar una RX es acceso a dato de salud → debe quedar trazado a `uploaded_by`/quien descarga.
- **Exposición pública de `/uploads`:** §3.4 — cerrar el canal estático para ePHI.

---

## 4. Contrato de API (respuesta al punto 2)

Filtro por `tenant_id` (de `req.user.tenantId`) **obligatorio** en todos. Un solo `AttachmentController` con `ownerType` en la
ruta. Estrategia de subida: **multipart al backend** (patrón probado del repo), migrable a presigned PUT el día de S3 sin tocar la
tabla (mismo razonamiento que §4.1 del doc de firma).

### 4.1 Roles

| Acción | `medico` | `administrador` | `recepcionista` | `enfermero` |
| :--- | :---: | :---: | :---: | :---: |
| Subir adjunto a **presupuesto** (RX administrativa a OS) | ✓ | ✓ | ✓ | ✗ |
| Subir adjunto a **procedure** (acto clínico) | ✓ | ✓ | ✗ | ✗ |
| Listar / descargar | ✓ | ✓ | ✓ | ✓ |
| Borrar (soft-delete) | ✓ | ✓ | ✗ | ✗ |

> `recepcionista` puede cargar RX al **presupuesto** porque es tarea administrativa (armar el expediente para la OS, coherente con
> `rx_presentadas`), pero NO al procedure ni borra. `product`/`security` confirman.

### 4.2 Endpoints

**(i) Subir un adjunto a un presupuesto**
```
POST /finanzas/presupuestos/:presupuestoId/attachments
Roles: medico, administrador, recepcionista
Content-Type: multipart/form-data
Body:
  - file: <JPG|PNG|PDF>   (campo 'file', FileInterceptor, ATTACHMENT_ALLOWED_MIME, limit 15 MB)
  - kind?: string         ('rx' | 'documento' | ...)
  - description?: string
Backend:
  1. Verifica que presupuestoId pertenece a (tenant_id) — SELECT en clinica_presupuestos WHERE id=? AND tenant_id=?.
  2. Deriva patient_id del presupuesto (no se confía en input del cliente).
  3. Valida MIME (whitelist) + magic bytes; calcula sha256; guarda blob (local privado / S3).
  4. INSERT con owner_type='presupuesto', owner_id=presupuestoId, uploaded_by=req.user, kind (default 'rx' si imagen).
  5. Audita ATTACH_UPLOAD.
Response 201: { id, ownerType, ownerId, filename, mimeType, sizeBytes, kind, uploadedAt, uploadedByName,
                downloadUrl: "/finanzas/presupuestos/:id/attachments/:attId/download" }
```

**(ii) Subir un adjunto a una prestación/procedure**
```
POST /odontology/patient/:patientId/resource/:resourceId/attachments
Roles: medico, administrador
Content-Type: multipart/form-data  (mismo body que (i))
Backend:
  1. assertPatient(patientId, tenantId) + verifica que resourceId es un Procedure de (patientId, tenant_id).
  2. (Opcional/config) rechazar si el encounter del resource está 'finished' (assertResourceMutable) — ver §1.1.
  3. Valida + hash + guarda blob; INSERT owner_type='procedure', owner_id=resourceId, patient_id.
  4. Audita ATTACH_UPLOAD.
Response 201: { ...igual forma..., downloadUrl: "/odontology/.../attachments/:attId/download" }
```

**(iii) Listar adjuntos de cada anclaje**
```
GET /finanzas/presupuestos/:presupuestoId/attachments          Roles: todos los clínicos
GET /odontology/patient/:patientId/resource/:resourceId/attachments   Roles: todos los clínicos
Filtra: tenant_id + owner + deleted_at IS NULL.
Response 200: [{ id, filename, mimeType, sizeBytes, kind, description, uploadedAt, uploadedByName, downloadUrl }, ...]
```
> Para la Ficha de Atención completa (evitar N+1), endpoint de conveniencia:
> `GET /odontology/patient/:patientId/encounter/:encounterId/attachments` → devuelve todos los adjuntos de las prestaciones de la
> visita, agrupables por `owner_id` en el front.

**(iv) Descargar / visualizar (autenticado — NO por /uploads público)**
```
GET .../attachments/:attId/download
Roles: todos los clínicos
Backend: valida JWT + rol + tenant_id del adjunto → res.sendFile(blob privado) (o presigned GET S3, TTL corto).
         Content-Disposition según §3.5 (decisión de security: inline seguro vs attachment).
         Audita ATTACH_DOWNLOAD.
Response 200: binario (image/jpeg | image/png | application/pdf) | 403 si tenant no coincide | 404 si borrado/inexistente.
```

**(v) Borrar (soft-delete, con regla de rol)**
```
DELETE .../attachments/:attId
Roles: medico, administrador
Backend:
  1. Verifica adjunto de (tenant_id).
  2. Si owner_type='procedure' y encounter 'finished' → 403 (evidencia clínica cerrada, §1.1).
  3. UPDATE SET deleted_at=now(), deleted_by=req.user. El blob NO se borra del disco (trazabilidad ePHI).
  4. Audita ATTACH_DELETE.
Response 204.
```

Todos: **403** si el `tenant_id` del recurso/adjunto ≠ `req.user.tenantId` (Zero Trust, patrón del repo).

---

## 5. SQL de migración (propuesta, NO aplicar) — sigue `docs/PROTOCOLO-CAMBIOS-DB.md`

Archivo propuesto: `hce-backend/src/migrations/20260727_1700_crear_tabla_clinical_attachments.sql`
(aditivo, idempotente `IF NOT EXISTS`, sin DROP/DELETE, `\c hce_fhir;`, `SET lock_timeout='3s'`, índice de `tenant_id`).

```sql
-- 20260727_1700_crear_tabla_clinical_attachments.sql
-- Adjuntos (RX/imágenes JPG-PNG + PDF) anclados polimórficamente a presupuesto o procedure.
-- Diseño: docs/design/adjuntos-presupuesto-ficha-modelo-datos.md
-- Naturaleza: EXPAND (tabla nueva). Sin DROP/DELETE. Idempotente.
\c hce_fhir;
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS clinical_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         varchar NOT NULL,               -- multi-inquilino: SIEMPRE
  patient_id        uuid NOT NULL,
  owner_type        varchar NOT NULL,               -- 'presupuesto' | 'procedure'
  owner_id          uuid NOT NULL,
  storage_backend   varchar NOT NULL DEFAULT 'local',
  storage_key       varchar NOT NULL,
  filename          varchar NOT NULL,
  mime_type         varchar NOT NULL,               -- whitelist en app: image/jpeg|image/png|application/pdf
  size_bytes        integer NOT NULL,
  hash              varchar NOT NULL,               -- SHA-256 hex
  kind              varchar NULL,                   -- 'rx' | 'foto' | 'documento' | ...
  description       varchar NULL,
  uploaded_by       varchar NOT NULL,
  uploaded_by_name  varchar NULL,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz NULL,               -- soft-delete
  deleted_by        varchar NULL,
  CONSTRAINT chk_clin_attach_owner_type CHECK (owner_type IN ('presupuesto','procedure'))
);

-- Toda query filtra por tenant + owner (listar adjuntos de un presupuesto/procedure):
CREATE INDEX IF NOT EXISTS idx_clin_attach_tenant_owner
  ON clinical_attachments (tenant_id, owner_type, owner_id)
  WHERE deleted_at IS NULL;

-- Galería/timeline de adjuntos de un paciente:
CREATE INDEX IF NOT EXISTS idx_clin_attach_tenant_patient
  ON clinical_attachments (tenant_id, patient_id)
  WHERE deleted_at IS NULL;
```

> **Sin FK dura** (polimórfica): integridad por regla de servicio (§1). Coherente con el repo (FK lógicas + filtro tenant).
> `gen_random_uuid()` requiere `pgcrypto` (habitual en RDS); si falta, el `@PrimaryGeneratedColumn('uuid')` de TypeORM lo cubre
> desde la app. **Recordatorio del PROTOCOLO §5:** esta tabla NO protege nada por sí sola — el servicio DEBE filtrar por
> `tenant_id` en toda query; se revisa junto con `security`.

---

## 6. Relación con `rx_presentadas` (respuesta al punto 6)

Hoy `rx_presentadas int` es un **conteo manual** en la cabecera del presupuesto (el papel PAMI/OS lo pide como número).
Dos opciones y recomendación:

| Opción | Descripción | Veredicto |
| :--- | :--- | :--- |
| **A — derivar** | `rx_presentadas` = `COUNT(*)` de adjuntos del presupuesto con `kind='rx'` (o `mime_type` imagen) y `deleted_at IS NULL`. | Elegante pero **acopla** el número contable a la carga de archivos. El odontólogo puede querer declarar "presenté 3 RX a la OS" aunque no las haya digitalizado todas en el sistema (o las presentó en papel). |
| **B — mantener manual + sugerir (RECOMENDADO)** | `rx_presentadas` sigue siendo un campo editable manual. La UI **sugiere** el valor = cantidad de adjuntos imagen del presupuesto y avisa si difiere ("Tenés 2 RX adjuntas pero declaraste 3"), sin forzar. | ✓ No rompe la semántica administrativa existente, evita desincronización silenciosa, y aún así ayuda. Coherente con la nota de la migración PAMI sobre "Saldo" (no persistir derivados que se desincronizan, pero aquí el dato SÍ es declarativo del usuario). |

**Recomendación: Opción B.** `rx_presentadas` es un dato **declarativo hacia la OS** (qué dijo el profesional que presentó),
no un derivado del sistema. Los adjuntos son la **evidencia digitalizada**, que puede o no coincidir 1:1. La UI concilia
mostrando ambos, pero no los fusiona. `product` valida.

---

## 7. UX / enganche (respuesta al punto 5 — handoff a `ux`)

Coherente con `docs/design/modal-presupuesto-odontologico.md` (modal de 3 pestañas) y el doc de firma.

- **Pestaña "Presupuesto" (cabecera):** una **zona de adjuntos** al pie de la tabla de líneas, junto al campo `rx_presentadas`.
  Dropzone (arrastrar/soltar o botón "Adjuntar RX/archivo") + grilla de miniaturas (thumbnail de imagen, ícono `FileText` de
  `lucide-react` para PDF) con nombre, tamaño, quién subió y botón borrar (solo `medico`/`administrador`). Acepta solo JPG/PNG/PDF;
  rechazo con mensaje claro en español. Al lado del contador `rx_presentadas`, el aviso de conciliación de §6 (Opción B).
- **Pestaña "Ficha de atención":** por cada línea (Procedure realizado), un **control de adjunto por fila** (ícono clip +
  contador "2 adjuntos") que abre un popover/mini-galería con los adjuntos de ESE tratamiento (ej. la RX de esa endodoncia).
  Estados: sin adjuntos → botón "Adjuntar"; con adjuntos → miniaturas + "Agregar". Si el encounter está `finished`, el control
  pasa a solo-lectura (ver, no borrar/agregar) — coherente con §1.1.
- **Visor:** click en miniatura → lightbox para imagen, visor embebido/descarga para PDF, siempre vía el **endpoint autenticado**
  de descarga (§3.4), nunca por URL `/uploads` directa.
- **Responsive (regla innegociable):** la grilla de miniaturas colapsa a 1 columna en mobile; la dropzone es full-width; el control
  por fila de la Ficha se mantiene accesible (tap target ≥ 44px). `ux` define el layout fino y los tokens (`design-system`).
- **Accesibilidad:** `aria-label` en dropzone ("Adjuntar RX o archivo al presupuesto, solo JPG PNG o PDF"), foco visible, feedback
  de progreso de subida, y anuncio de errores de validación por `aria-live`.

**Handoff a `ux`:** materializar la dropzone + grilla de miniaturas + control por fila con los componentes/tokens del
`design-system`, respetando el layout del modal ya especificado.

---

## 8. Riesgos y dependencias (respuesta al punto 6)

- **Crecimiento de disco local (Alta).** Las RX de alta resolución pesan MB; hoy van a `process.cwd()/uploads` en el mismo volumen
  de la app (EB). Sin S3, el disco se llena. **Dependencia:** el pendiente "uploads→S3" (ya en la memoria del proyecto). Mitigación
  interina: límite de 15 MB/archivo + tope de cantidad por owner (§3.3) + monitoreo de disco (`devops`). El diseño migra a S3 sin
  cambio de esquema (`storage_backend`).
- **Exposición pública de `/uploads` (Alta — seguridad).** §3.4: ePHI descargable sin auth por el canal estático actual. Este
  módulo NO debe usar ese canal; descarga por endpoint autenticado + almacén privado. **Bloqueante para `security`.**
- **Límite de tamaño de RX (Media).** 15 MB puede quedar corto para RX panorámicas/CBCT (aunque CBCT normalmente es DICOM, fuera de
  alcance — eso lo cubre `integrations` con PACS, no este módulo de adjuntos simples). `product` confirma el tope.
- **Integridad polimórfica (Media).** Sin FK dura: un `owner_id` puede quedar huérfano si se borra el presupuesto/procedure padre.
  Mitigación: al borrar un presupuesto/procedure, el servicio soft-deletea sus adjuntos (regla de servicio) o un job de limpieza los
  detecta. `product`/`architect` definen el cascade lógico en implementación.
- **Relación con `rx_presentadas` (Baja).** Resuelta en §6 (Opción B, declarativo + conciliación en UI).
- **DICOM/PACS fuera de alcance.** Este módulo cubre RX como imagen JPG/PNG/PDF (foto de la placa / export). El pipeline DICOM real
  es de `integrations`. No mezclar.

---

## 9. Resumen accionable

- **Modelo:** **una tabla polimórfica `clinical_attachments`** (`owner_type` presupuesto|procedure + `owner_id`), no dos tablas.
  Reusa el patrón storage-agnóstico del doc de firma (`storage_backend`+`storage_key`+`hash` SHA-256).
- **Borrado:** **soft-delete** (`deleted_at`/`deleted_by`), NO append-only (los adjuntos sí se corrigen). Borran `medico`/`administrador`;
  bloqueado si el procedure pertenece a un encounter `finished`.
- **API:** `POST/GET` en dos anclajes (`/finanzas/presupuestos/:id/attachments` y `/odontology/.../resource/:id/attachments`),
  listar, **descargar por endpoint autenticado** (no por `/uploads` público), `DELETE` soft. Subir a presupuesto: +`recepcionista`.
  Todo filtra por `tenant_id`.
- **Seguridad:** whitelist estricta (JPG/PNG/PDF) + **magic-bytes** + nombre generado por backend + límite 15 MB + AuditEvent
  (upload/download/delete). ⚠️ **Cerrar la exposición pública de `/uploads` para ePHI** (endpoint autenticado + almacén privado).
- **`rx_presentadas`:** sigue **manual/declarativo**; la UI sugiere y concilia contra los adjuntos imagen, sin fusionar (Opción B).
- **Migración:** propuesta en §5, NO aplicada, cumple el PROTOCOLO (aditiva, idempotente, `lock_timeout`, índice tenant).
- **S3 NO existe aún:** diseño agnóstico, arranca `local`, migra sin cambio de esquema.
- **Handoff:** `security` (magic-bytes, cifrado en reposo, AuditEvent ePHI, cierre de `/uploads` público, roles), `ux` (dropzone +
  miniaturas + control por fila en el modal), `product` (roles de borrado, tope de RX, Opción B de `rx_presentadas`), `fhir-mcp`
  (mapear a FHIR `DocumentReference`/`Media` — ya hay precedente en `saveFile()`), `devops` (monitoreo de disco / plan S3).
```