# Bloque 1: auditoría por falsación y endurecimiento sin radio de impacto

**Creado:** 2026-08-22 · **Responsable:** Claude (Orquestador) · **Rama:** `sec/bloque1-guard-fail-closed-y-spread`
**Origen:** Fase 1 del handoff `2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`, revisada por una auditoría de falsación.

> **Qué cambió acá:** tres correcciones quirúrgicas de seguridad, todas con radio de impacto medido antes de tocar nada. Y, antes de las correcciones, una auditoría que **refutó parte del diagnóstico previo** — incluido el del propio Orquestador.

---

## 1. Por qué hubo una auditoría antes de corregir

El Super Admin pidió certeza sobre el relevamiento de estado y las recomendaciones, no repetición de documentación. Se convocaron tres subagentes en paralelo (`security`, `qa`, `revisor`) con un mandato de **falsación**: intentar demostrar que cada afirmación era falsa, con prohibición explícita de usar el backlog, el tablero o los walkthroughs como evidencia de sí mismos. Única evidencia válida: código y salida de comandos.

El resultado justificó el desvío. **Cinco afirmaciones que circulaban como ciertas resultaron falsas o sobredimensionadas.**

### 1.1 Lo que se refutó

| Afirmación | Veredicto | Evidencia |
| :--- | :--- | :--- |
| "El producto real está al 87 % (77/89)" | **REFUTADA** | Aritmética irreproducible: sacar los módulos 6/7/8 da 77/101 = 76 %. El 89 sólo sale borrando del denominador los 12 pendientes de seguridad **mientras se conservan los 7 cerrados en el numerador**. Doble contabilidad. Aplicando el criterio simétricamente (sacando también el módulo 3, fuera de alcance por `ADR-0001`): 72 %. |
| "`RolesGuard` fail-open habilita enumerar el padrón RENAPER" | **REFUTADA** | `SisaController` no usa `RolesGuard` sino `AuthGuard('jwt')`; `SISA_MOCK !== 'false'` hace del mock el default, sin credenciales del Ministerio; y el botón está oculto en `PatientForm.tsx:393`. No hay padrón que enumerar. |
| "El realm de producción tiene auto-registro abierto" | **REFUTADA** | `aws/keycloak/hce-realm.json:7` dice `registrationAllowed: true`, pero producción responde **HTTP 400 → "El registro no está permitido"**. El JSON describe el realm **como se creó**, no como está: el compose importa dejando intacto el realm existente. |
| "El módulo 12 son 6 pendientes de puro pulido" | **REFUTADA** | `12.6` no valida `precioUnitario`/`cantidad`/`descuento` (`clinica-finanzas.service.ts:213-218`): un descuento negativo **infla** el total y un `NaN` atraviesa `Math.max(0, NaN)` y se persiste. `12.12` ya estaba resuelta y el registro no lo sabía. |
| "6 vulnerabilidades críticas abiertas" | **PARCIAL** | Seis abiertas, sí; seis críticas, no. Reparto real: 1 crítica (AUD.9), 1 crítica condicional (AUD.10), 1 alta (AUD.8), 2 medias (AUD.11, AUD.12), 1 baja (AUD.13). |

### 1.2 Lo que se confirmó, y no estaba registrado

- **El rol `paciente` tiene acceso vivo a datos clínicos sin que exista el módulo 7.** `patient.controller.ts:81-85` y `clinical-resource.controller.ts:36-46` lo incluyen en `@Roles`, y `findOne` filtra **sólo por tenant**: un token con rol paciente lee cualquier paciente de la clínica. Dos auditorías independientes llegaron a esto por caminos distintos. `AUD.11` cubre sólo el `hceWebhookSecret`; estos dos endpoints no estaban registrados en ningún lado.
- **Las alertas de alergia siempre dirán "sin alertas".** `ClinicalAlerts.tsx` está viva en el odontograma y en el modal de turnos, pero la única UI para **cargar** alergias (`AllergyTab`) quedó inalcanzable desde el menú por `ADR-0001`. "Sin alertas" leído como "sin alergias" antes de intervenir es un riesgo clínico, no contable.
- **`StlViewer3D.tsx:294-308`**: si falla la descarga del STL, el visor dibuja **silenciosamente** un arco dental de demostración y sólo lo avisa por `console.error`. El protesista no puede distinguirlo del escaneo de su paciente.
- **Prótesis tiene sus escrituras caídas.** Ver §4.
- **La imagen Docker local no reflejaba el código.** `hce-backend-api` corría en crash-loop con una imagen anterior al fix `1035259` y con `package.json` a 0 bytes (caché corrupta del incidente de disco). "El stack está levantado" era cierto y engañoso a la vez.

### 1.3 Corrección del conteo de avance

El registro sobredeclaraba cuatro entradas y subdeclaraba una. Rango honesto: **64-66 %**, no 66 % exacto y mucho menos 87 %. Los módulos cerrados al 100 % pasan de 6 a 5. La conclusión del saneamiento (PR #10) —que el 66 % es un denominador honesto y no un retroceso— **se sostiene**; lo que no se sostiene es la precisión del último punto porcentual.

> Reserva de método que conviene no perder: **el 38 % de las tareas completadas no declara entregables**, y ahí cayeron todas las sobredeclaraciones encontradas. Mientras eso siga así, cada relevamiento futuro exige repetir esta auditoría a mano.

---

## 2. Qué se corrigió

Los tres cambios comparten un criterio: **radio de impacto medido antes de tocar, no estimado después.**

### 2.1 `RolesGuard` deny-by-default (AUD.13)

`auth/roles.guard.ts` devolvía `true` cuando no encontraba metadata de `@Roles`. Olvidar el decorador publicaba la ruta a cualquier usuario autenticado, en silencio y sin que ningún test lo notara.

**Precondiciones verificadas antes del cambio** (no asumidas):

- Los 104 endpoints de los 17 controllers que montan el guard declaran `@Roles`.
- **Ningún controller aplica `@Roles` a nivel de clase**, lo que importaba porque el guard lee `getHandler()` y no lo habría visto.

**Verificación en runtime:** 0 endpoints pasaron a 403 tras el cambio; `/health`, que no monta el guard, sigue público.

El valor es preventivo: la ruta que se agregue mañana sin `@Roles` falla ruidosamente en desarrollo en vez de nacer abierta.

### 2.2 El `tenantId` del JWT no se pisa desde el body (AUD.12)

Los DTOs de finanzas son `interface`, así que el `ValidationPipe` global es inerte: contra un metatype `Object`, `whitelist` y `forbidNonWhitelisted` no filtran nada. **La única defensa que queda es el orden del spread**, y estaba invertido en dos lugares:

| Archivo | Antes | Riesgo |
| :--- | :--- | :--- |
| `clinica-finanzas.service.ts` `registrarGasto` | `create({ tenantId, ...dto })` | Insertar un gasto en **otra clínica** mandando `tenantId` en el body |
| `insurance.service.ts` `updateCoverage` | `Object.assign(coverage, { ...data })` | **Mudar** una cobertura a otra clínica reescribiendo `tenantId`/`patientId` |

Reproducido con test antes de corregir (`Received: "clinica-ajena"`) y confirmado en runtime contra la base:

```
POST /clinica/finanzas/gasto  {"tenantId":"clinica-ajena-atacante", ...}
→ 201    tenant_id persistido: mi_consultorio_dent_hce
```

**Por qué NO se convirtieron las interfaces a `class`:** se ejecutó el `ValidationPipe` real del proyecto y se comprobó que una `class` **sin decoradores** hace que el endpoint devuelva `400` con "property … should not exist". Convertirlas sin decoradores tumbaría los 20 endpoints de finanzas, que están en producción. **Class y decoradores van en el mismo commit o no van.**

### 2.3 Credenciales de la base fuera del código (AUD.9, paso 1)

El endpoint de RDS de producción y la clave de `hce_admin` estaban en claro en 8 scripts de `testing/scripts/` y en un walkthrough. Es acceso directo a la base de todos los inquilinos, saltándose la aplicación, los guards y la auditoría: **ninguna defensa de la app lo mitiga**.

Nuevo `testing/scripts/db-config.js`: `remoteConfig()` exige `DB_HOST` y `DB_PASSWORD` por entorno y aborta con mensaje claro; `localConfig()` conserva los valores del docker-compose de desarrollo, que no son secretos de producción.

El **host** también es obligatorio a propósito: con el endpoint de producción como valor por defecto, correr cualquiera de estos scripts sin pensarlo apuntaba a prod.

Radio de impacto: **ninguno en runtime**. Los 8 scripts no figuran en `package.json` ni en el CI.

> ⚠️ **Esto NO cierra `AUD.9`.** El secreto sigue vivo en la historia de git: lo único que lo invalida es **rotarlo**.

---

## 3. Verificación

| | |
| :--- | :--- |
| Tests backend | **195/195, 17 suites** (184 de `main` + 11 nuevos) |
| Lint backend | **1507** warnings, 0 errores — trinquete 1508: pasa, y **baja uno** |
| Lint frontend | 328/328 exacto (no se tocó) |
| Build | `nest build` OK |
| Runtime | Backend reconstruido (`--no-cache`) y arrancado limpio; 8 endpoints probados; vector cerrado verificado **a nivel de fila en la base** |

Los 8 warnings nuevos que aparecieron al principio se resolvieron **tipando los tests**, no subiendo el baseline. El trinquete existe para eso.

Un `500` en `/insurance/companies` durante las pruebas resultó ser un path equivocado (cae en `@Get(':id')` y `"companies"` no es UUID), no una regresión: con `/insurance` da 200. De paso es una instancia real de `12.12`.

---

## 4. Hallazgo abierto: las escrituras de Prótesis están caídas

Verificado con `POST` reales contra el stack local, con tres roles distintos:

```
POST /protesis          → HTTP 400  "property performerTenantId should not exist", ...
POST /protesis/insumos  → HTTP 400  "property name should not exist", ...
```

Los 10 DTOs de `protesis.service.ts` son `class` con **cero decoradores** de `class-validator`. Con `transform: true` el pipe instancia la clase y `whitelist` rechaza todas sus propiedades.

**El módulo 10 está declarado 100 % completo (12/12)** y una auditoría de código lo confirmó — porque el código está. Lo que no se veía es que en runtime no responde: los tests invocan el controller **directamente, sin pipe**, y pasan en verde. Es el mismo patrón del bug que impedía arrancar el backend.

No es la primera vez: el propio `AUD.12` advierte *"nunca global"* sobre el `ValidationPipe` porque *"ya rompió endpoints una vez"*.

**Pendiente de decisión del Super Admin:** ¿el portal de laboratorio funciona hoy en producción? Si funciona, el diagnóstico local no aplica a prod y hay que entender por qué. Si no funciona, es una caída que nadie reportó.

---

## 5. Cómo seguir — orden por radio de impacto

1. **`AUD.9` — rotación.** Ahora es el más urgente y **confirmado por el Super Admin**: la credencial semilla `doctor_julio` sigue **viva en producción**. Sumado a ROPC habilitado, sin anti-fuerza bruta y sin MFA, y al `client_secret` del que depende la administración de identidades. Es operación, no código: RDS + admin de Keycloak + `client_secret` en el **mismo acto**, porque backend y Keycloak comparten la instancia RDS y desincronizarlos tira abajo el login.
2. **Prótesis** (§4), según la respuesta del Super Admin.
3. **`AUD.8` pasos 2-4.** Precondición operativa: correr el migrador con `--apply --borrar-legado` en prod, porque las firmas legadas sí tienen nombre predecible. Rompe 2 componentes React (`OdontologyDocuments.tsx`, `DocumentsTab.tsx`) y 2 tests: hay que migrarlos al patrón de blob autenticado que ya existe en `ClinicalAttachments.tsx:90`.
4. **`AUD.10` — endurecimiento del realm.** MFA se le ve a **todos** los usuarios en su próximo login: requiere aviso previo y ventana. ROPC: desactivar **sólo en prod** desde la consola, o se rompen ~15 scripts de testing que lo usan.
5. **`AUD.11` — último.** Severidad media con los colaterales más traicioneros: agregar `select: false` **corta el despacho de webhooks en silencio** (`webhook.service.ts:47-51` hace `return` con sólo un warn) y hace que `clinichat-orchestration.service.ts:57-64` **regenere y persista un secreto nuevo en cada invocación**, desincronizándose de CliniChat de a poco. **Los tests existentes no atrapan ninguna de las dos.**

### Tareas nuevas a registrar

- Retirar el rol `paciente` de los `@Roles` de `patient`/`clinical-resource`, o restringirlo a su propio `patientId`.
- Alergias sin vía de carga → alerta clínica vacía por diseño (es `AUD.18(b)`, hoy registrado como pregunta de producto y no como defecto activo).
- Fallback silencioso del visor STL.
- `12.6` de `media` → **alta** (integridad financiera); `12.7` de `baja` → `media`; `12.12` → **completada**.
- `3.11` → pendiente (declara tests de `Observation` y `Procedure` que no existen); `1.6` mTLS y `1.7` backups 3-2-1 sin respaldo en el repo.

> **Nota sobre el registro:** estas correcciones **no se aplicaron** al `tablero_control.md` ni a `docs/backlog.json` en esta rama a propósito. El saneamiento del registro vive en `chore/saneamiento-registro` (PR #10, aún sin mergear) y tocarlo acá generaría un conflicto con él. Corresponde aplicarlas **sobre esa rama antes de su merge**, que es además donde el conteo tiene el denominador correcto.

---

## Referencias

- Auditoría de falsación: 3 subagentes (`security`, `qa`, `revisor`), 2026-08-22.
- Handoff previo: `docs/walkthroughs/2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`
- AUD.8 paso 1/4: `docs/walkthroughs/2026-08-19_aud8_firma_profesional_endpoint_autenticado.md` (PR #11)
- Saneamiento del registro: `chore/saneamiento-registro` (PR #10)
