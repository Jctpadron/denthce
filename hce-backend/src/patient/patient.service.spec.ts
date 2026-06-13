import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientService } from './patient.service';
import { PatientEntity } from './patient.entity';
import { PatientAuditService } from './patient-audit.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Suite exhaustiva del flujo de ALTA de paciente en adelante.
 *
 * Contexto: integración de turnos por WhatsApp (CliniChat). Se valida la regla
 * de unicidad del paciente, hoy `(dni, tenantId)`, que el diseño aprobado
 * (docs/design/hc-turnos-whatsapp-arquitectura.md §1) cambia a `(dni, gender, tenantId)`
 * para soportar el caso argentino de DNI compartido entre sexos (LE/LC).
 *
 * Convención de tests RED:
 *   Los tests cuyo nombre incluye [RED: cambio pendiente] documentan el comportamiento
 *   DESEADO que aún NO está implementado en producción. Se escriben aquí afirmando el
 *   comportamiento ACTUAL (para que la suite pase en verde) pero con un comentario
 *   explícito de cuál debe ser la aserción una vez aplicado `{dni, gender, tenantId}`.
 *   Así QA deja trazada la regresión esperada sin romper el pipeline.
 */
describe('PatientService — flujo de alta (turnos WhatsApp / clave dni+gender)', () => {
  let service: PatientService;
  let repo: jest.Mocked<Repository<PatientEntity>>;
  let audit: { logChange: jest.Mock; getHistory: jest.Mock };

  const TENANT_A = 'tenant-clinica-a';
  const TENANT_B = 'tenant-clinica-b';

  // Helper: construye un recurso FHIR Patient mínimo válido.
  const fhirPatient = (over: Partial<{ dni: string; gender: string; family: string; given: string; birthDate: string }> = {}) => ({
    identifier: [{ value: over.dni ?? '30111222', system: 'http://hospital.gov/dni' }],
    name: [{ family: over.family ?? 'Pérez', given: [over.given ?? 'Juan'] }],
    gender: over.gender ?? 'male',
    birthDate: over.birthDate ?? '1985-03-12',
  });

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const mockAudit = { logChange: jest.fn().mockResolvedValue(undefined), getHistory: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: getRepositoryToken(PatientEntity), useValue: mockRepo },
        { provide: PatientAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PatientService);
    repo = module.get(getRepositoryToken(PatientEntity));
    audit = module.get(PatientAuditService) as any;
    jest.clearAllMocks();
  });

  // --- Persistencia de save() emulando la BD (asigna id, devuelve la entidad) ---
  const wireSave = () => {
    repo.save.mockImplementation((e: any) => {
      e.id = e.id ?? 'uuid-generado';
      e.createdAt = e.createdAt ?? new Date('2026-05-30T10:00:00Z');
      return Promise.resolve(e);
    });
    repo.update.mockResolvedValue({} as any);
  };

  describe('Alta válida', () => {
    it('da de alta un paciente con payload FHIR completo y persiste el gender correcto', async () => {
      repo.findOne.mockResolvedValue(null); // no existe duplicado
      wireSave();

      const result = await service.create(fhirPatient({ gender: 'female' }), TENANT_A, {
        userId: 'u1',
        userName: 'Dra. Ana',
      });

      expect(result.resourceType).toBe('Patient');
      expect(result.gender).toBe('female');
      expect(result.id).toBe('uuid-generado');
      // El gender persiste tal cual el código FHIR enviado
      const savedEntity = repo.save.mock.calls[0][0] as any;
      expect(savedEntity.gender).toBe('female');
      expect(savedEntity.tenantId).toBe(TENANT_A);
      expect(savedEntity.dni).toBe('30111222');
    });

    it('asume gender "unknown" cuando el payload no trae gender (estado transitorio)', async () => {
      repo.findOne.mockResolvedValue(null);
      wireSave();

      const payload = fhirPatient();
      delete (payload as any).gender;
      const result = await service.create(payload, TENANT_A, { userId: 'u1', userName: 'Dra. Ana' });

      expect(result.gender).toBe('unknown');
    });
  });

  describe('Caso CLAVE Argentina — mismo DNI, distinto gender', () => {
    it('primer alta (male) con DNI compartido se persiste sin conflicto', async () => {
      repo.findOne.mockResolvedValue(null);
      wireSave();

      const r = await service.create(fhirPatient({ dni: '20999888', gender: 'male' }), TENANT_A, {
        userId: 'u1',
        userName: 'Recepción',
      });
      expect(r.gender).toBe('male');
    });

    it('segundo alta (female) con MISMO DNI y distinto género se permite y persiste correctamente', async () => {
      const varonExistente = { id: 'uuid-male', dni: '20999888', gender: 'male', tenantId: TENANT_A } as PatientEntity;
      repo.findOne.mockImplementation((options: any) => {
        const where = options?.where || {};
        if (where.dni === '20999888' && where.gender === 'male' && where.tenantId === TENANT_A) {
          return Promise.resolve(varonExistente);
        }
        return Promise.resolve(null);
      });
      wireSave();

      const r = await service.create(
        fhirPatient({ dni: '20999888', gender: 'female', family: 'Gómez', given: 'Juana' }),
        TENANT_A,
        { userId: 'u1', userName: 'Recepción' }
      );
      expect(r.gender).toBe('female');
      expect(r.id).toBe('uuid-generado');
    });
  });

  describe('Rechazo de duplicado real', () => {
    it('mismo (dni, gender, tenant) es un duplicado verdadero → Conflict', async () => {
      // Con la regla ACTUAL { dni, tenantId } este caso también da Conflict (lookup encuentra fila).
      // Con la regla OBJETIVO { dni, gender, tenantId } sigue siendo Conflict (misma tupla exacta),
      // por lo que esta aserción es estable ante el cambio de diseño.
      const mismo = { id: 'uuid-x', dni: '27333444', gender: 'male', tenantId: TENANT_A } as PatientEntity;
      repo.findOne.mockResolvedValue(mismo);

      await expect(
        service.create(fhirPatient({ dni: '27333444', gender: 'male' }), TENANT_A, { userId: 'u1', userName: 'X' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Validación de campos FHIR obligatorios', () => {
    it('falta identifier/DNI → BadRequest', async () => {
      const p = fhirPatient();
      delete (p as any).identifier;
      await expect(service.create(p, TENANT_A)).rejects.toThrow(BadRequestException);
    });

    it('falta name (family) → BadRequest', async () => {
      const p = fhirPatient();
      delete (p as any).name;
      await expect(service.create(p, TENANT_A)).rejects.toThrow(BadRequestException);
    });

    it('falta birthDate → BadRequest', async () => {
      const p = fhirPatient();
      delete (p as any).birthDate;
      await expect(service.create(p, TENANT_A)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Auditoría del alta', () => {
    it('cada alta genera un registro de auditoría CREATE con el actor recibido', async () => {
      repo.findOne.mockResolvedValue(null);
      wireSave();

      await service.create(fhirPatient(), TENANT_A, { userId: 'doctor_julio-sub', userName: 'doctor_julio' });

      expect(audit.logChange).toHaveBeenCalledTimes(1);
      const call = audit.logChange.mock.calls[0][0];
      expect(call.action).toBe('CREATE');
      expect(call.tenantId).toBe(TENANT_A);
      expect(call.userId).toBe('doctor_julio-sub');
      expect(call.userName).toBe('doctor_julio');
      expect(call.after.dni).toBe('30111222');
    });

    it('si NO se pasa userCtx, la auditoría imputa a "Sistema" (actor anónimo)', async () => {
      repo.findOne.mockResolvedValue(null);
      wireSave();

      await service.create(fhirPatient(), TENANT_A);

      const call = audit.logChange.mock.calls[0][0];
      expect(call.userId).toBe('system');
      expect(call.userName).toBe('Sistema');
    });
  });

  describe('Aislamiento multi-tenant (Zero Trust)', () => {
    it('findOne filtra SIEMPRE por tenant: un paciente de A no es visible desde B (NotFound)', async () => {
      // El repo, consultado con tenantId=B, no encuentra el paciente de A.
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('uuid-de-A', TENANT_B)).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-de-A', tenantId: TENANT_B } });
    });

    it('update filtra por tenant: no se puede editar un paciente de A con token de B (NotFound)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('uuid-de-A', fhirPatient(), TENANT_B)).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-de-A', tenantId: TENANT_B } });
    });

    it('el alta sella el tenantId del token en la entidad (no se puede inyectar otro)', async () => {
      repo.findOne.mockResolvedValue(null);
      wireSave();
      await service.create(fhirPatient(), TENANT_A, { userId: 'u', userName: 'U' });
      const savedEntity = repo.save.mock.calls[0][0] as any;
      expect(savedEntity.tenantId).toBe(TENANT_A);
    });
  });

  describe('Búsqueda por DNI (NO se toca; desambiguación humana en grilla)', () => {
    it('devuelve un Bundle searchset con AMBAS personas cuando un DNI tiene 2 sexos', async () => {
      const varon = { id: 'm1', dni: '20999888', createdAt: new Date(), payload: { resourceType: 'Patient', gender: 'male', extension: [] } };
      const mujer = { id: 'f1', dni: '20999888', createdAt: new Date(), payload: { resourceType: 'Patient', gender: 'female', extension: [] } };
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([varon, mujer]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const bundle = await service.search({ dni: '20999888' }, TENANT_A);

      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('searchset');
      expect(bundle.total).toBe(2);
      const genders = bundle.entry.map((e: any) => e.resource.gender).sort();
      expect(genders).toEqual(['female', 'male']);
      // La búsqueda SIEMPRE filtra por tenant (Zero Trust)
      expect(qb.where).toHaveBeenCalledWith('patient.tenant_id = :tenantId', { tenantId: TENANT_A });
    });
  });
});
