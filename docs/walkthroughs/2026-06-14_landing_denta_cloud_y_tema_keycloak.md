# Walkthrough — Landing pública "Denta Cloud" + Tema de login Keycloak

**Fecha:** 2026-06-14
**Autor:** Orquestador (con agentes `product` y `ux`)
**Estado:** Implementado y verificado en **local**. Pendiente de despliegue a producción (ver §7).
**Marca pública:** **Denta Cloud** — *Odontología Digital* (azul `#1e6fd9` + menta `#2aa57c`). Internamente el producto se llamaba DentHCE; la marca de cara al cliente es **Denta Cloud**.

> Contexto de decisión: ver memoria [[hce-landing-publica-marketing]] y [[feedback-directiva-65-anos-descartada]]. La identidad visual sigue el `design-system` (tema claro/clínico, Inter, español rioplatense).

---

## 1. Qué se construyó

1. **Landing pública de marketing** (pre-login) que reemplaza a `LandingLogin` cuando el usuario NO está autenticado. Captura clínicas nuevas; CTA principal = **Solicitar demo por WhatsApp**.
2. **Tema de login propio de Keycloak** (`denta-cloud`) con la identidad de la landing (tema claro, logo, español, sin selector de idioma, sin registro público).

Flujo de diseño usado: `product` (estrategia + copy) → `ux` (layout responsive) → codificación directa del Orquestador. Entregables de diseño:
- `docs/design/landing_denta_cloud_estrategia.md` (propuesta de valor, 12 secciones, copy rioplatense, CTAs).
- `docs/design/landing_denta_cloud_ux.md` (sistema visual, spec por sección, accesibilidad/responsive).
- `docs/design/landing_denta_cloud_prompts_imagenes.md` (prompts nano banana para fotos, por si se quieren sumar — la regla [[feedback-nano-banana-prompts]] sigue vigente: las imágenes raster las corre el dueño en Gemini).

---

## 2. La landing — archivos y arquitectura

Carpeta: **`hce-frontend/src/components/landing/`**

| Archivo | Rol |
| :-- | :-- |
| `LandingDentaCloud.tsx` | Componente raíz. Ensambla las secciones, maneja el `DemoModal` y la variante de skin por URL (`?v=pro`). Cableado en `App.tsx` (reemplaza a `LandingLogin`; el archivo viejo quedó sin uso). |
| `content.tsx` | **Fuente única de copy y datos**: textos, íconos lucide, logo SVG (`DentaCloudLogo`) y PNG (`DentaCloudLogoImage`), `STATS` y `TESTIMONIOS` (⚠️ placeholders), y el **CTA de WhatsApp**. |
| `primitives.tsx` | `Section`, `SectionHeading`, `InfoCard`, `LandingImage` (con placeholder elegante si falta el asset), `StepCard`. |
| `mockups.tsx` | **Mockups de UI en SVG** (proporciones exactas, sin imágenes raster): `ProductMockup` (dashboard del hero), `OdontogramMockup`, `WhatsappMockup`. |
| `Hero.tsx` | Hero premium: fondo con glows, badge, H1 con palabra resaltada en degradé, franja de confianza, y el producto dentro de un **marco de navegador**. |
| `LandingNav.tsx` | Barra sticky + drawer en mobile. |
| `sections.tsx` | Todas las secciones: TrustBar, StatsBand, Beneficios, Transformacion, Modulos, Odontograma, WhatsAppIA, ComoFunciona, Testimonios, Confianza, ParaQuien, FinalCTA. |
| `LandingFooter.tsx` | Pie oscuro (usa el PNG del logo sobre chip blanco). |
| `DemoModal.tsx` | Modal "Solicitar demo": formulario corto → abre WhatsApp (`wa.me`) con los datos pre-cargados. Accesible (Esc, foco, overlay). |
| `landing.css` | Estilos del skin **Moderno** (por defecto). Solo tokens del design-system; acento `var(--brand-blue)`. |
| `landing-pro.css` | Skin alternativo **Profesional** (navy, esquinas filosas). Se activa con `?v=pro`. |

### Orden de secciones (scroll, definido por el dueño)
Nav → **Hero → Transformación → Módulos → Odontograma → WhatsApp IA → Cómo funciona → Para quién es → CTA final → Trust bar → Estadísticas → Beneficios → Seguridad → Testimonios** → Footer.

> Nota UX: el **CTA final quedó en la mitad** (decisión del dueño). Quedó **pendiente** decidir si se agrega un CTA de cierre después de Testimonios (opción "B" que recomendé). Ver §6.

### CTA "Solicitar demo"
- Canal: **WhatsApp directo**. Número en `content.tsx`: `WHATSAPP_NUMERO = '5493512313616'` (Córdoba 351 231 3616; formato móvil AR = `54 + 9 + área + nº`).
- Helper `buildDemoHref(mensaje)` arma `https://wa.me/<nº>?text=...`. El `DemoModal` arma el mensaje con nombre/clínica/WhatsApp/especialidad.

### Identidad / inspiración
Se hizo un relevamiento de los líderes del rubro (Dentalink, Curve Dental, tab32, CareStack). Conclusión clave: lo que transmite "empresa seria" es la **prueba social** (estadísticas, testimonios, badges) — por eso se agregó la capa de confianza. La paleta azul+menta quedó validada (Dentalink usa casi la misma).

---

## 3. El tema de login de Keycloak — archivos

Carpeta: **`configs/keycloak/themes/denta-cloud/login/`**

| Archivo | Rol |
| :-- | :-- |
| `theme.properties` | `parent=keycloak`, `import=common/keycloak`, `styles=css/login.css`, `locales=es,en`. |
| `resources/css/login.css` | Estilos de marca: fondo claro con glows, **ícono SVG en el header**, **tarjeta contenida (~420px) centrada vertical**, inputs con foco azul, **campo de contraseña + ojo unificados**, botón azul, **sin selector de idioma** (`#kc-locale` oculto), enlaces azules. |
| `resources/img/denta-icon.svg` | Ícono de marca (nube menta + diente azul), **transparente**, `viewBox="4 6 103 95"` (recortado al dibujo para que quede centrado). |
| `resources/img/denta_cloud_logo.png` | Copia del logo PNG (hoy NO usado por el header; disponible por si se quiere el lockup completo con fondo transparente). |
| `messages/messages_es.properties` | Overrides de marca: `loginAccountTitle=Ingresá a Denta Cloud`, `doLogIn=Iniciar sesión`. |

### Montaje y activación
- **`docker-compose.yml`**: el servicio `hce-identity` ahora monta `./configs/keycloak/themes:/opt/keycloak/themes`.
- **Realm** (`configs/keycloak/hce-realm.json` + aplicado al realm activo): `displayName: "Denta Cloud"`, `loginTheme: "denta-cloud"`, `internationalizationEnabled: true`, `defaultLocale: "es"`, `supportedLocales: ["es"]`, `registrationAllowed: false`.

---

## 4. Cómo correr / iterar en LOCAL (gotchas importantes)

- **Frontend (Vite en Docker, Windows): el HMR NO detecta cambios** a través del bind mount. Tras editar archivos del frontend hay que **reiniciar el contenedor**:
  `docker compose restart hce-client` y luego **`Ctrl+Shift+R`** en el navegador.
- **Keycloak**:
  - Para que tome el **volumen de temas** hubo que **recrear** el contenedor: `docker compose up -d hce-identity`.
  - El realm **ya estaba importado**, y `start-dev --import-realm` **no pisa** un realm existente → los cambios de `loginTheme`/i18n/registro se aplicaron al realm activo vía **Admin REST API** (`admin` / `admin_secure_password_2026`):
    ```
    TOKEN=$(curl -s -d client_id=admin-cli -d username=admin -d password=admin_secure_password_2026 -d grant_type=password \
      http://localhost:8080/realms/master/protocol/openid-connect/token | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
    curl -X PUT http://localhost:8080/admin/realms/hce-realm -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"realm":"hce-realm","loginTheme":"denta-cloud","internationalizationEnabled":true,"defaultLocale":"es","supportedLocales":["es"],"registrationAllowed":false,"displayName":"Denta Cloud"}'
    ```
  - En `start-dev` el **cache de temas está apagado**: los cambios de CSS/SVG se reflejan al recargar (con **hard refresh** por el cache del navegador), sin reiniciar.

---

## 5. Verificación realizada (local)
- Frontend: `npx tsc --noEmit` y `npx vite build` en verde tras cada cambio.
- Landing: render verificado por el dueño en runtime (varias iteraciones de feedback: hero, logo, colores, orden de secciones, capa de confianza).
- Keycloak: verificado por HTTP que el login carga `login/denta-cloud/css/login.css` (200), el ícono SVG (200), está en **español**, **sin selector de idioma**, **sin registro**, título "Ingresá a Denta Cloud", y campo de contraseña unificado.

---

## 6. Pendientes (antes de dar 100% por cerrado)
1. ⚠️ **Reemplazar placeholders** en `content.tsx`: `STATS` (+30 clínicas, +50.000 turnos, 4,9★, 99,9%) y `TESTIMONIOS` (3 ficticios). Hoy son de muestra; **no publicar con datos inventados**.
2. **Decisión CTA de cierre**: ¿se agrega un CTA después de Testimonios? (recomendado). Hoy el CTA final está en el medio.
3. **Imágenes opcionales**: las secciones "Para quién es" usan íconos; si se quieren fotos, los prompts están en `docs/design/landing_denta_cloud_prompts_imagenes.md` (correr en Gemini).
4. Opcional login: subtítulo de bienvenida (requiere override de `login.ftl`); aplicar identidad a "recuperar contraseña".

---

## 7. Checklist de DESPLIEGUE A PRODUCCIÓN
**Frontend (S3/CloudFront):**
- [ ] Reemplazar placeholders de STATS/TESTIMONIOS por datos reales.
- [ ] Confirmar `WHATSAPP_NUMERO`.
- [ ] `npm run build` y subir a `s3://odontocloud-frontend-2026` + invalidar CloudFront `E1UKXKQOWMVBOM`.

**Keycloak (AWS Elastic Beanstalk `Odontocloud-Keycloak-env`):**
- [ ] Desplegar/empaquetar el tema `denta-cloud` en el contenedor de prod (montar `themes/` o incluirlo en la imagen). En prod conviene `--spi-theme-cache-themes=true` (rendimiento) y reconstruir.
- [ ] Aplicar al realm de prod (vía Admin Console o export/import del realm): `loginTheme=denta-cloud`, `defaultLocale=es`, `supportedLocales=["es"]`, `registrationAllowed=false`, `displayName="Denta Cloud"`.
- [ ] Verificar el login en `auth.systia.ar` (logo, español, sin idioma, sin registro).

> El `docker-compose.yml` (monta themes) es para LOCAL. Producción usa env vars de EB; el tema se despliega aparte.

---

## 8. Cómo continuar (handoff)
- Toda la landing es **declarativa**: el copy y los datos viven en `content.tsx`. Para editar textos/orden/datos, tocar ahí y `sections.tsx`/`LandingDentaCloud.tsx`.
- El skin se controla con tokens en `landing.css` (`--brand-blue`, `--brand-mint`, `--accent`). La variante navy está en `landing-pro.css` (`?v=pro`).
- El tema de Keycloak se itera editando `configs/keycloak/themes/denta-cloud/login/...` + hard refresh.
- Recordar los **gotchas de §4** (reiniciar `hce-client` tras editar frontend; Admin API para cambios de realm).
