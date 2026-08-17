# Checklist Por Módulo

## Pacientes

- Buscar paciente inexistente.
- Crear paciente con datos mínimos.
- Crear paciente con datos completos.
- Probar DNI duplicado.
- Editar datos y confirmar persistencia.
- Verificar campos largos, acentos, teléfonos y fechas.

## Cobertura

- Agregar obra social/prepaga.
- Marcar cobertura principal.
- Probar paciente particular.
- Validar si la cobertura aparece donde corresponde: ficha, presupuesto o documentos.

## Historia Clínica

- Cargar antecedente médico.
- Cargar alergia o alerta.
- Cargar evolución.
- Guardar, salir y volver a abrir.
- Verificar orden cronológico y claridad de lectura.

## Odontograma

- Marcar pieza sana, cariada, ausente y restaurada.
- Agregar observación por pieza.
- Probar varias caras dentarias.
- Guardar y reabrir.
- Verificar legibilidad en desktop, tablet y mobile.

## Agenda

- Crear turno con paciente existente.
- Crear turno sin paciente si el sistema lo permite.
- Cancelar/reprogramar.
- Probar duración inválida y fecha faltante.
- Confirmar que el estado visual sea claro.

## Finanzas

- Crear presupuesto con uno y varios ítems.
- Validar subtotal, descuento, total y seña.
- Registrar pago parcial.
- Ver cuenta corriente.
- Probar campos inválidos: monto cero, paciente no seleccionado, fecha inválida.

## Prótesis/Laboratorio

- Crear orden vinculada a paciente.
- Cambiar estado.
- Ver trazabilidad.
- Registrar pago o consumo si aplica.
- Confirmar que clínica y laboratorio no se mezclen entre tenants.

## Configuración De Clínica

- Revisar nombre, logo, color, datos del profesional, matrícula y contacto.
- Validar que la marca de la suite y la marca de la clínica convivan bien.
- Verificar favicon/título del navegador.
- Confirmar módulos habilitados.

## Diseño Y Responsive

- Probar 375px, 768px, 1366px.
- Verificar contraste, fuentes, títulos, botones, modales y tablas.
- Detectar texto cortado, solapado o botones fuera de pantalla.
- Confirmar que las acciones principales sean visibles sin explicación externa.
