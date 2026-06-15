# 0001 — HC general reemplazada por HC Odontológica

**Estado:** Aceptada · **Fecha:** 2026-06-15

## Contexto
Existían dos HC: la "Historia Clínica" general (`PatientSearch.tsx` + `components/tabs/`: Alergias, Signos Vitales, Documentos, Antecedentes, Encuentros, Recetas/CDS, SOAP) y la **HC Odontológica** (módulo aislado `OdontologyHC` con tabla y endpoints propios). El producto es odontológico; mantener ambas confunde y duplica.

## Decisión
La **HC Odontológica es el hub clínico**. Se **quitó "Historia Clínica" del menú y de las tarjetas del dashboard**. El código general sigue en el repo pero **oculto/no accesible** desde la UI.

## Consecuencias
- Auditorías, diseño y QA apuntan a `OdontologyHC` (tabs: odontograma, anamnesis, estado bucal, cobertura, consentimiento, evolución, **imágenes y documentos**).
- `PatientSearch`/`tabs/`/`SoapEditor`/`PrescriptionForm` quedan **fuera de alcance** salvo reactivación explícita (entonces nuevo ADR).
- No re-introducir "Historia Clínica" general al menú sin decisión nueva.
