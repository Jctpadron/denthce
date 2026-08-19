import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { TenantConfigEntity } from './tenant-config.entity';
import { EvidenceStorageService } from '../odontology/evidence-storage.service';
import {
  TenantSignatureService,
  SIGNATURE_ENDPOINT_PATH,
} from './tenant-signature.service';

/** Cabecera PNG real. Es lo que valida el chequeo de magic-bytes. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngFile(extra = 'contenido'): Express.Multer.File {
  return {
    buffer: Buffer.concat([PNG_MAGIC, Buffer.from(extra)]),
    mimetype: 'image/png',
    originalname: 'firma.png',
    size: 100,
  } as Express.Multer.File;
}

describe('TenantSignatureService (AUD.8)', () => {
  let service: TenantSignatureService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock<unknown, [unknown, Partial<TenantConfigEntity>]>;
    createQueryBuilder: jest.Mock;
  };
  let storage: {
    // Tipar las firmas evita que `.mock.calls` degrade a `any` al inspeccionarlas.
    put: jest.Mock<unknown, [string, string, string, Buffer, string]>;
    getStream: jest.Mock<unknown, [string, string, string, string]>;
    backend: jest.Mock;
  };
  let qb: {
    addSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    repo = {
      findOne: jest.fn().mockResolvedValue({ tenantId: 'clinica-a' }),
      save: jest.fn(),
      create: jest.fn((x: Partial<TenantConfigEntity>) => x),
      update: jest.fn<unknown, [unknown, Partial<TenantConfigEntity>]>(),
      createQueryBuilder: jest.fn(() => qb),
    };
    repo.update.mockResolvedValue({ affected: 1 });
    storage = {
      put: jest.fn<Promise<void>, [string, string, string, Buffer, string]>(),
      getStream: jest.fn<Promise<Readable>, [string, string, string, string]>(),
      backend: jest.fn().mockReturnValue('local'),
    };
    storage.put.mockResolvedValue(undefined);
    storage.getStream.mockResolvedValue(Readable.from(['x']));

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        TenantSignatureService,
        { provide: getRepositoryToken(TenantConfigEntity), useValue: repo },
        { provide: EvidenceStorageService, useValue: storage },
      ],
    }).compile();

    service = mod.get(TenantSignatureService);
  });

  describe('save', () => {
    it('guarda el blob en el almacén privado, nunca en la carpeta pública', async () => {
      await service.save('clinica-a', pngFile());

      expect(storage.put).toHaveBeenCalledTimes(1);
      const [category, tenantId, key, buffer, mime] = storage.put.mock.calls[0];
      expect(category).toBe('tenant-signatures');
      expect(tenantId).toBe('clinica-a');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(mime).toBe('image/png');
      // El almacén privado es el único destino: ninguna ruta pública en juego.
      expect(String(key)).not.toContain('uploads');
    });

    it('usa una clave ALEATORIA: no derivada del tenantId (era el nombre predecible de AUD.8)', async () => {
      await service.save('clinica-a', pngFile('uno'));
      await service.save('clinica-a', pngFile('dos'));

      const k1 = storage.put.mock.calls[0][2];
      const k2 = storage.put.mock.calls[1][2];

      expect(k1).not.toContain('clinica-a');
      expect(k2).not.toContain('clinica-a');
      expect(k1).not.toEqual(k2);
      expect(k1).toMatch(/^sig-\d+-[0-9a-f]{16}\.png$/);
    });

    it('persiste la ruta del endpoint autenticado, no una URL absoluta a localhost', async () => {
      const out = await service.save('clinica-a', pngFile());

      expect(out.signatureUrl).toBe(SIGNATURE_ENDPOINT_PATH);
      const patch = repo.update.mock.calls[0][1];
      expect(patch.signatureUrl).toBe(SIGNATURE_ENDPOINT_PATH);
      expect(patch.signatureUrl).not.toContain('localhost');
      expect(patch.signatureUrl).not.toContain('/uploads/');
    });

    it('guarda el SHA-256 real del contenido', async () => {
      const file = pngFile('firma-del-doctor');
      const esperado = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      await service.save('clinica-a', file);

      expect(repo.update.mock.calls[0][1].signatureHash).toBe(esperado);
    });

    it('rechaza un archivo cuyo contenido NO es la imagen que declara', async () => {
      const falso = {
        buffer: Buffer.from('<?php system($_GET["c"]); ?>'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(service.save('clinica-a', falso)).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rechaza un tipo fuera de la whitelist', async () => {
      const svg = {
        buffer: Buffer.from('<svg onload="alert(1)"/>'),
        mimetype: 'image/svg+xml',
      } as Express.Multer.File;

      await expect(service.save('clinica-a', svg)).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rechaza una subida vacía', async () => {
      await expect(
        service.save('clinica-a', undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la fila de config si el tenant todavía no la tiene', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.save('clinica-nueva', pngFile());

      expect(repo.save).toHaveBeenCalledWith({ tenantId: 'clinica-nueva' });
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('getStream', () => {
    it('filtra SIEMPRE por el tenant recibido (aislamiento multi-inquilino)', async () => {
      qb.getOne.mockResolvedValue({
        signatureStorageKey: 'sig-1.png',
        signatureStorageBackend: 'local',
        signatureContentType: 'image/png',
      });

      await service.getStream('clinica-a');

      expect(qb.where).toHaveBeenCalledWith('c.tenantId = :tenantId', {
        tenantId: 'clinica-a',
      });
      const [backend, category, tenantId] = storage.getStream.mock.calls[0];
      expect(backend).toBe('local');
      expect(category).toBe('tenant-signatures');
      expect(tenantId).toBe('clinica-a');
    });

    it('404 si el tenant no tiene firma cargada', async () => {
      qb.getOne.mockResolvedValue({ signatureStorageKey: null });

      await expect(service.getStream('clinica-a')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404 si el tenant no existe (no filtra la existencia de otras clínicas)', async () => {
      qb.getOne.mockResolvedValue(null);

      await expect(service.getStream('no-existe')).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.getStream).not.toHaveBeenCalled();
    });

    it('lee del backend con que se guardó la fila (convivencia local/s3)', async () => {
      qb.getOne.mockResolvedValue({
        signatureStorageKey: 'sig-9.png',
        signatureStorageBackend: 's3',
        signatureContentType: 'image/webp',
      });

      const { mimeType } = await service.getStream('clinica-b');

      expect(storage.getStream.mock.calls[0][0]).toBe('s3');
      expect(mimeType).toBe('image/webp');
    });
  });
});
