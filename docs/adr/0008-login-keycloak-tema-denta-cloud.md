# 0008 — Login con tema propio de Keycloak (denta-cloud)

**Estado:** Aceptada · **Fecha:** 2026-06-15

## Contexto
El login de Keycloak usaba el tema por defecto (oscuro, inglés). Se necesitaba la identidad Denta Cloud.

## Decisión
Tema propio **`denta-cloud`** (`configs/keycloak/themes/denta-cloud/`): tema claro, ícono de marca, **español**, **sin selector de idioma**, **sin registro público**, título "Ingresá a Denta Cloud", anti-autocompletado. Realm: `loginTheme=denta-cloud`, `defaultLocale=es`, `supportedLocales=["es"]`, `registrationAllowed=false`. **LIVE en prod** (`auth.systia.ar`).

## Consecuencias
- En prod el Keycloak (Docker EB) **NO** debe usar `OVERWRITE_EXISTING` (borra usuarios runtime); el realm se ajusta por **Admin API**, no por re-import.
- El bundle de prod incluye `aws/keycloak/themes/` montado.
