# 0006 — Clave natural del paciente = sexo (M/F) + DNI

**Estado:** Aceptada · **Fecha:** 2026-05

## Contexto
En Argentina el **DNI solo NO es único**: históricamente dos personas (M y F) pudieron compartir el mismo número (Libreta de Enrolamiento/Cívica).

## Decisión
La identidad demográfica de un paciente por tenant es **(sexo registral M/F + DNI)**, no el DNI solo. Aplica al matching, a la HCE y a la integración con CliniChat (turnos WhatsApp).

## Consecuencias
- Validaciones de duplicados y búsquedas usan la clave compuesta.
- No asumir DNI único; siempre considerar el sexo en el matching.
