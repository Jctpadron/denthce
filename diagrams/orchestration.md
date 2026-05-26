## Mermaid de orquestación

Archivo: `diagrams/orchestration.mmd`

```mermaid
flowchart TD
    SA[Super Admin Humano] --> ORQ[Agente Orquestador]

    ORQ --> ASK{¿Existe skill adecuado?}
    ASK -- Sí --> ASSIGN[Asignar tarea]
    ASK -- No --> PROPOSE[Proponer nuevo skill]

    PROPOSE --> JUSTIFY[Justificar necesidad]
    JUSTIFY --> APPROVE{Aprobación humana}
    APPROVE -- No --> REJECT[No crear skill]
    APPROVE -- Sí --> CREATE[Crear skill nuevo]

    CREATE --> REG[Registrar en catálogo]
    REG --> ASSIGN

    ORQ --> ARC[Arquitecto]
    ORQ --> SEC[Seguridad]
    ORQ --> FHIR[FHIR/MCP]
    ORQ --> PROD[Producto Clínico]
    ORQ --> UX[UX/HCE]
    ORQ --> INT[Integraciones]
    ORQ --> QA[QA/Test]
    ORQ --> DEV[DevOps/Release]

    ARC --> ORQ
    SEC --> ORQ
    FHIR --> ORQ
    PROD --> ORQ
    UX --> ORQ
    INT --> ORQ
    QA --> ORQ
    DEV --> ORQ

    FHIR --> MCPFHIR[MCP-FHIR]
    SEC --> MCPSec[MCP-Security]
    INT --> MCPInt[MCP-Integrations]
    PROD --> MCPPlan[MCP-Planning]
    ORQ --> MCPPlan
