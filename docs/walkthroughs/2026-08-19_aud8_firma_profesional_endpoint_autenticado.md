# AUD.8 — Fase 1, paso 1: la firma del profesional sale del estático público

**Creado:** 2026-08-19 · **Responsable:** Claude (Orquestador) · **Rama:** `fix/aud8-firma-odontologo-autenticada`
**Origen:** Fase 1 ("cerrar exposición") del handoff `2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`, §5.

> **Primer crítico de seguridad de la auditoría que se corrige.** Cierra el paso 1 de 4 de `AUD.8`. Los pasos 2–4 (logos, documentos odontológicos, apagar `express.static`) siguen abiertos, y **`/uploads` sigue siendo público** hasta que se completen.

---

## 1. Qué estaba mal

`POST /api/tenant/signature` escribía la firma del odontólogo en `uploads/signatures/signature-<tenantId>.png`, y `main.ts:25` sirve esa carpeta con `express.static`. Dos problemas que se potencian:

1. **Sin autenticación.** Cualquiera con la URL se bajaba el archivo.
2. **Nombre predecible.** `signature-<tenantId>.png` — conocer o adivinar un `tenantId` bastaba para construir la URL.

El riesgo no es sólo la fuga: la firma del profesional es el insumo directo de una **suplantación** en recetas y documentos clínicos.

Además, la URL persistida era absoluta: `http://localhost:3000/uploads/signatures/...`, o sea que en producción la imagen **ya no cargaba**.

### Corrección al handoff

El handoff daba por hecho que firma y adjuntos "ya están rotos en producción, colateral casi nulo". Verificado contra el código, eso es cierto **sólo para la firma**:

| Archivo | URL persistida | Cómo lo consume el front | Estado real |
| :-- | :-- | :-- | :-- |
| **Firma del profesional** | absoluta `http://localhost:3000/...` | `<img src>` directo, **sin shim** | **rota** — el handoff acierta |
| **Logo** | relativa `/uploads/logos/...` | `TenantLogoMark` → `resolveTenantAssetUrl()`, que **reescribe** `localhost` a la API real | **funciona hoy** |
| Documentos odontológicos | relativa | `OdontologyDocuments` | funciona |

Existe un shim de URLs que el handoff no contemplaba. No cambia el orden de la Fase 1, pero **confirma** su advertencia: apagar `express.static` antes de separar `/uploads/logos/` rompe el login de todos los tenants.

---

## 2. Qué se hizo

### Backend

| Archivo | Cambio |
| :-- | :-- |
| `tenant/tenant-signature.service.ts` (nuevo) | Guarda y lee la firma vía `EvidenceStorageService`, que ya existía y ya usan las firmas de paciente y los adjuntos clínicos: **S3 privado con SSE** si `S3_EVIDENCE_BUCKET` está seteado, `private-uploads/` si no. |
| `tenant/tenant-config.controller.ts` | `POST` pasa de `diskStorage` a `memoryStorage` (hace falta el buffer para hash y magic-bytes, y así el blob nunca toca la carpeta pública). **Nuevo `GET /api/tenant/signature`** autenticado. |
| `tenant/tenant-config.entity.ts` | +4 columnas (`signature_storage_key/backend/content_type/hash`), todas con `select: false`. `signature_url` deja de guardar una URL absoluta y pasa a guardar la ruta del endpoint. |
| `tenant/tenant.module.ts` | Registra `TenantSignatureService` y `EvidenceStorageService`. |

Tres propiedades que vale la pena señalar:

- **Clave aleatoria** (`sig-<ts>-<16 hex>.png`) en vez de derivada del `tenantId`. El almacén ya es privado, pero un nombre adivinable vuelve a ser un problema apenas se exponga por otra vía.
- **El `tenantId` sale siempre del JWT**, nunca de un parámetro: no hay forma de pedir la firma de otra clínica.
- **Magic-bytes**: se valida que el contenido real coincida con el MIME declarado. Un `.php` renombrado a `.png` pasa el filtro de multer, no éste.

### Frontend

`BrandingSettings.tsx` mostraba la firma con `<img src={url}>` plano, que no puede enviar el token. Ahora la descarga por axios con `responseType: 'blob'` y la muestra como object URL, revocándolo al desmontar y al reemplazar la firma.

Se agregó un estado `'ausente'`: **hay firma registrada pero el blob no se pudo traer**. Es el caso de una firma vieja que la migración no encontró, y muestra "No pudimos recuperar tu firma guardada. Hacé clic para subirla de nuevo" en lugar de una imagen rota.

### Migración

- `scripts/20260819_1200_agregar_cols_firma_privada_a_tenant_config.sql` — EXPAND puro (columnas nullable, `IF NOT EXISTS`, `lock_timeout`, idempotente). Además pone en `NULL` las `signature_url` que apuntaban al estático: mientras el blob no esté en el almacén privado **no hay firma servible**, y marcarla como presente mostraría una imagen rota.
- `scripts/migrar-firmas-a-almacen-privado.cjs` — mueve al almacén privado las firmas que **todavía existan en disco**, verificando el SHA-256 de la copia. Dry-run por defecto.

**Por qué best-effort:** en Elastic Beanstalk el filesystem de la instancia es efímero, así que es probable que varios PNG ya no existan (segundo motivo de que la firma esté rota en prod). Los que falten se reportan para que el profesional los vuelva a subir — no se inventa nada.

> ⚠️ **`--borrar-legado` es un paso obligatorio, no opcional.** Mientras el archivo siga en `uploads/signatures/`, **sigue expuesto** por `express.static`. Es opt-in sólo porque borrar es irreversible: primero se verifica que la descarga autenticada funcione, y enseguida se corre el borrado.

---

## 3. Verificación

| | |
| :-- | :-- |
| Tests backend | **200 pasan / 18 suites** (eran 184/16 en el handoff anterior; +16 nuevos) |
| Build backend | `nest build` OK |
| Build frontend | OK |
| Lint | backend 1508/1508 · frontend 328/328 — **ambos trinquetes exactos, sin subir el baseline** |

**16 tests nuevos**, de los cuales los que importan son los de la propiedad de seguridad:

- La descarga **sin autenticación es rechazada** y el servicio ni siquiera se invoca.
- Con token, el tenant se resuelve **desde el JWT** (`getStream` recibe `clinica-a`), con `nosniff` y `Cache-Control: private, no-store`.
- La clave de almacenamiento **no contiene el `tenantId`** y no se repite entre subidas.
- Se rechaza un archivo cuyo contenido no es la imagen que declara (PHP disfrazado de PNG) y un tipo fuera de la whitelist (SVG con `onload`).
- El endpoint declara roles: `paciente` y `laboratorio-operador` **no** pueden leer la firma.

### Lo que NO se pudo verificar

**No hay verificación contra el stack corriendo:** Docker Desktop no estaba levantado, así que no se pudo probar contra Postgres + Keycloak reales. Los tests de HTTP corren con Nest en proceso y guards simulados: cubren enrutamiento, headers, guardas y resolución de tenant, pero **no** el JWT real de Keycloak ni la escritura en la base.

**Antes de desplegar hay que:** aplicar el SQL en local, levantar el stack, subir una firma, verificar que se ve, verificar que `GET /api/tenant/signature` sin token da 401, y recién ahí correr la migración en prod.

---

## 4. Orden de despliegue (no invertir)

1. **SQL primero** (`20260819_1200_...`). Es EXPAND: el código viejo sigue andando con columnas nuevas vacías.
2. **Backend**. Desde acá las firmas nuevas van al almacén privado.
3. **Frontend**. Antes de esto, la pantalla de firma muestra el empty-state (no rompe: la imagen ya estaba rota).
4. **Migrador en dry-run** → revisar el informe → `--apply`.
5. **Verificar** la descarga autenticada con un tenant real.
6. **`--apply --borrar-legado`** — recién acá se cierra la exposición.

**Rollback:** el backend anterior sigue funcionando contra el esquema nuevo (las columnas son nullable y `signature_url` se lee igual). Lo único no reversible es el paso 6.

---

## 5. Lo que queda de AUD.8

- [ ] **Paso 2:** separar `/uploads/logos/` a una ruta pública propia — es público por diseño y aparece **pre-login**. Debe hacerse **antes** de apagar el estático o se rompe el login de todos los tenants.
- [ ] **Paso 3:** documentos odontológicos y adjuntos de paciente → almacén privado con lectura dual.
- [ ] **Paso 4:** eliminar `express.static` de `main.ts:25`.

`AUD.9`–`AUD.19` siguen todos abiertos.

---

## 6. Hallazgos laterales (no corregidos acá)

1. **`npm run lint` del backend todavía tiene `--fix`** (`package.json:15`). El CI lo quitó en `AUD.4`, el script local no: correrlo reformatea archivos ajenos y ensucia el diff. Pasó en esta sesión — 7 archivos autoformateados que hubo que revertir. Conviene alinear el script con el CI.
2. **`deleteFile` sigue ignorando el tenant** (`patient/file-upload.controller.ts:98`): el `@Request()` está declarado como `_req` y no se usa. Es `AUD.14`, ya registrado.
3. **`scripts/clean-demo-tenant.cjs` trae la clave de la base como valor por defecto** — parte de `AUD.9`. El migrador nuevo no replica ese patrón: exige las credenciales por entorno y falla limpio si faltan.

---

## Referencias

- Handoff de la auditoría: `docs/walkthroughs/2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`
- Protocolo de esquema: `docs/PROTOCOLO-CAMBIOS-DB.md`
- Patrón reusado: `hce-backend/src/odontology/evidence-storage.service.ts` y `odontology-patient-signature.controller.ts`
