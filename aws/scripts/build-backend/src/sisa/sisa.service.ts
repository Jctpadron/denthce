import { Injectable } from '@nestjs/common';

/**
 * SisaService — Tarea 2.5
 * Adaptador para el Sistema Integrado de Información Sanitaria (SISA) de Argentina.
 *
 * Actualmente opera en modo MOCK para desarrollo.
 * Para activar la integración real, configurar en .env:
 *   SISA_BASE_URL=https://sisa.msal.gov.ar/sisa/services/rest/
 *   SISA_USER=tu_usuario
 *   SISA_PASSWORD=tu_clave
 *   SISA_MOCK=false
 */
@Injectable()
export class SisaService {
  private readonly isMock: boolean;
  private readonly baseUrl: string;
  private readonly sisaUser: string;
  private readonly sisaPassword: string;

  constructor() {
    this.isMock = process.env.SISA_MOCK !== 'false';
    this.baseUrl = process.env.SISA_BASE_URL || 'https://sisa.msal.gov.ar/sisa/services/rest/';
    this.sisaUser = process.env.SISA_USER || '';
    this.sisaPassword = process.env.SISA_PASSWORD || '';
  }

  /**
   * Verifica un paciente por DNI contra el padrón SISA.
   * @param dni DNI sin puntos ni espacios
   * @param gender 'male' | 'female' — requerido por la API de SISA
   */
  async verificarPorDni(dni: string, gender?: string): Promise<SisaVerificationResult> {
    if (this.isMock) {
      return this.getMockResult(dni);
    }

    try {
      const sexo = gender === 'female' ? 'F' : 'M';
      const url = `${this.baseUrl}/${this.sisaUser}/${this.sisaPassword}/renaper/validar?nrodoc=${dni}&sexo=${sexo}&tipo=DNI`;

      const response = await fetch(url);
      if (!response.ok) {
        return { status: 'error', message: 'SISA no disponible', source: 'sisa-real' };
      }

      const data: any = await response.json();

      // La API de SISA devuelve un campo "resultado" con el estado
      if (data?.resultado === 'OK') {
        return {
          status: 'found',
          source: 'sisa-real',
          dni,
          apellido: data.apellido || '',
          nombre: data.nombre || '',
          fechaNacimiento: data.fechaNacimiento || '',
          sexo: data.sexo === 'F' ? 'female' : 'male',
          cobertura: data.obraSocial || null,
          rnos: data.rnos || null,
        };
      } else {
        return { status: 'not_found', message: 'DNI no encontrado en SISA', source: 'sisa-real' };
      }
    } catch (err) {
      return { status: 'error', message: 'Error conectando con SISA', source: 'sisa-real' };
    }
  }

  /** Genera datos de prueba realistas para el modo mock */
  private getMockResult(dni: string): SisaVerificationResult {
    // Simulación: si termina en número par → encontrado; impar → no encontrado
    const lastDigit = parseInt(dni.slice(-1));

    if (lastDigit % 2 === 0) {
      const mockData: Record<string, Partial<SisaVerificationResult>> = {
        '2': { apellido: 'GARCIA', nombre: 'CARLOS MARTIN', sexo: 'male', cobertura: 'OSDE', rnos: '800801' },
        '4': { apellido: 'RODRIGUEZ', nombre: 'MARIA ELENA', sexo: 'female', cobertura: 'PAMI', rnos: '500001' },
        '6': { apellido: 'MARTINEZ', nombre: 'JUAN PABLO', sexo: 'male', cobertura: 'IOMA', rnos: '300601' },
        '8': { apellido: 'FERNANDEZ', nombre: 'ANA LUCIA', sexo: 'female', cobertura: 'Swiss Medical', rnos: '800101' },
        '0': { apellido: 'LOPEZ', nombre: 'PEDRO DANIEL', sexo: 'male', cobertura: 'Galeno', rnos: '800001' },
      };
      const mock = mockData[String(lastDigit)] || mockData['2'];
      return {
        status: 'found',
        source: 'sisa-mock',
        dni,
        apellido: mock.apellido as string,
        nombre: mock.nombre as string,
        fechaNacimiento: '1985-03-15',
        sexo: mock.sexo as 'male' | 'female',
        cobertura: mock.cobertura as string,
        rnos: mock.rnos as string,
      };
    } else {
      return {
        status: 'not_found',
        message: 'DNI no encontrado en el padrón SISA',
        source: 'sisa-mock',
      };
    }
  }
}

export interface SisaVerificationResult {
  status: 'found' | 'not_found' | 'error';
  source: 'sisa-real' | 'sisa-mock';
  message?: string;
  dni?: string;
  apellido?: string;
  nombre?: string;
  fechaNacimiento?: string;
  sexo?: 'male' | 'female';
  cobertura?: string;
  rnos?: string;
}
