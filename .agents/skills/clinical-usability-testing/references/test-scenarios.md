# Escenarios De Testing Clínico

Usar pacientes ficticios realistas. Evitar DNIs reales conocidos cuando se pruebe producción.

## Casos Base

1. Adulto simple
   - Alta completa, turno inicial, consulta simple y odontograma básico.
   - Objetivo: medir facilidad del flujo principal.

2. Paciente con obra social
   - Datos personales completos, cobertura, número de afiliado, presupuesto.
   - Objetivo: validar campos administrativos y consistencia con finanzas.

3. Menor de edad
   - Responsable/tutor, teléfono alternativo, datos faltantes intencionales.
   - Objetivo: detectar campos ausentes o validaciones clínicas/legales.

4. Paciente con antecedentes relevantes
   - Alergia, medicación, patología crónica, alerta clínica.
   - Objetivo: comprobar visibilidad de riesgos antes de tratamiento.

5. Caso odontológico complejo
   - Piezas ausentes, caries, restauraciones, endodoncia, evolución.
   - Objetivo: estresar odontograma, historia y recuperación posterior.

6. Caso financiero
   - Presupuesto con varios ítems, descuento, seña, pago parcial, cuenta corriente.
   - Objetivo: validar cálculos, estados y claridad administrativa.

7. Caso de prótesis/laboratorio
   - Orden, laboratorio asignado, estado, chat o trazabilidad si aplica.
   - Objetivo: comprobar continuidad clínica-laboratorio.

8. Error humano
   - DNI duplicado, fecha inválida, campo obligatorio vacío, búsqueda sin resultados.
   - Objetivo: evaluar mensajes, bloqueo correcto y recuperación.

## Datos Sugeridos

Crear nombres simples y reconocibles:

- Sofía Méndez, adulta, control preventivo.
- Lucas Herrera, rehabilitación con corona.
- Valentina Rojas, ortodoncia y limpieza.
- Mateo Castro, menor con tutor.
- Camila Benítez, prótesis parcial.
- Tomás Pereyra, urgencia por dolor molar.

Usar prefijo de auditoría en notas si se cargan datos de prueba:

`TEST-USABILIDAD AAAA-MM-DD`
