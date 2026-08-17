import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ClinicaFinanzasService } from './clinica-finanzas.service';
import { ClinicalGasto } from './clinical-gasto.entity';
import { ClinicalPago } from './clinical-pago.entity';
import { ClinicalPrecio } from './clinical-precio.entity';
import { ClinicalPresupuestoItem } from './clinical-presupuesto-item.entity';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';
import { PatientEntity } from '../patient/patient.entity';

describe('ClinicaFinanzasService', () => {
  let service: ClinicaFinanzasService;
  let precioRepo: jest.Mocked<Repository<ClinicalPrecio>>;
  let presupuestoRepo: jest.Mocked<Repository<ClinicalPresupuesto>>;
  let presupuestoItemRepo: jest.Mocked<Repository<ClinicalPresupuestoItem>>;
  let pagoRepo: jest.Mocked<Repository<ClinicalPago>>;
  let patientRepo: jest.Mocked<Repository<PatientEntity>>;

  const tenantId = 'clinica-test';
  const patientId = '2037da20-c722-4714-8697-552adda33d5f';

  beforeEach(async () => {
    const precioRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    const presupuestoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
    };
    const presupuestoItemRepository = {
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    const pagoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    };
    const gastoRepository = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    const patientRepository = {
      exists: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicaFinanzasService,
        { provide: getRepositoryToken(ClinicalPrecio), useValue: precioRepository },
        { provide: getRepositoryToken(ClinicalPresupuesto), useValue: presupuestoRepository },
        { provide: getRepositoryToken(ClinicalPresupuestoItem), useValue: presupuestoItemRepository },
        { provide: getRepositoryToken(ClinicalPago), useValue: pagoRepository },
        { provide: getRepositoryToken(ClinicalGasto), useValue: gastoRepository },
        { provide: getRepositoryToken(PatientEntity), useValue: patientRepository },
      ],
    }).compile();

    service = module.get(ClinicaFinanzasService);
    precioRepo = module.get(getRepositoryToken(ClinicalPrecio));
    presupuestoRepo = module.get(getRepositoryToken(ClinicalPresupuesto));
    presupuestoItemRepo = module.get(getRepositoryToken(ClinicalPresupuestoItem));
    pagoRepo = module.get(getRepositoryToken(ClinicalPago));
    patientRepo = module.get(getRepositoryToken(PatientEntity));

    void precioRepo;
  });

  it('rechaza presupuesto sin patientId UUID antes de guardar', async () => {
    await expect(
      service.createPresupuesto(
        tenantId,
        {
          patientId: 'paciente-seleccionado-en-ui',
          items: [{ snomedCode: '123', snomedDisplay: 'Consulta', precioUnitario: 1000 }],
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(patientRepo.exists).not.toHaveBeenCalled();
    expect(presupuestoRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza presupuesto para un paciente inexistente o de otro tenant', async () => {
    patientRepo.exists.mockResolvedValue(false);

    await expect(
      service.createPresupuesto(
        tenantId,
        {
          patientId,
          items: [{ snomedCode: '123', snomedDisplay: 'Consulta', precioUnitario: 1000 }],
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(patientRepo.exists).toHaveBeenCalledWith({ where: { id: patientId, tenantId } });
    expect(presupuestoRepo.save).not.toHaveBeenCalled();
  });

  it('enriquece presupuestos con nombre y DNI del paciente', async () => {
    presupuestoRepo.find.mockResolvedValue([
      {
        id: 'presupuesto-1',
        tenantId,
        patientId,
        numero: 'PRES-0001',
      } as ClinicalPresupuesto,
    ]);
    patientRepo.find.mockResolvedValue([
      {
        id: patientId,
        tenantId,
        givenName: 'Sofia',
        familyName: 'Mendez',
        dni: '91010001',
      } as PatientEntity,
    ]);

    const [result] = await service.getPresupuestos(tenantId);

    expect(result.patientDisplay).toBe('Sofia Mendez');
    expect(result.patientDni).toBe('91010001');
  });

  it('rechaza pago para un paciente inexistente o de otro tenant', async () => {
    patientRepo.exists.mockResolvedValue(false);

    await expect(
      service.registrarPago(
        tenantId,
        {
          patientId,
          monto: 1500,
          metodoPago: 'efectivo',
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(patientRepo.exists).toHaveBeenCalledWith({ where: { id: patientId, tenantId } });
    expect(pagoRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza pago con importe cero, negativo o no numerico', async () => {
    patientRepo.exists.mockResolvedValue(true);

    await expect(
      service.registrarPago(
        tenantId,
        {
          patientId,
          monto: 0,
          metodoPago: 'efectivo',
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.registrarPago(
        tenantId,
        {
          patientId,
          monto: Number.NaN,
          metodoPago: 'efectivo',
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pagoRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza pago con fecha futura', async () => {
    patientRepo.exists.mockResolvedValue(true);
    const futura = new Date();
    futura.setDate(futura.getDate() + 1);

    await expect(
      service.registrarPago(
        tenantId,
        {
          patientId,
          monto: 1500,
          metodoPago: 'efectivo',
          fechaPago: futura,
        },
        'doctor_julio',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pagoRepo.save).not.toHaveBeenCalled();
  });
});
