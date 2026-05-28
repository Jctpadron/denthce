# Bitácora HCE: Pruebas de Estrés de Base de Datos, Volumen y Expiración de Sesión

*   **Fecha de Entrega:** 2026-05-26
*   **Agente Responsable:** Orquestador (Antigravity)
*   **Estado:** ✅ 100% Completado y Validado (Passed)

---

## 🛠️ Tareas de Estrés y Volumen Realizadas

### 1. Poblado Masivo de Datos (Seeding)
*   Diseñé e implementé el script executable de estrés en **[`testing/scripts/test_stress.js`](file:///d:/APP-jct/app-historias-clinicas/testing/scripts/test_stress.js)**.
*   Autentiqué de forma segura dos cuentas de consultorios independientes:
    *   **Inquilino A:** `doctor_julio` (Mendoza).
    *   **Inquilino B:** `admin_hce` (San Juan).
*   Se crearon en bucle rápido y secuencial **50 registros de pacientes** con nombres, DNI, fechas de nacimiento, correos, teléfonos y domicilios aleatorios provenientes de diccionarios variables.
*   Para cada paciente, se registraron **3 recursos clínicos complejos**, totalizando **150 registros clínicos** adicionales en la base de datos:
    *   **Signos Vitales (`Observation`):** Temperatura, peso, talla o pulso con valores aleatorios realistas y código LOINC.
    *   **Alergias (`AllergyIntolerance`):** Alergia a la Penicilina, Látex o Aspirina con codificación SNOMED.
    *   **Tratamientos Odontológicos (`Procedure`):** Tratamiento de conducto o restauración con resina indicando pieza dental (11 al 48) y cara (V, D, L, M, O) con código SNOMED.

### 2. Verificación de Expiración de Sesión (Session Timeout)
*   El script analizó el JWT decodificando los campos `iat` (Issued At) y `exp` (Expiration).
*   **Resultado de Expiración:** El tiempo de vida útil del token de acceso es de exactamente **300 segundos (5 minutos)**.
*   **Conclusión:** La aplicación se desconectará y solicitará autenticación nuevamente después de **5 minutos** si el token de acceso no es renovado en segundo plano (Silent Refresh) mediante el token de refresco (Refresh Token) provisto en el login.

---

## 📊 Métricas de Rendimiento Registradas

La base de datos PostgreSQL (`hce-database`) y el backend NestJS demostraron una velocidad de respuesta extraordinaria bajo carga:

*   **Pacientes creados:** 50/50 (100% de éxito).
*   **Registros clínicos enlazados:** 150/150 (100% de éxito).
*   **Peticiones REST procesadas totales:** 201 peticiones.
*   **Tiempo total del test de estrés:** **3.18 segundos**.
*   **Promedio de respuesta de la API:** **15.7 milisegundos** por petición.
*   **Tasa de procesamiento (Throughput):** **63.2 peticiones por segundo**.

---

## 💻 Registro de Consola Real de la Prueba

```
⚡ INICIANDO PRUEBA DE ESTRÉS Y VOLUMEN DE DATOS ⚡

🔐 1. Autenticando doctores en Keycloak...
   ✅ Autenticación exitosa.
   🔍 Análisis de Expiración del Token Keycloak:
      - Emitido en (iat): 26/5/2026, 04:07:00
      - Expira en (exp):  26/5/2026, 04:12:00
      - Tiempo de vida de sesión activa: 300 segundos (5 minutos)
      👉 CONCLUSIÓN: La aplicación se desconectará y solicitará autenticación nuevamente después de exactamente **5 minutos** de inactividad del token.

💾 2. Sembrando 50 pacientes (25 por Doctor/Inquilino) e Historias Clínicas...

⏳ Procesando Dr. Julio (Inquilino A)...
   Processed 5/50 patients (DNI 24392257: Sebastián Ramírez)
   Processed 10/50 patients (DNI 19300549: Felipe Acosta)
   Processed 15/50 patients (DNI 29874931: Mateo Sánchez)
   Processed 20/50 patients (DNI 71209776: Valentina Pérez)
   Processed 25/50 patients (DNI 92374014: Sofía Acosta)

⏳ Procesando Dr. Admin HCE (Inquilino B)...
   Processed 30/50 patients (DNI 77977053: Sebastián Díaz)
   Processed 35/50 patients (DNI 63632092: Camila López)
   Processed 40/50 patients (DNI 16112309: Lucía García)
   Processed 45/50 patients (DNI 89543536: Sofía López)
   Processed 50/50 patients (DNI 85061674: Santiago Gómez)

📊 3. Métricas de Rendimiento del Sistema:
   - Pacientes sembrados con éxito: 50/50
   - Fallos de transacción: 0
   - Peticiones REST enviadas totales: 201
   - Tiempo total de prueba de estrés: 3.18 segundos
   - Promedio de respuesta de API: 15.7 ms por petición
   - Tasa de procesamiento (Throughput): 63.2 peticiones/segundo

🎉 ¡PRUEBA DE ESTRÉS FINALIZADA CON ÉXITO! (100% Correcto) 🎉
```
