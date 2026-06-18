import { SetMetadata } from '@nestjs/common';

/**
 * Marca un controller/endpoint como perteneciente a un módulo de suscripción.
 * El `ModulesGuard` verifica que el tenant tenga ese módulo contratado y vigente
 * (`tenant_modules`), devolviendo 403 MODULE_NOT_ENABLED si no → el front muestra el upsell.
 *
 * Ej: @RequiresModule('protesis-lab')
 */
export const REQUIRED_MODULE_KEY = 'requiredModule';
export const RequiresModule = (moduleKey: string) => SetMetadata(REQUIRED_MODULE_KEY, moduleKey);
