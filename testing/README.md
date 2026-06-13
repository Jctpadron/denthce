# 🧪 Suite de Pruebas de la Historia Clínica Electrónica (HCE)

Este directorio centraliza todos los scripts de prueba, bitácoras de ejecución e instrucciones técnicas para garantizar la calidad del software y la integridad de los datos en la HCE.

---

## 📂 Estructura del Directorio

*   **`scripts/`**: Contiene los scripts ejecutables en Node.js que realizan pruebas de integración y E2E directas contra el backend y Keycloak.
*   **`logs/`**: Bitácora histórica en Markdown de las ejecuciones exitosas de pruebas para auditoría.

---

## ⚙️ Requisitos Previos

Antes de ejecutar las pruebas, asegúrate de tener levantado el entorno local:

1.  **Servicios Docker (Base de Datos y Keycloak):**
    ```bash
    docker compose up -d
    ```
2.  **API Backend (NestJS en puerto 3000):**
    ```bash
    cd hce-backend
    npm run start:dev
    ```
3.  **Frontend (React/Vite en puerto 5173 - Opcional para pruebas manuales):**
    ```bash
    cd hce-frontend
    npm run dev
    ```

---

## 🚀 Ejecución de Pruebas

Los scripts de prueba utilizan Node.js puro y la Fetch API nativa para minimizar dependencias externas pesadas.

### 1. Pruebas de Gestión de Personal (E2E)
Verifica la creación de personal (secretarias/enfermeros) en Keycloak por parte de un médico, valida la asignación del atributo `tenant_id` y el inicio de sesión del nuevo usuario.

```bash
node testing/scripts/test_user_management.js
```

### 2. Pruebas de Admisión y Ficha Clínica (Multi-Tenant)
Verifica el alta de pacientes según el estándar HL7 FHIR Patient R4, el registro clínico de constantes vitales (`Observation`), alergias (`AllergyIntolerance`) y odontograma (`Procedure`), validando el aislamiento estricto de datos (Zero Trust) y duplicidad de DNI entre diferentes médicos/inquilinos.

```bash
node testing/scripts/test_patient_clinical.js
```

### 3. Pruebas de Modificación de Datos de Pacientes (FHIR R4 & Multi-Tenant)
Verifica el flujo completo de actualización/edición de datos demográficos de pacientes existentes, la persistencia en base de datos, el aislamiento multi-inquilino Zero Trust en peticiones PUT y el control de unicidad de DNI en modificaciones.

```bash
node testing/scripts/test_patient_update.js
```

---

## 🔒 Auditoría y Seguridad (Zero Trust)

Nuestras pruebas verifican de forma estricta las siguientes reglas de aislamiento:
1.  **Búsqueda aislada (MPI):** Las búsquedas demográficas por DNI solo devuelven registros que pertenecen al inquilino del usuario autenticado.
2.  **Acceso directo protegido:** Las consultas a `GET /fhir/r4/Patient/:id` y `/clinical-resource` retornan `404 Not Found` si el paciente pertenece a otro inquilino, asumiendo una postura de ocultamiento preventivo (Zero Trust).
3.  **Unicidad local de DNI:** El DNI debe ser único por inquilino, pero se permiten DNI idénticos entre diferentes inquilinos de forma independiente.
