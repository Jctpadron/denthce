# Walkthrough: Separación de Entornos y Diagnóstico de Errores en DentHCE

Hemos completado la ejecución de los cambios necesarios para resolver el problema de comunicación del backend con Keycloak local, corregir la inicialización de la base de datos local y asegurar que los usuarios médicos y administradores compartan el mismo `tenant_id` para resolver la invisibilidad de datos en desarrollo.

## Cambios Realizados

### 1. Backend REST API
- **Archivo modificado**: `hce-backend/src/auth/jwt.strategy.ts`
  Se adaptó el constructor para leer dinámicamente el `issuer` y el `jwksUri` de Keycloak desde variables de entorno (`KEYCLOAK_ISSUER_URL` y `KEYCLOAK_JWKS_URI`), con un fallback local para compatibilidad sin configuración.
- **Archivo modificado**: `hce-backend/src/app.module.ts`
  Se modificó la configuración de TypeORM para activar la sincronización mediante la variable de entorno `DB_SYNCHRONIZE === 'true'` (permitiendo su desactivación segura en producción).

### 2. Base de Datos e Infraestructura
- **Archivo modificado**: `scripts/init.sql`
  Se agregaron las definiciones DDL de las tablas e índices que no existían originalmente en el esquema de inicialización del contenedor de PostgreSQL:
  - `patient_audit_log` (para auditoría demográfica de pacientes)
  - `fhir_encounters` (para encuentros clínicos)
  - `fhir_medication_requests` (para recetas electrónicas)
  Esto soluciona los errores 500 al insertar nuevos pacientes debido a la falta de tablas físicas.
- **Archivo modificado**: `docker-compose.yml`
  - Se inyectaron las variables de entorno de comunicación interna de Docker para el servicio `hce-api` (`KEYCLOAK_ISSUER_URL` y `KEYCLOAK_JWKS_URI` apuntando a `hce-keycloak`), resolviendo el error 401 Unauthorized que ocurría cuando el backend buscaba Keycloak en su propio `localhost`.
  - Se estableció `DB_SYNCHRONIZE` en `"false"` para que el backend dependa exclusivamente del archivo `init.sql` limpio e inmutable.

### 3. Seguridad e Identidades (Keycloak)
- Se forzó el reinicio completo de contenedores y volúmenes locales. Esto eliminó la base de datos vieja e importó de forma limpia la configuración de `configs/keycloak/hce-realm.json`.
- Los usuarios `doctor_julio` y `admin_hce` ahora se registran en local con el atributo `tenant_id` mapeado a `mi_consultorio_dent_hce`, lo que les permite ver e interactuar con los mismos pacientes y registros clínicos.

---

## Verificación y Pruebas Realizadas

### 1. Pruebas de Integración de Signos Vitales
Se ejecutó de forma exitosa el script de validación local del flujo completo (admisión + inyección de observaciones FHIR) usando las credenciales del médico `doctor_julio`:

```powershell
node testing/scripts/test_vitals_julio.js
```

**Resultado obtenido:**
```text
🧪 Iniciando Verificación de Signos Vitales con usuario doctor_julio...
✅ Autenticación exitosa. Token obtenido.
📌 Registrando paciente de prueba DNI: 68646769...
✅ Paciente creado con éxito. ID FHIR: 205f55d9-ca83-4ac2-8c49-80ce9be43367

⚡ Registrando 25 registros de signos vitales (Observaciones FHIR)...
   [1/25] Registrado: Presión Arterial a las 06:36:13
   ...
   [25/25] Registrado: Presión Arterial a las 06:36:13

🔍 4. Verificando persistencia y consulta en la API...

🎉 RESULTADO DEL TEST:
----------------------------------------------
📌 Paciente ID: 205f55d9-ca83-4ac2-8c49-80ce9be43367
📊 Total observaciones FHIR creadas: 25
🔍 Total observaciones FHIR encontradas: 25
🟢 TEST COMPLETADO CON ÉXITO: 25/25 registros validados.
```

### 2. Levantamiento de Servidores
- **Servidor del Backend (NestJS):** Escuchando de forma limpia en http://localhost:3000 sin problemas de compilación ni de base de datos.
- **Servidor del Frontend (Vite):** Levantado en http://localhost:5173 sin advertencias.
- **Keycloak Local:** Levantado en http://localhost:8080 con el realm `hce-realm` y la base de datos PostgreSQL enlazados correctamente.
