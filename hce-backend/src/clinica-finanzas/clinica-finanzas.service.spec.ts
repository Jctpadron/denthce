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

  describe('sobrepago', () => {
    const presupuestoId = '6b1f0c3e-9a4d-4f52-8c11-77b0d9e4a210';

    /** Presupuesto de $10.000 con `yaPagado` ya cobrado en pagos vigentes. */
    const armarPresupuesto = (yaPagado: number) => {
      patientRepo.exists.mockResolvedValue(true);
      presupuestoRepo.findOne.mockResolvedValue({
        id: presupuestoId,
        tenantId,
        patientId,
        total: '10000.00',
        estado: 'aceptado',
      } as any);
      pagoRepo.find.mockResolvedValue(
        yaPagado > 0 ? ([{ monto: String(yaPagado.toFixed(2)) }] as any) : ([] as any),
      );
    };

    const pagar = (monto: number) =>
      service.registrarPago(
        tenantId,
        { patientId, presupuestoId, monto, metodoPago: 'efectivo' },
        'doctor_julio',
      );

    it('rechaza un pago mayor al total cuando no hay pagos previos', async () => {
      armarPresupuesto(0);

      await expect(pagar(1_000_000)).rejects.toThrow(BadRequestException);
      expect(pagoRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza un pago que excede el saldo pendiente tras un pago parcial', async () => {
      armarPresupuesto(6000); // saldo pendiente: 4000

      await expect(pagar(4000.01)).rejects.toThrow(BadRequestException);
      expect(pagoRepo.save).not.toHaveBeenCalled();
    });

    it('informa el saldo real en el mensaje de error', async () => {
      armarPresupuesto(6000);

      await expect(pagar(9999)).rejects.toThrow(/4000\.00/);
    });

    it('acepta el pago que salda exactamente el saldo pendiente', async () => {
      armarPresupuesto(6000);
      pagoRepo.create.mockImplementation((d: any) => d);
      pagoRepo.save.mockImplementation(async (d: any) => d);

      await pagar(4000);

      expect(pagoRepo.save).toHaveBeenCalled();
    });

    it('no cuenta los pagos anulados como cobrados', async () => {
      // El repo ya filtra anuladoAt IS NULL: si todo fue anulado devuelve [],
      // y el saldo vuelve a ser el total. Cobrar 10.000 debe poder hacerse.
      armarPresupuesto(0);
      pagoRepo.create.mockImplementation((d: any) => d);
      pagoRepo.save.mockImplementation(async (d: any) => d);

      await pagar(10000);

      expect(pagoRepo.save).toHaveBeenCalled();
      expect(pagoRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, presupuestoId }),
        }),
      );
    });

    it('no aplica el tope a un pago directo sin presupuesto', async () => {
      patientRepo.exists.mockResolvedValue(true);
      pagoRepo.create.mockImplementation((d: any) => d);
      pagoRepo.save.mockImplementation(async (d: any) => d);

      await service.registrarPago(
        tenantId,
        { patientId, monto: 999_999, metodoPago: 'efectivo' },
        'doctor_julio',
      );

      expect(pagoRepo.save).toHaveBeenCalled();
    });
  });
});
