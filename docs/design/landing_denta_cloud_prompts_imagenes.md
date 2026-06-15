# Prompts de imágenes (nano banana / Gemini) — Landing "Denta Cloud"

**Fecha:** 2026-06-14
**Regla del proyecto:** las imágenes/ilustraciones custom NO las genera Claude; se entregan estos prompts para correr en **Gemini (nano banana)**. Los íconos de UI salen de **lucide-react** (ver estrategia, §6) y NO se generan.
**Base:** `docs/design/landing_denta_cloud_estrategia.md`.

> Capturas de producto (odontograma, agenda, sync WhatsApp): **usar screenshots reales** del sistema dentro de un mockup de dispositivo. Para eso están los prompts de "mockup vacío" (P2b, P3b): generás el dispositivo y luego incrustás la captura.

---

## Estilo base (común a TODAS las imágenes — pegarlo en cada prompt)

> Fotografía publicitaria profesional, estética SaaS médica premium, **luminosa y limpia, tema claro** (fondos casi blancos, mucha luz natural, ambiente clínico moderno). Paleta neutra con un **acento azul (#1e6fd9)**. Aspecto realista de alta calidad, nitidez profesional, profundidad de campo suave. Contexto **Argentina / Latinoamérica** (personas latinas, sin estereotipos). **Sin texto, sin letras, sin logos, sin marcas de agua, sin interfaces inventadas con texto.** Composición con aire/espacio negativo para superponer texto después.

---

## P1 — HERO (prioridad ALTA) · relación 16:9 (apaisada, ~1920×1080)
*Reemplaza `/img/landing_dental_clinical.png`. Debe tener el lado IZQUIERDO despejado para el titular.*

```
[Estilo base] Una odontóloga profesional latina, joven-adulta, con ambo azul moderno,
sonriente y de pie en un consultorio odontológico luminoso y minimalista, usando una
tablet/laptop con gesto seguro y relajado. Luz natural suave entrando por una ventana.
La persona y el equipamiento ubicados a la DERECHA del encuadre; todo el TERCIO IZQUIERDO
debe quedar limpio y claro (pared blanca desenfocada) para colocar texto encima.
Sensación de tecnología, orden y confianza. Composición horizontal cinematográfica.
```

## P2a — ODONTOGRAMA, escena (prioridad ALTA) · relación 4:3
*Apoyo visual de la sección destacada del odontograma (escena, no la UI).*

```
[Estilo base] Primer plano de las manos de un odontólogo marcando con un lápiz óptico
sobre una tablet apoyada en el escritorio del consultorio, en actitud de registrar un
tratamiento. Fondo de consultorio odontológico moderno desenfocado en tonos claros.
Foco nítido en la mano y la tablet. Transmite precisión y trabajo digital. Sin mostrar
texto ni interfaz legible en la pantalla (pantalla con brillo neutro).
```

## P2b — ODONTOGRAMA, mockup de dispositivo VACÍO (alternativa recomendada) · relación 4:3
*Generás el dispositivo y luego incrustás el screenshot real del odontograma.*

```
[Estilo base] Render limpio de una laptop moderna abierta y una tablet, vistas de frente,
flotando sobre un fondo blanco suave con sombra sutil. Las PANTALLAS COMPLETAMENTE EN
BLANCO (vacías, sin contenido), listas para insertar una captura. Estilo mockup de
producto tecnológico, minimalista, con un leve degradé azul claro de ambiente.
```

## P3a — WHATSAPP IA, escena (prioridad ALTA) · relación 4:3 o vertical 4:5
*Apoyo de la sección "Turnos por WhatsApp con IA".*

```
[Estilo base] Una persona sostiene un smartphone en la mano en un ambiente cotidiano y
luminoso (living u oficina), en actitud de chatear para sacar un turno. Fondo cálido y
desenfocado. Foco en la mano y el teléfono. La pantalla del teléfono con brillo neutro,
SIN texto ni conversación legible. Transmite cercanía, simpleza y disponibilidad 24/7.
```

## P3b — WHATSAPP IA, mockup de teléfono VACÍO (alternativa recomendada) · relación 4:5 (vertical)
*Para incrustar el screenshot real del chat/sync.*

```
[Estilo base] Render de un smartphone moderno visto de frente, flotando sobre fondo
blanco suave con sombra sutil y un leve halo verde-azulado de ambiente. PANTALLA
COMPLETAMENTE EN BLANCO (vacía), lista para insertar una captura. Estilo mockup de
producto, minimalista.
```

## P4 — PARA QUIÉN ES: Consultorio independiente (prioridad MEDIA) · relación 3:2

```
[Estilo base] Un odontólogo latino en su consultorio individual, ordenado y luminoso,
revisando información en una pantalla mientras prepara la atención. Ambiente íntimo y
profesional, sensación de control y tranquilidad. Sin texto en pantallas.
```

## P5 — PARA QUIÉN ES: Clínica multi-profesional (prioridad MEDIA) · relación 3:2

```
[Estilo base] Equipo de tres profesionales odontológicos latinos (mixto) en una clínica
moderna y amplia con varios sillones, coordinándose con naturalidad. Ambiente dinámico,
luminoso y colaborativo. Sensación de organización y crecimiento. Sin texto en pantallas.
```

## P6 — PARA QUIÉN ES / Obras sociales: Recepción (prioridad MEDIA) · relación 3:2

```
[Estilo base] Una recepcionista latina amable atendiendo a un paciente en el mostrador
de recepción de una clínica odontológica luminosa, con una computadora. Trato cálido y
profesional. Sin texto legible en la pantalla.
```

## P7 — Fondo de ambiente para sección Seguridad / CTA final (prioridad BAJA, opcional) · relación 16:9

```
[Estilo base] Imagen de ambiente abstracta y muy sutil: textura clínica clara con un
degradé azul suave (#1e6fd9) y formas geométricas limpias, evocando seguridad y nube,
muy desaturada para usar como fondo detrás de texto. Sin objetos protagonistas, sin texto.
```

---

## Notas para correr en Gemini (nano banana)
- Pegá el **[Estilo base]** al inicio de cada prompt (reemplazá el literal por el párrafo completo de "Estilo base").
- Pedí la **relación de aspecto** indicada en cada imagen.
- Si una imagen sale con texto/letras pegoteadas, agregá: *"sin ningún texto ni letras en la imagen"*.
- Mantené el mismo estilo/iluminación entre todas para que la landing se vea coherente.
- Si querés versiones para fotorrealismo máximo, se pueden traducir los prompts a inglés (Gemini rinde algo mejor en inglés para fotografía); avisá y los paso.
- Guardá los resultados en `hce-frontend/public/img/` con nombres claros (ej. `landing_hero.png`, `landing_odontograma.png`, `landing_whatsapp.png`, `landing_para_consultorio.png`, etc.).
```
