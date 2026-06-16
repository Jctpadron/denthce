import { createContext, useContext } from 'react';

/**
 * Contexto de la VISITA odontológica activa. Lo provee la ficha (OdontologyHC) y lo
 * consumen los componentes que registran prestaciones (odontograma, estado bucal,
 * anamnesis, consentimiento, evolución) para asociar cada registro a la visita en curso.
 * Si no hay visita activa, `activeEncounterId` es null → el registro queda suelto (legacy),
 * 100% compatible con el comportamiento anterior.
 */
export interface OdontoVisitCtx {
  activeEncounterId: string | null;
}

export const OdontoVisitContext = createContext<OdontoVisitCtx>({ activeEncounterId: null });

export const useOdontoVisit = (): OdontoVisitCtx => useContext(OdontoVisitContext);
