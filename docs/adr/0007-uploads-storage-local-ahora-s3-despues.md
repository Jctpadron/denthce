# 0007 — Imágenes/documentos: storage local ahora, S3 antes de uso real

**Estado:** Aceptada (deuda técnica) · **Fecha:** 2026-06-15

## Contexto
La pestaña "Imágenes y documentos" de la HC Odontológica sube radiografías/fotos (FHIR `Media`) y PDFs (`DocumentReference`). Se eligió alcance **imágenes/PDF** (no DICOM/PACS por ahora) y storage **local** para avanzar rápido.

## Decisión
Guardar archivos en **disco local** (`uploads/`) en esta etapa, con URL **relativa** (`/uploads/...`) para facilitar la migración. **Antes de uso clínico real en producción, migrar a S3** (en Elastic Beanstalk el disco es efímero → los archivos se pierden en cada redeploy).

## Consecuencias
- ⚠️ En prod, los archivos subidos **no persisten** hasta migrar a S3. No usar para datos clínicos reales todavía.
- DICOM/PACS queda para una fase posterior (otro ADR si se implementa).
