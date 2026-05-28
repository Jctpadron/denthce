# 📋 Bitácora Histórica de Cambios y Entregas (Changelog)

Este directorio almacena el historial persistente de todas las entregas exitosas, rediseños, testing y cambios estructurales realizados en la Historia Clínica Electrónica (HCE). 

Permite mantener un control de calidad y auditoría de software transparente para el equipo clínico y de desarrollo.

---

## 📈 Historial de Entregas

| **27/05/2026** | **Rediseño de Login y Landing Page** | Pantalla de login/bienvenida responsiva basada en el diseño de Mercado Libre, integrando control de accesos check-sso y Keycloak. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/walkthrough_pantalla_login_landing.md) |
| **27/05/2026** | **Funciones de Orquestación** | Actualización del flujo de delegación, calidad y reglas generales de idioma español para los agentes de la HCE. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/walkthrough_actualizacion_funciones_orquestacion.md) |
| **26/05/2026** | **Pruebas de Integración y Multi-Tenant** | Suite de pruebas de Keycloak, gestión de personal (secretarias) y alta de pacientes con aislamiento Zero Trust. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_testing_usuarios_pacientes.md) |
| **26/05/2026** | **Rediseño Ficha Clínica y Odontograma** | Interfaz unificada estilo Mercado Pago, segmented control de pestañas, hover SVG responsive mobile-safe, e historial del odontograma. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_rediseno_ficha_odontograma.md) |
| **26/05/2026** | **Pruebas de Estrés y Volumen** | Test de estrés de base de datos con 50 pacientes y 150 recursos clínicos aleatorios, y análisis de expiración de sesión Keycloak. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_pruebas_estres_volumen.md) |
| **26/05/2026** | **Modificación de Datos de Pacientes** | Modificación demográfica de pacientes existentes integrada al estándar FHIR R4 con validación de aislamiento. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_modificacion_datos_paciente.md) |
| **26/05/2026** | **Registro de Fecha de Ingreso** | Captura automática de fecha/hora de ingreso del paciente (FHIR Patient Extension) y visualización en buscador y ficha. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_fecha_ingreso_paciente.md) |
| **26/05/2026** | **Ajustes de Búsqueda (Edad / Ingreso)** | Tarjetas con Edad en lugar de Nac. Filtros de búsqueda avanzada por Edad y Fecha de Ingreso en reemplazo de Fecha de Nacimiento. | [Ver Bitácora](file:///d:/APP-jct/app-historias-clinicas/docs/walkthroughs/2026-05-26_ajustes_busqueda_edad_ingreso.md) |

---

## ⚙️ Normas de Registro
1.  Cada vez que se complete un ciclo de desarrollo o un requerimiento funcional aprobado, se debe copiar la información del `walkthrough.md` local en un archivo específico de este directorio.
2.  El nombre de archivo debe seguir el formato: `YYYY-MM-DD_descripcion_corta.md`.
3.  Se debe agregar una fila en la tabla de este índice listando la fecha, el módulo afectado, el resumen de la entrega y el enlace a la bitácora correspondiente.
