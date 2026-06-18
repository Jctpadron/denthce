import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProtesisService, CreateOrderDto, SendMessageDto, CreateInsumoDto } from './protesis.service';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';
import { ProtesisStatusHistory } from './protesis-status-history.entity';
import { ProtesisPago } from './protesis-pago.entity';
import { ProtesisConsumoInsumo } from './protesis-consumo-insumo.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProtesisService', () => {
  let service: ProtesisService;
  let orderRepository: Repository<ProtesisOrder>;
  let chatRepository: Repository<ProtesisChat>;
  let insumoRepository: Repository<ProtesisInsumo>;

  const mockOrderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockChatRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInsumoRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  // Repos agregados por el módulo financiero / máquina de estados (PRO.7-PRO.12).
  const mockStatusHistoryRepository = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockPagoRepository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockConsumoRepository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProtesisService,
        {
          provide: getRepositoryToken(ProtesisOrder),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(ProtesisChat),
          useValue: mockChatRepository,
        },
        {
          provide: getRepositoryToken(ProtesisInsumo),
          useValue: mockInsumoRepository,
        },
        {
          provide: getRepositoryToken(ProtesisStatusHistory),
          useValue: mockStatusHistoryRepository,
        },
        {
          provide: getRepositoryToken(ProtesisPago),
          useValue: mockPagoRepository,
        },
        {
          provide: getRepositoryToken(ProtesisConsumoInsumo),
          useValue: mockConsumoRepository,
        },
      ],
    }).compile();

    service = module.get<ProtesisService>(ProtesisService);
    orderRepository = module.get<Repository<ProtesisOrder>>(getRepositoryToken(ProtesisOrder));
    chatRepository = module.get<Repository<ProtesisChat>>(getRepositoryToken(ProtesisChat));
    insumoRepository = module.get<Repository<ProtesisInsumo>>(getRepositoryToken(ProtesisInsumo));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrders', () => {
    it('debería filtrar por tenantId si el tenantType es clinica', async () => {
      const tenantId = 'clinica_test';
      const mockOrders = [{ id: '1', tenantId }];
      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await service.getOrders(tenantId, 'clinica');

      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockOrders);
    });

    it('debería filtrar por performerTenantId si el tenantType es laboratorio', async () => {
      const tenantId = 'lab_test';
      const mockOrders = [{ id: '1', performerTenantId: tenantId }];
      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await service.getOrders(tenantId, 'laboratorio');

      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { performerTenantId: tenantId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockOrders);
    });
  });

  describe('getOrderDetails', () => {
    it('debería retornar el detalle si el usuario pertenece al tenant emisor', async () => {
      const tenantId = 'clinica_test';
      const mockOrder = { id: 'order_123', tenantId, performerTenantId: 'lab_test', messages: [] };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrderDetails(tenantId, 'order_123');

      expect(result).toEqual(mockOrder);
    });

    it('debería retornar el detalle si el usuario pertenece al tenant receptor (laboratorio)', async () => {
      const tenantId = 'lab_test';
      const mockOrder = { id: 'order_123', tenantId: 'clinica_test', performerTenantId: tenantId, messages: [] };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrderDetails(tenantId, 'order_123');

      expect(result).toEqual(mockOrder);
    });

    it('debería lanzar ForbiddenException si el usuario no pertenece a la clínica ni al laboratorio de la orden', async () => {
      const tenantId = 'hacker_tenant';
      const mockOrder = { id: 'order_123', tenantId: 'clinica_test', performerTenantId: 'lab_test', messages: [] };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(service.getOrderDetails(tenantId, 'order_123')).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si la orden no existe', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrderDetails('tenant', 'invalid_id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createOrder', () => {
    it('debería guardar la orden correctamente con estado inicial received', async () => {
      const tenantId = 'clinica_test';
      const dto: CreateOrderDto = {
        performerTenantId: 'lab_test',
        patientId: 'patient_1',
        dentalWork: {
          workType: 'corona',
          material: 'zirconio',
          color: 'A2',
          teeth: [11],
        },
      };

      const mockSavedOrder = { ...dto, id: 'new_id', tenantId, status: 'received', isManual: false };
      mockOrderRepository.create.mockReturnValue(mockSavedOrder);
      mockOrderRepository.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createOrder(tenantId, dto);

      expect(orderRepository.create).toHaveBeenCalledWith({
        tenantId,
        performerTenantId: dto.performerTenantId,
        patientId: dto.patientId,
        isManual: false,
        patientName: undefined,
        doctorName: undefined,
        doctorMatricula: undefined,
        status: 'received',
        dentalWork: dto.dentalWork,
        requestedDelivery: undefined,
      });
      expect(result).toEqual(mockSavedOrder);
    });

    it('debería guardar una orden manual de laboratorio con metadatos externos', async () => {
      const tenantId = 'lab_test'; // El laboratorio crea la orden
      const dto: CreateOrderDto = {
        isManual: true,
        patientName: 'Roberto Gómez',
        patientId: '777777',
        doctorName: 'Dr. Carlos Pérez',
        doctorMatricula: '5566',
        tenantId: 'Clínica Dental',
        dentalWork: {
          workType: 'corona',
          material: 'zirconio',
          color: 'A2',
          teeth: [14],
        },
      };

      const mockSavedOrder = { ...dto, id: 'manual_id', performerTenantId: tenantId, status: 'received' };
      mockOrderRepository.create.mockReturnValue(mockSavedOrder);
      mockOrderRepository.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createOrder(tenantId, dto);

      expect(orderRepository.create).toHaveBeenCalledWith({
        tenantId: dto.tenantId,
        performerTenantId: tenantId,
        patientId: dto.patientId,
        isManual: true,
        patientName: dto.patientName,
        doctorName: dto.doctorName,
        doctorMatricula: dto.doctorMatricula,
        status: 'received',
        dentalWork: dto.dentalWork,
        requestedDelivery: undefined,
      });
      expect(result).toEqual(mockSavedOrder);
    });
  });

  describe('updateStatus', () => {
    it('debería actualizar el estado de la orden correctamente si es del tenant', async () => {
      const tenantId = 'lab_test';
      const orderId = 'order_123';
      const mockOrder = { id: orderId, tenantId: 'clinica_test', performerTenantId: tenantId, status: 'received' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockImplementation((x) => Promise.resolve(x));

      const result = await service.updateStatus(tenantId, orderId, 'designing');

      expect(result.status).toBe('designing');
      expect(orderRepository.save).toHaveBeenCalledWith(mockOrder);
    });

    it('debería lanzar ForbiddenException al actualizar estado si el usuario no pertenece a la orden', async () => {
      const tenantId = 'hacker_tenant';
      const orderId = 'order_123';
      const mockOrder = { id: orderId, tenantId: 'clinica_test', performerTenantId: 'lab_test', status: 'received' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(service.updateStatus(tenantId, orderId, 'designing')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addChatMessage', () => {
    it('debería agregar un mensaje de chat si el tenant es válido', async () => {
      const tenantId = 'clinica_test';
      const orderId = 'order_123';
      const mockOrder = { id: orderId, tenantId, performerTenantId: 'lab_test' };
      const dto: SendMessageDto = { textContent: 'Hola laboratorio' };
      
      const mockMessage = { id: 'msg_1', orderId, senderId: 'user_1', senderName: 'Dr. Test', textContent: dto.textContent };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockChatRepository.create.mockReturnValue(mockMessage);
      mockChatRepository.save.mockResolvedValue(mockMessage);

      const result = await service.addChatMessage(tenantId, orderId, 'user_1', 'Dr. Test', dto);

      expect(chatRepository.create).toHaveBeenCalledWith({
        orderId,
        senderId: 'user_1',
        senderName: 'Dr. Test',
        textContent: dto.textContent,
        attachmentMeta: undefined,
      });
      expect(result).toEqual(mockMessage);
    });

    it('debería lanzar ForbiddenException en chat si el tenant no pertenece al caso', async () => {
      const tenantId = 'hacker_tenant';
      const orderId = 'order_123';
      const mockOrder = { id: orderId, tenantId: 'clinica_test', performerTenantId: 'lab_test' };
      const dto: SendMessageDto = { textContent: 'Hola' };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.addChatMessage(tenantId, orderId, 'user_1', 'Dr. Test', dto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInsumos', () => {
    it('debería obtener los insumos del tenant ordenados por nombre', async () => {
      const tenantId = 'lab_test';
      const mockInsumos = [{ id: '1', name: 'Zirconio' }];
      mockInsumoRepository.find.mockResolvedValue(mockInsumos);

      const result = await service.getInsumos(tenantId);

      expect(insumoRepository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(mockInsumos);
    });
  });

  describe('createInsumo', () => {
    it('debería crear y guardar un nuevo insumo', async () => {
      const tenantId = 'lab_test';
      const dto: CreateInsumoDto = {
        name: 'Yeso',
        category: 'yeso',
        stock: 5,
        minStock: 2,
        unit: 'Kg',
      };
      const mockInsumo = { id: 'new_insumo_id', tenantId, ...dto };
      mockInsumoRepository.create.mockReturnValue(mockInsumo);
      mockInsumoRepository.save.mockResolvedValue(mockInsumo);

      const result = await service.createInsumo(tenantId, dto);

      expect(insumoRepository.create).toHaveBeenCalledWith({ tenantId, ...dto });
      expect(result).toEqual(mockInsumo);
    });
  });

  describe('updateStock', () => {
    it('debería actualizar el stock si el insumo existe y pertenece al tenant', async () => {
      const tenantId = 'lab_test';
      const insumoId = 'insumo_1';
      const mockInsumo = { id: insumoId, tenantId, stock: 2 };
      mockInsumoRepository.findOne.mockResolvedValue(mockInsumo);
      mockInsumoRepository.save.mockImplementation((x) => Promise.resolve(x));

      const result = await service.updateStock(tenantId, insumoId, 10);

      expect(result.stock).toBe(10);
      expect(insumoRepository.save).toHaveBeenCalledWith(mockInsumo);
    });

    it('debería lanzar ForbiddenException si el insumo no pertenece al tenant', async () => {
      const tenantId = 'hacker_tenant';
      const insumoId = 'insumo_1';
      const mockInsumo = { id: insumoId, tenantId: 'lab_test', stock: 2 };
      mockInsumoRepository.findOne.mockResolvedValue(mockInsumo);

      await expect(service.updateStock(tenantId, insumoId, 10)).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si el insumo no existe', async () => {
      mockInsumoRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStock('tenant', 'invalid_id', 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTrazabilidad', () => {
    it('debería actualizar los datos de trazabilidad correctamente', async () => {
      const tenantId = 'lab_test';
      const orderId = 'order_123';
      const mockOrder = { id: orderId, tenantId: 'clinica_test', performerTenantId: tenantId, conformidad: null };
      
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockImplementation((x) => Promise.resolve(x));

      const dto = {
        technicianName: 'Pedro Gómez',
        materialLot: 'LOT-55',
        materialBrand: 'Ivoclar',
        aditamentos: [{ type: 'Ti-Base', brand: '3i', lot: 'L-12' }],
      };

      const result = await service.updateTrazabilidad(tenantId, orderId, dto);

      expect(result.trazabilidad).toEqual(dto);
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar ForbiddenException si la conformidad ya está firmada', async () => {
      const tenantId = 'lab_test';
      const orderId = 'order_123';
      const mockOrder = {
        id: orderId,
        tenantId: 'clinica_test',
        performerTenantId: tenantId,
        conformidad: { isSigned: true },
      };
      
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const dto = { technicianName: 'Pedro Gómez' };

      await expect(service.updateTrazabilidad(tenantId, orderId, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('signConformidad', () => {
    it('debería firmar la conformidad, generar hash sha256 y cambiar estado a ready', async () => {
      const tenantId = 'lab_test';
      const orderId = 'order_123';
      const mockOrder = {
        id: orderId,
        tenantId: 'clinica_test',
        performerTenantId: tenantId,
        patientId: 'patient_77',
        dentalWork: { workType: 'corona' },
        trazabilidad: { technicianName: 'Pedro Gómez' },
        conformidad: null,
        status: 'processing',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockImplementation((x) => Promise.resolve(x));

      const dto = {
        signedBy: 'Protesista Juan - Mat: 8877',
        declaracionDoc: 'Declaración legal',
      };

      const result = await service.signConformidad(tenantId, orderId, dto);

      expect(result.conformidad.isSigned).toBe(true);
      expect(result.conformidad.signedBy).toBe(dto.signedBy);
      expect(result.conformidad.hash).toBeDefined();
      expect(result.status).toBe('ready');
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar ForbiddenException si ya está firmada', async () => {
      const tenantId = 'lab_test';
      const orderId = 'order_123';
      const mockOrder = {
        id: orderId,
        tenantId: 'clinica_test',
        performerTenantId: tenantId,
        conformidad: { isSigned: true },
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const dto = { signedBy: 'Test', declaracionDoc: 'Doc' };

      await expect(service.signConformidad(tenantId, orderId, dto)).rejects.toThrow(ForbiddenException);
    });
  });
});
