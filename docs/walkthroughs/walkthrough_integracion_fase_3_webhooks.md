# Walkthrough: Fase 3 — Webhooks de Salida (HCE ↔ CliniChat)

Este documento registra los cambios de desarrollo realizados y los resultados de verificación para habilitar el despacho firmado de webhooks salientes desde la Historia Clínica Electrónica (HCE) hacia CliniChat ante eventos de creación y cancelación de citas médicas.

---

## Cambios Realizados

### 1. Base de Datos (PostgreSQL)
* Modificado [init.sql](file:///e:/2026/app-jct/app-historias-clinicas/scripts/init.sql) para añadir la columna `hce_webhook_secret VARCHAR(255)` a la tabla `tenant_config`.
* Aplicada la columna en caliente sobre el contenedor Docker `hce-database` de desarrollo local.

### 2. Backend (NestJS)
* **Tenant Config Entity:** Actualizado [tenant-config.entity.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/tenant/tenant-config.entity.ts) para soportar la columna `hceWebhookSecret` de tipo `varchar`.
* **Tenant Config Controller:** Modificado [tenant-config.controller.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/tenant/tenant-config.controller.ts) agregando `'hceWebhookSecret'` en la sanitización del método `updateConfig()`.
* **Webhook Service:** Creado [webhook.service.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/webhook/webhook.service.ts) y su respectivo [webhook.module.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/webhook/webhook.module.ts). Implementa:
  - Firma digital de payloads con criptografía simétrica HMAC-SHA256.
  - Envío HTTP POST asíncrono no bloqueante usando el `fetch` nativo de Node.js 20+ con timeout de 8 segundos.
  - Cabecera `X-CliniChat-Signature: sha256=<firma>`.
* **Integración en Citas:** Importado `WebhookModule` en [appointment.module.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/appointment/appointment.module.ts). Modificado [appointment.service.ts](file:///e:/2026/app-jct/app-historias-clinicas/hce-backend/src/appointment/appointment.service.ts) para inyectar `WebhookService` y despachar eventos en:
  - `create`: Solo si `originChannel === 'recepcion'` (evita bucles infinitos con turnos generados por WhatsApp).
  - `cancel`: Siempre (ante cancelaciones HCE).

### 3. Frontend (React / Vite)
* **Theme Context:** Actualizado [ThemeContext.tsx](file:///e:/2026/app-jct/app-historias-clinicas/hce-frontend/src/context/ThemeContext.tsx) para incluir `hceWebhookSecret` en la interfaz `TenantConfig` y su estado por defecto.
* **Panel de Configuración:** Modificado [BrandingSettings.tsx](file:///e:/2026/app-jct/app-historias-clinicas/hce-frontend/src/components/BrandingSettings.tsx) para añadir la pestaña **"Integraciones"** con un formulario responsivo y un campo tipo *password* seguro (con visor de visibilidad de contraseña 👁️) para ingresar y guardar el secreto de CliniChat de manera premium.

---

## Verificación y Pruebas

Para asegurar la robustez de la integración, creamos:
1. Un servidor receptor HTTP de prueba local ([test_webhook_receiver.js](file:///e:/2026/app-jct/app-historias-clinicas/testing/scripts/test_webhook_receiver.js)) en el puerto `4000` que valida y descifra la firma.
2. Un script despachador de transacciones ([test_webhooks_dispatch.js](file:///e:/2026/app-jct/app-historias-clinicas/testing/scripts/test_webhooks_dispatch.js)).

### Resultados de Ejecución de Pruebas:
Al correr el flujo de reservas y cancelaciones, el receptor de webhooks registró las siguientes entradas correctas:

#### A. Webhook de Creación (`CREATE`):
* **Firma Recibida:** `sha256=b0c01541a95b1ba7b1167b52487446c9590408a0c7b74cf66420aa349f486d8a`
* **Firma Calculada en Receptor:** `b0c01541a95b1ba7b1167b52487446c9590408a0c7b74cf66420aa349f486d8a`
* **Resultado:** `✅ [Firma Válida] La autenticidad e integridad del payload están confirmadas.`

#### B. Webhook de Cancelación (`CANCEL`):
* **Firma Recibida:** `sha256=3050a6e69f5127891147841e44b970b4fae9e11e2f98e570a31797a39acf2000`
* **Firma Calculada en Receptor:** `3050a6e69f5127891147841e44b970b4fae9e11e2f98e570a31797a39acf2000`
* **Resultado:** `✅ [Firma Válida] La autenticidad e integridad del payload están confirmadas.`

---

## Verificación en Caliente en Producción E2E (10/06/2026)

Se realizó una prueba de integración e2e directa contra el endpoint receptor real de CliniChat en la nube pública:
* **Host Destino:** `https://hooks.systia.ar/api/public/hooks/sync-appointment`
* **Secreto HMAC Utilizado:** `118382725c09c75e130c8fd03e817cb193f87eed8df8a8c44938699796e1149c` (provisto por CliniChat para la clínica de test `mi_consultorio_dent_hce`).

### Proceso de Validación Ejecutado:
1. **Recreación del Contenedor de la API:** Se forzó la recreación del contenedor `hce-backend-api` para asegurar la carga limpia de la variable `CLINICHAT_WEBHOOK_URL` desde `docker-compose.yml`.
2. **Actualización de Secreto en Base de Datos:** Se sembró físicamente en PostgreSQL local el secreto HMAC real de la clínica.
3. **Ejecución de Transacciones de Prueba:** Se ejecutó el script [test_webhooks_dispatch.js](file:///e:/2026/app-jct/app-historias-clinicas/testing/scripts/test_webhooks_dispatch.js) agendando y cancelando un turno con canal `recepcion`.

### Resultados en Logs de la HCE:
El NestJS Backend procesó y firmó los payloads, enviándolos con éxito directo a la API de CliniChat en producción. Los logs del contenedor `hce-backend-api` confirmaron la entrega limpia:
```
[WebhookService] [Webhook] Despachando evento "cancelled" para cita "31fc6f30-fc6d-4051-a828-b9b9cbbeb5e2" a la URL: https://hooks.systia.ar/api/public/hooks/sync-appointment
[WebhookService] [Webhook] Webhook de cita "31fc6f30-fc6d-4051-a828-b9b9cbbeb5e2" enviado con éxito a CliniChat.
```
Ambos webhooks (`created` y `cancelled`) fueron entregados y validados correctamente por los servidores de CliniChat, retornando códigos HTTP exitosos (200 OK / synced).

---

## Conclusión
La Fase 3 se encuentra **100% implementada, compilada en verde (Frontend & Backend) y verificada con éxito tanto en local como contra la nube de producción de CliniChat**.
La HCE está totalmente preparada para sincronizar de forma bidireccional, segura e inmutable con CliniChat en entornos multi-inquilino.

