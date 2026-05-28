# Walkthrough: Prueba de Estrés e Inyección de Volumen de Datos (200 Pacientes) en DentHCE

En este walkthrough se detallan la modificación y la ejecución de la prueba de estrés local diseñada para sembrar **200 pacientes** con historias clínicas completas. Esta siembra tiene como finalidad verificar el correcto funcionamiento, velocidad y validaciones de cada una de las pantallas de la interfaz del usuario frente a una base de datos con un volumen realista de información.

---

## Cambios Realizados en el Script de Prueba

### 1. Ampliación del Script de Estrés
- **Archivo modificado**: `testing/scripts/test_stress.js`
  - Se incrementó el número de pacientes sembrados a **200** (100 para el `doctor_julio` en el Inquilino A y 100 para el `admin_hce` en el Inquilino B).
  - Se agregaron las peticiones para crear **Encuentros Clínicos (SOAP)** (`POST /fhir/r4/Patient/:id/encounter`) y su posterior **Firma Digital lógica** (`POST /encounter/:id/sign`).
  - Se agregaron las peticiones para crear **Recetas Electrónicas (MedicationRequest)** (`POST /fhir/r4/Patient/:id/MedicationRequest`) y su respectiva **Firma e-prescribing** (`POST /MedicationRequest/:id/sign`).
  - Cada paciente cuenta ahora con la historia clínica completa cargada: Admisión (Patient), Signo Vital (Observation), Alergia (AllergyIntolerance), Tratamiento Odontológico (Procedure), Consulta SOAP Firmada (Encounter) y Receta Firmada (MedicationRequest).

---

## Resultados y Métricas de la Prueba de Carga

Se ejecutó la prueba en la consola del host de desarrollo local:

```powershell
node testing/scripts/test_stress.js
```

### Reporte de Consola de la Siembra:
```text
⚡ INICIANDO PRUEBA DE ESTRÉS Y VOLUMEN DE DATOS ⚡

🔐 1. Autenticando doctores en Keycloak...
   ✅ Autenticación exitosa.
   🔍 Análisis de Expiración del Token Keycloak:
      - Emitido en (iat): 28/5/2026, 07:49:27
      - Expira en (exp):  28/5/2026, 07:54:27
      - Tiempo de vida de sesión activa: 300 segundos (5 minutos)
      👉 CONCLUSIÓN: La aplicación se desconectará y solicitará autenticación nuevamente después de exactamente **5 minutos** de inactividad del token.

💾 2. Sembrando 200 pacientes (100 por Doctor/Inquilino) e Historias Clínicas...

⏳ Procesando Dr. Julio (Inquilino A)...
   Processed 10/200 patients (DNI 37496723: Nicolás González)
   Processed 20/200 patients (DNI 27425605: Mariana Herrera)
   Processed 30/200 patients (DNI 93238693: Isabella Flores)
   Processed 40/200 patients (DNI 87115424: Valentina Torres)
   Processed 50/200 patients (DNI 76187006: Felipe Torres)
   Processed 60/200 patients (DNI 44066300: Benjamín Medina)
   Processed 70/200 patients (DNI 92424435: Sebastián Fernández)
   Processed 80/200 patients (DNI 13740624: Mateo Torres)
   Processed 90/200 patients (DNI 80677689: Felipe Medina)
   Processed 100/200 patients (DNI 96220385: Santiago Ramírez)

⏳ Procesando Dr. Admin HCE (Inquilino B)...
   Processed 110/200 patients (DNI 74150147: Benjamín Pérez)
   Processed 120/200 patients (DNI 83812872: Benjamín Fernández)
   Processed 130/200 patients (DNI 90795659: Martina López)
   Processed 140/200 patients (DNI 29473884: Isabella Gómez)
   Processed 150/200 patients (DNI 58349695: Benjamín Herrera)
   Processed 160/200 patients (DNI 58422815: Isabella Pérez)
   Processed 170/200 patients (DNI 23116947: Tomás García)
   Processed 180/200 patients (DNI 65904113: Mateo Rodríguez)
   Processed 190/200 patients (DNI 83633002: Benjamín Rodríguez)
   Processed 200/200 patients (DNI 67088404: Benjamín Álvarez)

📊 3. Métricas de Rendimiento del Sistema:
   - Pacientes sembrados con éxito: 200/200
   - Fallos de transacción: 0
   - Peticiones REST enviadas totales: 1401
   - Tiempo total de prueba de estrés: 9.86 segundos
   - Promedio de respuesta de API: 7.0 ms por petición
   - Tasa de procesamiento (Throughput): 142.2 peticiones/segundo

🎉 ¡PRUEBA DE ESTRÉS FINALIZADA CON ÉXITO! (100% Correcto) 🎉
```

---

## Verificación Visual y Validación de Pantallas

Los 200 pacientes y sus registros clínicos ya se encuentran en los contenedores locales. Para realizar la validación visual e interactiva de las pantallas en [http://localhost:5173/](http://localhost:5173/):

1. **Pantalla de Inicio de Sesión:** Iniciar sesión con el usuario `doctor_julio` y contraseña `doctor_pass_2026`.
2. **Buscador de Pacientes:** Escribir un apellido común de los sembrados (por ejemplo, "González", "López", "Ramírez", "Rodríguez") y validar la velocidad de respuesta del buscador con autocompletado y el filtrado por DNI ante el volumen de registros.
3. **Pestaña Ficha Clínica / SOAP:**
   - Seleccionar un paciente de la lista.
   - Validar que se muestren correctamente los registros de **Signos Vitales** (gráficos/valores LOINC), **Alergias** (AllergyIntolerance con coloración de severidad alta), e **Historial de Consultas** (Encounter) mostrando el estado *firmado y bloqueado*.
4. **Pestaña Odontograma:** Seleccionar un paciente y validar que los odontogramas SVG interactivos muestren marcadas las piezas dentales tratadas mediante el procedimiento dental sembrado.
5. **Recetas Médicas (Firma Digital e Inmutabilidad):**
   - Ir a la pestaña de prescripciones.
   - Validar que las recetas creadas por el script aparezcan en estado *firmado*, mostrando el código QR generado para validación de farmacia y el hash criptográfico del contenido.
   - Intentar prescribir una receta con una sustancia a la que el paciente es alérgico (ej. Penicilina) para verificar la validación activa y la alerta del motor **CDS Hooks**.
