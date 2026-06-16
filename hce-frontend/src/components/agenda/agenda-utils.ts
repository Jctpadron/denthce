/**
 * Utilidades compartidas de la Agenda (Módulo 5).
 * Centraliza el cálculo de franjas horarias desde el scheduleJson del tenant,
 * el formateo de fechas y los metadatos visuales de estado/prioridad del turno.
 * Las horas se manejan en la zona local del navegador (consultorio argentino).
 */

/** getDay() (0=domingo) → clave en español usada por scheduleJson del tenant. */
export const DIA_POR_INDICE: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

export const DIAS_SEMANA_LABEL: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const SLOT_STEP_MIN = 30;

export interface DaySlot {
  start: Date;
  end: Date;
}

/** Suma minutos a una fecha sin mutarla. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/** Devuelve la fecha a las 00:00 local. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lunes de la semana que contiene `date` (semana laboral arranca lunes). */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = d.getDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow; // mover al lunes
  return addMinutes(d, diff * 24 * 60);
}

/** Rango de atención (en minutos desde 00:00) para un día concreto según scheduleJson. */
export function rangoAtencion(
  scheduleJson: Record<string, string>,
  date: Date,
): { startMin: number; endMin: number } | null {
  const clave = DIA_POR_INDICE[date.getDay()];
  const rango = scheduleJson?.[clave];
  if (!rango || !rango.includes('-')) return null;
  const [ini, fin] = rango.split('-');
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return null;
  return { startMin: hi * 60 + mi, endMin: hf * 60 + mf };
}

/** Genera las franjas de `SLOT_STEP_MIN` minutos del día según el horario del tenant. */
export function franjasDelDia(scheduleJson: Record<string, string>, date: Date): DaySlot[] {
  const rango = rangoAtencion(scheduleJson, date);
  if (!rango) return [];
  const base = startOfDay(date);
  const slots: DaySlot[] = [];
  for (let m = rango.startMin; m < rango.endMin; m += SLOT_STEP_MIN) {
    slots.push({ start: addMinutes(base, m), end: addMinutes(base, m + SLOT_STEP_MIN) });
  }
  return slots;
}

/** Rango horario global (min/max) entre todos los días con atención, para alinear la grilla semanal. */
export function rangoHorarioSemanal(
  scheduleJson: Record<string, string>,
): { startMin: number; endMin: number } {
  let min = 24 * 60;
  let max = 0;
  for (const clave of Object.keys(DIAS_SEMANA_LABEL)) {
    const rango = scheduleJson?.[clave];
    if (!rango || !rango.includes('-')) continue;
    const [ini, fin] = rango.split('-');
    const [hi, mi] = ini.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);
    if (!Number.isNaN(hi)) min = Math.min(min, hi * 60 + mi);
    if (!Number.isNaN(hf)) max = Math.max(max, hf * 60 + mf);
  }
  if (max <= min) return { startMin: 9 * 60, endMin: 18 * 60 }; // fallback razonable
  return { startMin: min, endMin: max };
}

export function formatHora(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function formatFechaLarga(date: Date): string {
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatFechaCorta(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

/** Fecha en formato YYYY-MM-DD local (para el parámetro `date`/`dateFrom` del backend). */
export function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha+hora local en formato `datetime-local` (YYYY-MM-DDTHH:mm). */
export function toLocalDateTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${toLocalDateInput(date)}T${h}:${min}`;
}

export interface StatusMeta {
  label: string;
  color: string; // texto/acento
  bg: string; // fondo tenue
  border: string;
}

/** Metadatos visuales por estado FHIR Appointment.status. */
export function statusMeta(status: string): StatusMeta {
  switch (status) {
    case 'booked':
      return { label: 'Confirmado', color: '#1d4ed8', bg: 'rgba(41,98,255,0.08)', border: 'rgba(41,98,255,0.25)' };
    case 'arrived':
      return { label: 'En sala de espera', color: '#b45309', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.28)' };
    case 'fulfilled':
      return { label: 'Atendido', color: '#047857', bg: 'rgba(5,150,105,0.10)', border: 'rgba(5,150,105,0.28)' };
    case 'noshow':
      return { label: 'Ausente', color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)' };
    case 'cancelled':
      return { label: 'Cancelado', color: '#b91c1c', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.2)' };
    case 'proposed':
      return { label: 'Sugerido', color: '#6d28d9', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' };
    default:
      return { label: status || '—', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'var(--border-color)' };
  }
}

/** Niveles de urgencia tipo ESI simplificado (5.4). 1 = más urgente. */
export interface PriorityMeta {
  level: number;
  label: string;
  color: string;
  bg: string;
}

export const PRIORITY_LEVELS: PriorityMeta[] = [
  { level: 1, label: 'Emergencia', color: '#b91c1c', bg: 'rgba(220,38,38,0.12)' },
  { level: 2, label: 'Urgente', color: '#c2410c', bg: 'rgba(234,88,12,0.12)' },
  { level: 3, label: 'Prioritario', color: '#b45309', bg: 'rgba(217,119,6,0.12)' },
  { level: 4, label: 'Estándar', color: '#1d4ed8', bg: 'rgba(41,98,255,0.10)' },
  { level: 5, label: 'No urgente', color: '#047857', bg: 'rgba(5,150,105,0.10)' },
];

export function priorityMeta(level?: number): PriorityMeta {
  return PRIORITY_LEVELS.find((p) => p.level === level) || PRIORITY_LEVELS[3]; // estándar por defecto
}

/** Extrae el nombre del paciente de un recurso FHIR Appointment (participant Patient). */
export function nombrePacienteDeAppt(appt: any): string {
  const p = (appt?.participant || []).find((x: any) => x?.actor?.reference?.startsWith('Patient/'));
  return p?.actor?.display || 'Sin paciente asignado';
}

/** Extrae el nivel de prioridad del recurso FHIR Appointment (campo R4 `priority`, 0-9). */
export function prioridadDeAppt(appt: any): number | undefined {
  const p = appt?.priority;
  return typeof p === 'number' && p >= 1 && p <= 5 ? p : undefined;
}
