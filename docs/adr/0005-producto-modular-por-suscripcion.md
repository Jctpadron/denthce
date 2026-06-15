# 0005 — Producto modular por suscripción

**Estado:** Aceptada · **Fecha:** 2026-06-13

## Contexto
El HCE es el producto base; otros (WhatsApp/CliniChat, etc.) son servicios anexables.

## Decisión
Cada módulo/servicio se **activa solo si la clínica lo contrató**. Modelo: `platform_modules` (catálogo) + `tenant_modules` (por clínica, con `expires_at`) + `tenant_config.plan/is_active`. Gobernado por el **Super Admin** (rol `superadmin`, `SuperAdminGuard`) y `ModulesService.isEnabled`. Rama: `feature/superadmin-servicios`.

## Consecuencias
- Las features deben respetar el entitlement (gate) del tenant.
- El alta/baja de servicios (ej. WhatsApp) se orquesta desde el Super Admin.
