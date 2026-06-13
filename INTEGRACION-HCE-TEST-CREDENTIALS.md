# Credenciales y Payload de Integración HCE (AWS) ↔ CliniChat (Supabase)

> **De:** Equipo HCE (AWS + NestJS + Keycloak, FHIR R4)
> **Para:** Equipo CliniChat (Supabase + Cloudflare Workers)
> **Fecha:** 2026-06-05
> **Estado:** Entorno local de test y validación e2e consolidado en verde

---

## 1. Credenciales del Entorno de Pruebas (Local Docker Stack)

Para configurar la fila de pruebas en la tabla `public.clinics` en su base de Supabase local (`hce_enabled = true`):

| Campo (columna clinics) | Valor para Desarrollo Local (Docker) | Nota |
|---|---|---|
| `hce_fhir_base_url` | `http://localhost:3000/fhir/r4` | Endpoint principal FHIR R4 de la HCE |
| `hce_keycloak_token_url` | `http://localhost:8080/realms/hce-realm/protocol/openid-connect/token` | Endpoint Keycloak OIDC para OAuth 2.0 |
| `hce_keycloak_client_id` | `hce-app` | Cliente de Keycloak configurado para la app |
| `hce_keycloak_client_secret` | *(no requerido - cliente público)* | Se autentica mediante flujo password grant en local |
| `hce_tenant_id` | `mi_consultorio_dent_hce` | Tenant Scope inyectado en el JWT del inquilino de prueba |

### Datos de Configuración de la Clínica de Test:
* **Médico Principal (`hce_practitioner_id`):** `45790d96-a4c6-f59e-3ab7-a1c424d3f553` (Dr. Julio Mendoza)
* **Especialidad Principal (`hce_specialty_id`):** `d648cbbf-6af0-4442-e54f-173792e991ba` (Odontología General)
* **Credenciales de Service Account simulada en local (OAuth 2.0 Password Grant):**
  - **Username:** `doctor_julio`
  - **Password:** `doctor_pass_2026`
  
*(El token obtenido tiene inyectado el claim `"tenant_id": "mi_consultorio_dent_hce"` y el rol `"medico"`, permitiendo el consumo e2e de todos los endpoints de forma scoped).*

---

## 2. Contratos y Payloads Reales (Validado e2e)

A continuación, se adjuntan los request/response reales capturados en caliente en el backend HCE para cada endpoint.

### 2.1 GET /Practitioner (Discovery de Médicos)
* **Método:** `GET`
* **URL:** `http://localhost:3000/fhir/r4/Practitioner`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response Status:** `200 OK`
* **Response Body:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "fullUrl": "http://localhost:3000/fhir/r4/Practitioner/45790d96-a4c6-f59e-3ab7-a1c424d3f553",
      "resource": {
        "resourceType": "Practitioner",
        "id": "45790d96-a4c6-f59e-3ab7-a1c424d3f553",
        "active": true,
        "name": [
          {
            "text": "Julio Mendoza",
            "family": "Mendoza",
            "given": [
              "Julio"
            ]
          }
        ],
        "identifier": [
          {
            "system": "http://hospital.gov/matricula",
            "value": "MN-456789"
          }
        ]
      }
    }
  ]
}
```

---

### 2.2 GET /HealthcareService (Discovery de Especialidades)
* **Método:** `GET`
* **URL:** `http://localhost:3000/fhir/r4/HealthcareService`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response Status:** `200 OK`
* **Response Body:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "fullUrl": "http://localhost:3000/fhir/r4/HealthcareService/d648cbbf-6af0-4442-e54f-173792e991ba",
      "resource": {
        "resourceType": "HealthcareService",
        "id": "d648cbbf-6af0-4442-e54f-173792e991ba",
        "active": true,
        "name": "Odontología General",
        "specialty": [
          {
            "coding": [
              {
                "system": "http://hospital.gov/specialty",
                "code": "odontología-general",
                "display": "Odontología General"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

### 2.3 GET /Slot (Disponibilidad de Horarios)
* **Método:** `GET`
* **URL:** `http://localhost:3000/fhir/r4/Slot?status=free&specialty=d648cbbf-6af0-4442-e54f-173792e991ba&start=ge2026-06-08T06:00:00-03:00&start=lt2026-06-11T15:00:00-03:00`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response Status:** `200 OK`
* **Response Body (Muestra de Slots Libres):**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 66,
  "entry": [
    {
      "fullUrl": "http://localhost:3000/fhir/r4/Slot/60b64e0d-b50a-e244-a9b0-9e904b7b22a0",
      "resource": {
        "resourceType": "Slot",
        "id": "60b64e0d-b50a-e244-a9b0-9e904b7b22a0",
        "status": "free",
        "start": "2026-06-08T09:00:00-03:00",
        "end": "2026-06-08T09:30:00-03:00",
        "schedule": {
          "reference": "Schedule/08a3d46f-c1f3-23d2-be12-9ab2e342721b"
        }
      }
    }
  ]
}
```

---

### 2.4 POST /Patient (Alta de Paciente)
* **Método:** `POST`
* **URL:** `http://localhost:3000/fhir/r4/Patient`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "resourceType": "Patient",
  "active": true,
  "identifier": [
    {
      "use": "official",
      "system": "http://hospital.gov/dni",
      "value": "777777"
    }
  ],
  "name": [
    {
      "use": "official",
      "family": "Gómez",
      "given": ["Roberto"]
    }
  ],
  "gender": "male",
  "birthDate": "1990-01-01"
}
```
* **Response Status:** `201 Created`
* **Response Body:**
```json
{
  "resourceType": "Patient",
  "active": true,
  "identifier": [
    {
      "use": "official",
      "system": "http://hospital.gov/dni",
      "value": "777777"
    }
  ],
  "name": [
    {
      "use": "official",
      "family": "Gómez",
      "given": [
        "Roberto"
      ]
    }
  ],
  "gender": "male",
  "birthDate": "1990-01-01",
  "id": "9804ac64-674b-46d0-b209-85ef9621c1bc"
}
```

---

### 2.5 GET /Patient?identifier={system}|{value} (Búsqueda de Paciente)
* **Método:** `GET`
* **URL:** `http://localhost:3000/fhir/r4/Patient?identifier=http://hospital.gov/dni|777777&gender=male`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response Status:** `200 OK`
* **Response Body:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "fullUrl": "http://localhost:3000/fhir/r4/Patient/9804ac64-674b-46d0-b209-85ef9621c1bc",
      "resource": {
        "resourceType": "Patient",
        "id": "9804ac64-674b-46d0-b209-85ef9621c1bc",
        "active": true,
        "identifier": [
          {
            "use": "official",
            "type": {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                  "code": "NNARG",
                  "display": "National Person Identifier"
                }
              ]
            },
            "system": "http://hospital.gov/dni",
            "value": "777777"
          }
        ],
        "name": [
          {
            "use": "official",
            "family": "Gómez",
            "given": [
              "Roberto"
            ]
          }
        ],
        "gender": "male",
        "birthDate": "1990-01-01"
      }
    }
  ]
}
```

---

### 2.6 POST /Appointment (Reserva de Turno)
* **Método:** `POST`
* **URL:** `http://localhost:3000/fhir/r4/Appointment`
* **Headers:** 
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
  - `Idempotency-Key: c9d023bb-0f04-4b55-a2b1-ac2487e411b0`
* **Request Body:**
```json
{
  "resourceType": "Appointment",
  "status": "booked",
  "start": "2026-06-08T09:00:00-03:00",
  "patientDni": "777777",
  "gender": "male",
  "practitionerRef": "Practitioner/45790d96-a4c6-f59e-3ab7-a1c424d3f553",
  "practitionerName": "Julio Mendoza",
  "serviceType": "Odontología General",
  "minutesDuration": 30,
  "slot": [
    {
      "reference": "Slot/60b64e0d-b50a-e244-a9b0-9e904b7b22a0"
    }
  ]
}
```
* **Response Status:** `201 Created`
* **Response Body:**
```json
{
  "resourceType": "Appointment",
  "status": "booked",
  "serviceType": [
    {
      "text": "Odontología General"
    }
  ],
  "start": "2026-06-08T12:00:00.000Z",
  "end": "2026-06-08T12:30:00.000Z",
  "created": "2026-06-05T19:11:32.126Z",
  "participant": [
    {
      "actor": {
        "reference": "Patient/9804ac64-674b-46d0-b209-85ef9621c1bc",
        "display": "Roberto Gómez"
      },
      "status": "accepted",
      "required": "required"
    },
    {
      "actor": {
        "reference": "Practitioner/45790d96-a4c6-f59e-3ab7-a1c424d3f553",
        "display": "Julio Mendoza"
      },
      "status": "accepted",
      "required": "required"
    }
  ],
  "extension": [
    {
      "url": "http://hospital.gov/fhir/StructureDefinition/origin-channel",
      "valueCode": "recepcion"
    }
  ],
  "id": "1ff87509-3aab-4923-9ecc-8a34e804db92"
}
```
*(Nota: Si se vuelve a enviar exactamente el mismo payload con la misma cabecera `Idempotency-Key`, el servidor de la HCE responde síncronamente con `200 OK` devolviendo exactamente la misma cita ya creada, previniendo duplicados por reintentos de red).*

---

### 2.7 409 Conflict (Doble reserva de Slot / Slot tomado)
* **Método:** `POST`
* **URL:** `http://localhost:3000/fhir/r4/Appointment`
* **Headers:** 
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
  - `Idempotency-Key: <DIFERENTE_UUID>`
* **Request Body:** *(Cualquier reserva que choque con el horario de un turno activo)*
* **Response Status:** `409 Conflict`
* **Response Body (OperationOutcome):**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "conflict",
      "diagnostics": "slot-unavailable",
      "details": {
        "coding": [
          {
            "system": "http://hospital.gov/fhir/StructureDefinition/appointment-errors",
            "code": "slot-unavailable",
            "display": "Slot ocupado o no disponible"
          }
        ],
        "text": "El horario seleccionado ya se encuentra ocupado por otra cita activa."
      }
    }
  ]
}
```
*(Nota: Se implementó de forma exacta la codificación `issue[0].details.coding[0].code = "slot-unavailable"` que el bot de CliniChat busca para reaccionar ante una carrera de reserva).*

---

### 2.8 PATCH /Appointment/{id} (Cancelación de Turno)
* **Método:** `PATCH`
* **URL:** `http://localhost:3000/fhir/r4/Appointment/1ff87509-3aab-4923-9ecc-8a34e804db92`
* **Headers:** 
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
* **Request Body:**
```json
{
  "status": "cancelled",
  "cancellationReason": "Reprogramación solicitada por el paciente"
}
```
* **Response Status:** `200 OK`
* **Response Body:**
```json
{
  "resourceType": "Appointment",
  "status": "cancelled",
  "serviceType": [
    {
      "text": "Odontología General"
    }
  ],
  "start": "2026-06-08T12:00:00.000Z",
  "end": "2026-06-08T12:30:00.000Z",
  "created": "2026-06-05T19:11:32.000Z",
  "comment": "Reprogramación solicitada por el paciente",
  "participant": [
    {
      "actor": {
        "reference": "Patient/9804ac64-674b-46d0-b209-85ef9621c1bc",
        "display": "Roberto Gómez"
      },
      "status": "declined",
      "required": "required"
    },
    {
      "actor": {
        "reference": "Practitioner/45790d96-a4c6-f59e-3ab7-a1c424d3f553",
        "display": "Julio Mendoza"
      },
      "status": "accepted",
      "required": "required"
    }
  ],
  "extension": [
    {
      "url": "http://hospital.gov/fhir/StructureDefinition/origin-channel",
      "valueCode": "recepcion"
    }
  ],
  "id": "1ff87509-3aab-4923-9ecc-8a34e804db92",
  "cancelationReason": {
    "text": "Reprogramación solicitada por el paciente"
  }
}
```
