import { Test, TestingModule } from '@nestjs/testing';
import { ProtesisController } from './protesis.controller';
import { ProtesisService, CreateOrderDto, SendMessageDto, CreateInsumoDto } from './protesis.service';

describe('ProtesisController', () => {
  let controller: ProtesisController;
  let service: ProtesisService;

  const mockProtesisService = {
    getOrders: jest.fn(),
    getOrderDetails: jest.fn(),
    createOrder: jest.fn(),
    updateStatus: jest.fn(),
    addChatMessage: jest.fn(),
    getDashboardStats: jest.fn(),
    getInsumos: jest.fn(),
    createInsumo: jest.fn(),
    updateStock: jest.fn(),
    updateTrazabilidad: jest.fn(),
    signConformidad: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProtesisController],
      providers: [
        {
          provide: ProtesisService,
          useValue: mockProtesisService,
        },
      ],
    }).compile();

    controller = module.get<ProtesisController>(ProtesisController);
    service = module.get<ProtesisService>(ProtesisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrders', () => {
    it('debería invocar getOrders con tipo clinica si el usuario no tiene roles de laboratorio', async () => {
      const mockReq = {
        user: {
          tenantId: 'clinica_test',
          roles: ['medico'],
        },
      };
      mockProtesisService.getOrders.mockResolvedValue([]);

      await controller.getOrders(mockReq);

      expect(service.getOrders).toHaveBeenCalledWith('clinica_test', 'clinica');
    });

    it('debería invocar getOrders con tipo laboratorio si el usuario tiene rol laboratorio-operador', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
          roles: ['laboratorio-operador'],
        },
      };
      mockProtesisService.getOrders.mockResolvedValue([]);

      await controller.getOrders(mockReq);

      expect(service.getOrders).toHaveBeenCalledWith('lab_test', 'laboratorio');
    });
  });

  describe('getOrderDetails', () => {
    it('debería invocar getOrderDetails con el tenantId del usuario y el ID de la orden', async () => {
      const mockReq = {
        user: {
          tenantId: 'clinica_test',
        },
      };
      mockProtesisService.getOrderDetails.mockResolvedValue({});

      await controller.getOrderDetails('order_123', mockReq);

      expect(service.getOrderDetails).toHaveBeenCalledWith('clinica_test', 'order_123');
    });
  });

  describe('createOrder', () => {
    it('debería invocar createOrder con el tenantId de la clínica y el DTO', async () => {
      const mockReq = {
        user: {
          tenantId: 'clinica_test',
        },
      };
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
      mockProtesisService.createOrder.mockResolvedValue({});

      await controller.createOrder(dto, mockReq);

      expect(service.createOrder).toHaveBeenCalledWith('clinica_test', dto);
    });
  });

  describe('updateStatus', () => {
    it('debería invocar updateStatus con el tenantId del usuario, el ID de la orden y el nuevo estado', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
        },
      };
      mockProtesisService.updateStatus.mockResolvedValue({});

      await controller.updateStatus('order_123', 'designing', mockReq);

      expect(service.updateStatus).toHaveBeenCalledWith('lab_test', 'order_123', 'designing');
    });
  });

  describe('addChatMessage', () => {
    it('debería invocar addChatMessage con el sub, name y payload del chat', async () => {
      const mockReq = {
        user: {
          tenantId: 'clinica_test',
          sub: 'user_keycloak_123',
          name: 'Dr. Julio',
        },
      };
      const dto: SendMessageDto = { textContent: 'Mensaje' };
      mockProtesisService.addChatMessage.mockResolvedValue({});

      await controller.addChatMessage('order_123', dto, mockReq);

      expect(service.addChatMessage).toHaveBeenCalledWith(
        'clinica_test',
        'order_123',
        'user_keycloak_123',
        'Dr. Julio',
        dto,
      );
    });
  });

  describe('getDashboardStats', () => {
    it('debería invocar getDashboardStats con el tenantId del usuario', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
        },
      };
      mockProtesisService.getDashboardStats.mockResolvedValue({});

      await controller.getDashboardStats(mockReq);

      expect(service.getDashboardStats).toHaveBeenCalledWith('lab_test');
    });
  });

  describe('getInsumos', () => {
    it('debería invocar getInsumos con el tenantId del usuario', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
        },
      };
      mockProtesisService.getInsumos.mockResolvedValue([]);

      await controller.getInsumos(mockReq);

      expect(service.getInsumos).toHaveBeenCalledWith('lab_test');
    });
  });

  describe('createInsumo', () => {
    it('debería invocar createInsumo con el tenantId del usuario y el DTO', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
        },
      };
      const dto: CreateInsumoDto = {
        name: 'Resina 3D',
        category: 'resina',
        stock: 4,
        minStock: 2,
        unit: 'Liters',
      };
      mockProtesisService.createInsumo.mockResolvedValue({});

      await controller.createInsumo(dto, mockReq);

      expect(service.createInsumo).toHaveBeenCalledWith('lab_test', dto);
    });
  });

  describe('updateStock', () => {
    it('debería invocar updateStock con el tenantId, id del insumo y el stock', async () => {
      const mockReq = {
        user: {
          tenantId: 'lab_test',
        },
      };
      mockProtesisService.updateStock.mockResolvedValue({});

      await controller.updateStock('insumo_1', 12, mockReq);

      expect(service.updateStock).toHaveBeenCalledWith('lab_test', 'insumo_1', 12);
    });
  });

  describe('updateTrazabilidad', () => {
    it('debería invocar updateTrazabilidad con tenantId, id y dto', async () => {
      const mockReq = { user: { tenantId: 'lab_test' } };
      const dto = { technicianName: 'Pedro' };
      mockProtesisService.updateTrazabilidad.mockResolvedValue({});

      await controller.updateTrazabilidad('order_123', dto, mockReq);

      expect(service.updateTrazabilidad).toHaveBeenCalledWith('lab_test', 'order_123', dto);
    });
  });

  describe('signConformidad', () => {
    it('debería invocar signConformidad con tenantId, id y dto', async () => {
      const mockReq = { user: { tenantId: 'lab_test' } };
      const dto = { signedBy: 'Protesista', declaracionDoc: 'Doc' };
      mockProtesisService.signConformidad.mockResolvedValue({});

      await controller.signConformidad('order_123', dto, mockReq);

      expect(service.signConformidad).toHaveBeenCalledWith('lab_test', 'order_123', dto);
    });
  });
});
