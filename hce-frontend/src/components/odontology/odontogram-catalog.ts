/**
 * CATÁLOGO DEL ODONTOGRAMA — fuente única de verdad de la simbología.
 *
 * Es la versión digital y editable del recuadro de "Referencias" de la ficha
 * del Círculo Odontológico de Jujuy. Cada estado es UNA fila que alimenta:
 *   1. el botón de la barra de herramientas,
 *   2. el glifo que se dibuja en el diente,
 *   3. el renglón de la leyenda,
 *   4. cómo se guarda en la base (código SNOMED FHIR).
 *
 * El COLOR no vive acá: lo define la capa (rojo = existente / azul = a realizar).
 *
 * Para mantenimiento: editar/agregar un estado = editar/agregar una fila.
 * Reusar un glifo existente o cambiar nombre/código/grupo = solo este archivo.
 * Un glifo con una FORMA nueva (que no esté en GlyphKind) requiere además
 * agregar su dibujo en el renderizador (renderPieceGlyph / renderFaceGlyph).
 */

export type OdontogramLayer = 'existing' | 'planned';

export type GlyphKind =
  | 'rellenoCara'        // pinta la cara afectada (caries, restauración)
  | 'lineasHorizontales' // incrustación
  | 'lineasVerticales'   // endodoncia (1 = uni, 3 = multi)
  | 'letra'              // momificación (M), formocresol (F), sellante (S)
  | 'circulo'            // corona
  | 'pernoCorona'        // perno corona / corona espiga
  | 'poste'              // perno pilar
  | 'X'                  // extracción (indicada azul / realizada roja)
  | 'ausente'            // pieza ausente
  | 'tornillo';          // implante

export type Scope = 'cara' | 'pieza';
export type Grupo = 'Diagnóstico' | 'Restauraciones' | 'Endodoncia' | 'Cirugía' | 'Prevención';

export interface OdontoState {
  id: string;
  label: string;
  grupo: Grupo;
  alcance: Scope;
  glifo: GlyphKind;
  letra?: string;            // solo para glifo 'letra'
  variante?: number;         // solo para 'lineasVerticales' (1 uni, 3 multi)
  resourceType: 'Condition' | 'Procedure';
  snomed: { code: string; display: string };
  text: string;              // FHIR code.text
  capaFija?: OdontogramLayer; // hallazgo inherente a una capa (caries/ausente = existente)
  hidden?: boolean;          // legacy: se interpreta para registros viejos pero NO se ofrece en el selector
}

export const ODONTOGRAM_CATALOG: OdontoState[] = [
  // --- Diagnóstico ---
  { id: 'caries', label: 'Caries', grupo: 'Diagnóstico', alcance: 'cara', glifo: 'rellenoCara',
    resourceType: 'Condition', snomed: { code: '80967001', display: 'Caries dental' }, text: 'Caries dental activa', capaFija: 'existing' },
  { id: 'ausente', label: 'Pieza ausente', grupo: 'Diagnóstico', alcance: 'pieza', glifo: 'ausente',
    resourceType: 'Condition', snomed: { code: '272673000', display: 'Ausencia dental' }, text: 'Pieza ausente', capaFija: 'existing' },

  // --- Restauraciones ---
  { id: 'restauracion', label: 'Restauración', grupo: 'Restauraciones', alcance: 'cara', glifo: 'rellenoCara',
    resourceType: 'Procedure', snomed: { code: '23450005', display: 'Restauración dental' }, text: 'Restauración (simple/compuesta según caras)' },
  { id: 'incrustacion', label: 'Incrustación', grupo: 'Restauraciones', alcance: 'cara', glifo: 'lineasHorizontales',
    resourceType: 'Procedure', snomed: { code: '60116006', display: 'Incrustación dental' }, text: 'Incrustación' },
  { id: 'corona', label: 'Corona', grupo: 'Restauraciones', alcance: 'pieza', glifo: 'circulo',
    resourceType: 'Procedure', snomed: { code: '172922005', display: 'Corona protésica' }, text: 'Corona' },
  { id: 'pernoCorona', label: 'Perno corona / espiga', grupo: 'Restauraciones', alcance: 'pieza', glifo: 'pernoCorona',
    resourceType: 'Procedure', snomed: { code: '49454002', display: 'Perno corona' }, text: 'Perno corona / corona espiga' },
  { id: 'pernoPilar', label: 'Perno pilar', grupo: 'Restauraciones', alcance: 'pieza', glifo: 'poste',
    resourceType: 'Procedure', snomed: { code: '79827002', display: 'Perno muñón / pilar' }, text: 'Perno pilar' },

  // --- Endodoncia ---
  { id: 'endoUni', label: 'Endodoncia unirradicular', grupo: 'Endodoncia', alcance: 'pieza', glifo: 'lineasVerticales', variante: 1,
    resourceType: 'Procedure', snomed: { code: '234961008', display: 'Endodoncia unirradicular' }, text: 'Endodoncia unirradicular' },
  { id: 'endoMulti', label: 'Endodoncia multirradicular', grupo: 'Endodoncia', alcance: 'pieza', glifo: 'lineasVerticales', variante: 3,
    resourceType: 'Procedure', snomed: { code: '42425007', display: 'Endodoncia multirradicular' }, text: 'Endodoncia multirradicular' },
  { id: 'momificacion', label: 'Momificación', grupo: 'Endodoncia', alcance: 'pieza', glifo: 'letra', letra: 'M',
    resourceType: 'Procedure', snomed: { code: '234959006', display: 'Momificación pulpar' }, text: 'Momificación' },
  { id: 'formocresol', label: 'Formocresol', grupo: 'Endodoncia', alcance: 'pieza', glifo: 'letra', letra: 'F',
    resourceType: 'Procedure', snomed: { code: '56433008', display: 'Pulpotomía con formocresol' }, text: 'Formocresol' },

  // --- Cirugía ---
  // Legacy: la "Extracción" genérica se reemplazó por las dos específicas. Se mantiene OCULTA
  // (hidden) solo para interpretar/dibujar registros antiguos guardados con SNOMED 65546002.
  { id: 'extraccion', label: 'Extracción', grupo: 'Cirugía', alcance: 'pieza', glifo: 'X', hidden: true,
    resourceType: 'Procedure', snomed: { code: '65546002', display: 'Extracción dental' }, text: 'Extracción' },
  { id: 'extraccionSimple', label: 'Extracción simple', grupo: 'Cirugía', alcance: 'pieza', glifo: 'X',
    resourceType: 'Procedure', snomed: { code: '30097004', display: 'Extracción simple de pieza dental' }, text: 'Extracción simple' },
  { id: 'extraccionRetenido', label: 'Extracción tercer molar retenido', grupo: 'Cirugía', alcance: 'pieza', glifo: 'X',
    resourceType: 'Procedure', snomed: { code: '75394008', display: 'Extracción quirúrgica de pieza retenida' }, text: 'Extracción de tercer molar retenido' },
  { id: 'implante', label: 'Implante', grupo: 'Cirugía', alcance: 'pieza', glifo: 'tornillo',
    resourceType: 'Procedure', snomed: { code: '36653000', display: 'Implante dental' }, text: 'Implante dental' },

  // --- Prevención ---
  { id: 'sellante', label: 'Sellante', grupo: 'Prevención', alcance: 'cara', glifo: 'letra', letra: 'S',
    resourceType: 'Procedure', snomed: { code: '418705001', display: 'Sellador de fosas y fisuras' }, text: 'Sellante de fosas y fisuras' },
];

/** Orden de grupos para la barra de herramientas. */
export const GRUPOS: Grupo[] = ['Diagnóstico', 'Restauraciones', 'Endodoncia', 'Cirugía', 'Prevención'];

export const getById = (id: string): OdontoState | undefined => ODONTOGRAM_CATALOG.find((s) => s.id === id);

/** Busca el estado por código SNOMED + tipo de recurso (para interpretar lo guardado). */
export const getBySnomed = (code: string, resourceType: string): OdontoState | undefined =>
  ODONTOGRAM_CATALOG.find((s) => s.snomed.code === code && s.resourceType === resourceType);

export const byGrupo = (g: Grupo): OdontoState[] => ODONTOGRAM_CATALOG.filter((s) => s.grupo === g && !s.hidden);
