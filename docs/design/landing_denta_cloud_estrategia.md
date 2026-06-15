# Estrategia y Contenido — Landing Pública "Denta Cloud"

**Preparado por:** Agente de Producto Clínico
**Fecha:** 2026-06-14
**Marca:** Denta Cloud — *Odontología Digital* (dominio: systia.ar; nombre interno: DentHCE)
**Destino:** Agente `ux` (layout/visual) y `code-generator` (implementación). Este documento define el **QUÉ y el COPY**, no el diseño visual ni el código.
**Decisión del dueño:** la landing **NO lleva sección de precios**. CTA principal = **Solicitar demo / contacto**.

> Voz e identidad: respetar la biblia de diseño (`.claude/skills/design-system/SKILL.md`): tema claro/clínico estilo "Mercado Pago", tipografía Inter, **español rioplatense (voseo)**, iconografía `lucide-react`. La landing es la primera impresión de marca.

---

## 1. Posicionamiento / propuesta de valor

**Frase fuerte (titular maestro):**
> **Tu clínica odontológica, ordenada y en la nube.**

**Frases de apoyo:**
- La historia clínica, el odontograma, los turnos y la facturación a obras sociales en un solo lugar, accesible desde cualquier dispositivo.
- Pensada para Argentina: exportación PAMI, obras sociales y turnos por WhatsApp, sin instalar nada.
- Activás solo los módulos que usás y tu clínica conserva su propia marca.

**Quién somos (una línea):** Denta Cloud es el sistema de gestión clínica odontológica (HCE) en la nube, modular y seguro, diseñado para consultorios y clínicas argentinas.

**Diferenciadores clave a comunicar (jerarquía):**
1. Odontograma interactivo de doble capa (lo existente vs. lo planificado) — el corazón visual del producto.
2. Turnos por WhatsApp con IA, sincronizados con la agenda.
3. Modular por suscripción: pagás y activás solo lo que necesitás.
4. White-label real: la clínica usa su propio logo, color y datos.
5. Seguridad y estándares serios (Keycloak, aislamiento por clínica, HL7 FHIR R4, auditoría).

---

## 2. Arquitectura de la landing (secciones ordenadas)

| # | Sección | Objetivo |
| :-- | :--- | :--- |
| 0 | **Barra superior (nav)** | Marca + acceso rápido a "Iniciar sesión" y CTA "Solicitar demo". |
| 1 | **Hero** | Captar en 5 segundos: qué es, para quién, y empujar a la demo. |
| 2 | **Barra de confianza (trust bar)** | Reforzar credibilidad inmediata: estándares y atributos (cloud, seguro, FHIR, Argentina). |
| 3 | **Beneficios clave** | Traducir capacidades en valor para la clínica (4-6 tarjetas). |
| 4 | **Módulos** | Mostrar el producto modular: qué activa cada clínica según necesita. |
| 5 | **Odontograma (destacado)** | Sección estrella con el diferenciador visual; muestra el producto en acción. |
| 6 | **Turnos por WhatsApp con IA (destacado)** | Diferenciador comercial fuerte para el mercado local. |
| 7 | **Cómo funciona** | Bajar la fricción percibida: 3 pasos simples para empezar. |
| 8 | **Confianza / seguridad** | Tranquilizar sobre datos de pacientes (Zero Trust, FHIR, auditoría, nube). |
| 9 | **Para quién es** | Que el visitante se reconozca (consultorio individual, clínica multi-profesional). |
| 10 | **CTA final** | Conversión: cierre claro hacia "Solicitar demo". |
| 11 | **Footer** | Marca, contacto, enlaces legales, "Iniciar sesión", firma de estándares. |

> **Sin sección de precios.** Donde naturalmente iría, va el CTA de demo.

---

## 3. Copy concreto por sección

### Sección 0 — Barra superior (nav)
- **Marca:** Denta Cloud · *Odontología Digital*
- **Enlaces de nav (ancla a secciones):** Beneficios · Módulos · Cómo funciona
- **Botón secundario:** `Iniciar sesión`
- **Botón primario:** `Solicitar demo`

### Sección 1 — Hero
- **Titular (H1):** **Tu clínica odontológica, ordenada y en la nube.**
- **Subtítulo:** Historia clínica, odontograma interactivo, turnos y obras sociales en una sola plataforma. Accedé desde la compu o el celular, sin instalar nada.
- **CTA primario:** `Solicitar demo`
- **CTA secundario:** `Ver cómo funciona` (ancla a la sección 7)
- **Microcopy bajo el botón:** Te mostramos la plataforma funcionando con un caso real de tu especialidad. Sin compromiso.

### Sección 2 — Barra de confianza (trust bar)
Cuatro sellos cortos (texto + ícono):
- **100% en la nube** — Entrá desde cualquier dispositivo.
- **Datos seguros** — Aislamiento por clínica y auditoría de accesos.
- **Estándar HL7 FHIR R4** — Interoperable de verdad.
- **Hecho para Argentina** — Obras sociales, PAMI y WhatsApp.

### Sección 3 — Beneficios clave
- **Título de sección:** Todo lo que tu consultorio necesita, en un solo lugar
- **Subtítulo:** Menos papeles, menos sistemas sueltos, más tiempo para tus pacientes.

Tarjetas:
1. **Historia clínica completa**
   Anamnesis, estado bucal, plan de tratamiento, evolución y consentimiento informado, siempre a mano y siempre legible.
2. **Odontograma interactivo de doble capa**
   Registrá lo que ya está y lo que vas a tratar. Marcá superficies directamente sobre el diente y mirá el plan de un vistazo.
3. **Agenda y turnos sin fricción**
   Calendario por día o semana, triaje de la sala de espera por urgencia, estado del sillón y recordatorios automáticos.
4. **Turnos por WhatsApp con IA**
   Tus pacientes piden turno por WhatsApp y se agendan solos, sincronizados con tu agenda. Menos llamados, menos ausentes.
5. **Obras sociales y PAMI**
   Datos de afiliado y obra social integrados, con exportación de la historia a PDF en formato PAMI.
6. **Tu marca, no la nuestra**
   Configurá tu logo, tu color y tus datos profesionales. Tus pacientes ven tu clínica, no un sistema genérico.

### Sección 4 — Módulos
- **Título de sección:** Activá solo lo que tu clínica necesita
- **Subtítulo:** Denta Cloud es modular. Empezás con lo esencial y sumás funciones cuando tu clínica crece.

Tarjetas de módulo (cada una: nombre + frase corta):
- **Historia Clínica Odontológica** — El núcleo: ficha, odontograma, plan de tratamiento y evolución.
- **Agenda y Turnos** — Calendario, triaje, estado del box y recordatorios.
- **Turnos por WhatsApp (IA)** — Reservas automáticas por WhatsApp sincronizadas con tu agenda.
- **Obras Sociales y PAMI** — Afiliados, cobertura y exportación en formato PAMI.
- **Marca de tu clínica (White-label)** — Tu identidad visual en toda la plataforma.
- **Seguridad y Auditoría** — Control de accesos por clínica y registro de cada acción.

*Microcopy de cierre del bloque:* ¿No sabés por dónde empezar? En la demo armamos el combo justo para tu clínica.

### Sección 5 — Odontograma (destacado)
- **Etiqueta (kicker):** EL CORAZÓN DE LA HISTORIA CLÍNICA
- **Título:** Un odontograma que se entiende de un vistazo
- **Texto:** Registrá el estado actual y el tratamiento planificado en capas separadas, marcá superficies afectadas directo sobre el diente y compartí el plan con tu paciente de forma clara. Adiós a las fichas de papel ilegibles.
- **Bullets de apoyo:**
  - Doble capa: lo existente y lo planificado, sin confusión.
  - Marcado por superficie, rápido y preciso.
  - Plan de tratamiento conectado a la evolución del paciente.
- **CTA contextual:** `Quiero verlo en acción` → demo

### Sección 6 — Turnos por WhatsApp con IA (destacado)
- **Etiqueta (kicker):** MENOS TELÉFONO, MÁS CONSULTORIO
- **Título:** Tus pacientes sacan turno por WhatsApp, solos
- **Texto:** Un asistente con IA atiende a tus pacientes por WhatsApp, les ofrece los horarios disponibles y agenda el turno automáticamente en tu calendario. Vos te enterás con la agenda ya actualizada.
- **Bullets de apoyo:**
  - Reservas 24/7 sin que nadie atienda el teléfono.
  - Sincronización automática con tu agenda de Denta Cloud.
  - Menos ausencias gracias a los recordatorios.
- **CTA contextual:** `Sumá WhatsApp a tu clínica` → demo

### Sección 7 — Cómo funciona
- **Título de sección:** Empezar es simple
- **Paso 1 — Solicitás tu demo:** Nos contás cómo trabaja tu clínica y te mostramos la plataforma con tu caso.
- **Paso 2 — Configuramos tu clínica:** Activamos tus módulos, cargamos tu marca y dejamos todo listo, sin instalaciones.
- **Paso 3 — Empezás a atender digital:** Tu equipo entra desde cualquier dispositivo y trabaja desde el primer día.

### Sección 8 — Confianza / seguridad
- **Título de sección:** La información de tus pacientes, protegida en serio
- **Subtítulo:** La seguridad no es un extra: es la base de Denta Cloud.
- Tarjetas:
  - **Aislamiento por clínica (Zero Trust):** Cada clínica ve únicamente sus propios datos. Nadie cruza información.
  - **Identidad y accesos controlados:** Inicio de sesión seguro con roles por persona (Keycloak).
  - **Auditoría de accesos:** Queda registro de quién accedió a cada historia y cuándo.
  - **Estándar HL7 FHIR R4:** Tus datos son interoperables y portables, sin quedar encerrados.

### Sección 9 — Para quién es
- **Título de sección:** Pensada para cómo trabaja la odontología argentina
- Tarjetas:
  - **Consultorios independientes** — Ordená tu día a día y profesionalizá tu atención sin complicarte.
  - **Clínicas multi-profesional** — Coordiná agendas, sillones y equipo con todo centralizado.
  - **Clínicas que trabajan con obras sociales y PAMI** — Afiliados, cobertura y documentación, resueltos.

### Sección 10 — CTA final
- **Título:** Llevá tu clínica odontológica a la nube
- **Subtítulo:** Te mostramos Denta Cloud funcionando con un caso real de tu especialidad. Sin compromiso.
- **CTA primario:** `Solicitar demo`
- **CTA secundario:** `Ya soy cliente — Iniciar sesión`

### Sección 11 — Footer
- **Marca:** Denta Cloud · *Odontología Digital*
- **Tagline corto:** Historia clínica odontológica en la nube, para Argentina.
- **Columnas de enlaces:**
  - *Producto:* Beneficios · Módulos · Cómo funciona
  - *Empresa:* Solicitar demo · Contacto
  - *Cuenta:* Iniciar sesión
- **Firma de estándares:** Powered by Denta Cloud · HL7 FHIR R4
- **Legal:** © 2026 Denta Cloud — systia.ar · Términos · Privacidad

---

## 4. CTAs (jerarquía y destinos)

| CTA | Tipo | Texto | Destino | Dónde aparece |
| :-- | :-- | :--- | :--- | :--- |
| Primario | Conversión | `Solicitar demo` | Form de contacto / demo (a definir por ux: modal o `mailto`/form) | Nav, hero, secciones destacadas, CTA final |
| Secundario A | Navegación | `Ver cómo funciona` | Ancla interna a sección 7 | Hero |
| Secundario B | Acceso clientes | `Iniciar sesión` | `keycloak.login()` | Nav y CTA final/footer |

**Reglas de CTA:**
- El primario es siempre el mismo verbo y destino: **no inventar "Prueba gratis"** ni montos/planes.
- El acceso de clientes existentes (`Iniciar sesión`) debe estar visible pero subordinado al de demo.
- Todos los `Solicitar demo` llevan al mismo lugar (consistencia de medición de conversión).

---

## 5. Criterios de aceptación del contenido

La landing se considera **aprobada por Producto** cuando cumple:

- [ ] **Mensaje claro en 5 segundos:** un odontólogo que llega al hero entiende qué es (HCE odontológica en la nube), para quién (clínicas/consultorios argentinos) y qué hacer (Solicitar demo).
- [ ] **Sin precios:** no aparece ningún monto, plan con valor, ni la palabra "precio/tarifa/$"; el espacio comercial lo ocupa el CTA de demo.
- [ ] **Foco en conversión a demo:** el CTA primario `Solicitar demo` está presente y visible en hero, al menos 2 secciones intermedias y el cierre.
- [ ] **Voseo rioplatense consistente:** todos los verbos en imperativo usan voseo (Digitalizá, Gestioná, Sumá, Activá, Registrá, Accedé). Cero "tú/usted".
- [ ] **Capacidades reales, sin promesas falsas:** cada beneficio/módulo corresponde a una capacidad existente del sistema (verificada en repo). No se prometen funciones inexistentes.
- [ ] **Diferenciadores visibles:** odontograma de doble capa y turnos por WhatsApp con IA tienen su sección destacada propia.
- [ ] **Modularidad comunicada:** queda claro que se activa solo lo que la clínica necesita.
- [ ] **Confianza presente:** seguridad/aislamiento por clínica, auditoría y HL7 FHIR R4 aparecen explicados en lenguaje claro (no solo siglas).
- [ ] **White-label comunicado:** se menciona que la clínica conserva su marca.
- [ ] **Acceso de clientes disponible:** `Iniciar sesión` accesible desde nav y footer.
- [ ] **Coherencia de marca:** "Denta Cloud" + subtítulo "Odontología Digital", tema claro, Inter, lucide-react (delegar verificación visual a `ux`).
- [ ] **Accesible y responsive:** delegado a `ux`/design-system (WCAG 2.1 AA, 360/768/1280), pero el copy no debe depender de íconos para entenderse.

---

## 6. Íconos sugeridos (lucide-react)

> Sugerencia para `ux`/`code-generator`. Strokes finos (1.5), monocromo con acento del primario del tenant.

**Trust bar (sección 2):**
- 100% en la nube → `Cloud`
- Datos seguros → `ShieldCheck`
- HL7 FHIR R4 → `Network` (o `Share2`)
- Hecho para Argentina → `MapPin`

**Beneficios (sección 3):**
- Historia clínica completa → `FileText` (o `ClipboardList`)
- Odontograma de doble capa → `Layers` (o `Activity`)
- Agenda y turnos → `CalendarDays`
- Turnos por WhatsApp con IA → `MessageCircle` (+ `Sparkles` para la IA)
- Obras sociales y PAMI → `FileCheck2` (o `BadgeCheck`)
- Tu marca (white-label) → `Palette`

**Módulos (sección 4):**
- Historia Clínica Odontológica → `Stethoscope` (o `FileText`)
- Agenda y Turnos → `CalendarDays`
- Turnos por WhatsApp (IA) → `MessageCircle`
- Obras Sociales y PAMI → `FileCheck2`
- White-label → `Palette`
- Seguridad y Auditoría → `ShieldCheck`

**Cómo funciona (sección 7):**
- Solicitás demo → `MousePointerClick` (o `Send`)
- Configuramos tu clínica → `Settings2`
- Empezás a atender → `Rocket` (o `CheckCircle2`)

**Confianza / seguridad (sección 8):**
- Aislamiento por clínica → `Lock`
- Identidad y accesos → `KeyRound`
- Auditoría de accesos → `History` (o `ScrollText`)
- HL7 FHIR R4 → `Network`

**Para quién es (sección 9):**
- Consultorio independiente → `User`
- Clínica multi-profesional → `Users`
- Obras sociales / PAMI → `Building2`

**Secciones destacadas:**
- Odontograma (5) → `Layers`
- WhatsApp IA (6) → `MessageCircle` + `Sparkles`

---

## Notas de handoff
- Este documento define contenido y estrategia. El **layout, responsividad y tokens** los resuelve el agente `ux` apoyándose en `.claude/skills/design-system/SKILL.md`.
- La landing actual a reemplazar: `hce-frontend/src/components/LandingLogin.tsx` (conserva marca y SVG del logo; el copy y la estructura se amplían según este doc).
- **Pendiente de decisión del dueño / `ux`:** mecanismo exacto del CTA "Solicitar demo" (modal con formulario, `mailto:`, o WhatsApp directo). Producto recomienda formulario corto: nombre, clínica, teléfono/WhatsApp y especialidad, para calificar el lead.
