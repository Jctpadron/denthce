# Walkthrough - Ocultamiento temporal de datos administrativos en presupuesto odontologico

**Fecha:** 2026-08-03  
**Responsable:** Codex / Orquestador  
**Estado:** Implementado en frontend local, pendiente de despliegue si el Super Admin lo solicita.

## Decision

Se oculto temporalmente el bloque colapsable **Datos administrativos (cuotas, obra social, presentacion a OS)** de la pestana **Estado contable** del modal **Plan de Tratamiento - Presupuesto**.

## Motivo

Durante la revision de usabilidad, el Super Admin determino que el bloque no aporta a la funcionalidad principal actual del dashboard/modal contable. La pantalla debe priorizar:

- Total presupuestado.
- Pagado.
- Saldo pendiente.
- Credito a favor cuando exista sobrepago.
- Registro y anulacion de pagos.
- Tabla de pagos con saldo/credito por movimiento.

## Alcance Del Cambio

- Se elimina solo la visualizacion del bloque administrativo.
- No se eliminan campos de datos ni columnas existentes.
- Los valores historicos de `obraSocial`, `cantidadCuotas`, `fechaPresentacion` y `fechaLiquidacion` se conservan si ya existen en presupuestos guardados.
- No se altera backend ni migraciones.

## Razonamiento De Producto

La funcionalidad de cuotas/obra social/presentacion a OS requiere una definicion funcional separada para no mezclar tres procesos distintos:

- Financiacion del paciente.
- Cobertura/obra social.
- Presentacion/liquidacion administrativa ante financiador.

Hasta que esa definicion se complete, mostrar el bloque genera ruido y reduce claridad para recepcion/secretaria.

## Verificacion

- `npm.cmd run build` en `hce-frontend`: OK.

## Pendiente

- Si se decide recuperar esta funcionalidad, redisenarla como secciones separadas: **Financiacion del paciente** y **Obra social**, no como un unico acordeon generico.
