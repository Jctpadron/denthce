import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { TenantConfigEntity } from './tenant-config.entity';
import { EvidenceStorageService } from '../odontology/evidence-storage.service';

/** Categoría dentro del almacén privado. Separa la firma del profesional de la evidencia de paciente. */
const CATEGORY = 'tenant-signatures';

/** Ruta del endpoint autenticado que sirve la firma. Es lo que se persiste en `signature_url`. */
export const SIGNATURE_ENDPOINT_PATH = '/api/tenant/signature';

/**
 * Whitelist de tipos + magic-bytes. No se confía en el Content-Type que declara el cliente:
 * un `.php` renombrado a `.png` pasaría el filtro de multer pero no el de magic-bytes.
 */
const MAGIC: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // "RIFF" (+ "WEBP" en el offset 8)
};

/**
 * Firma digital del PROFESIONAL (no la del paciente).
 *
 * Antes se escribía en `uploads/signatures/signature-<tenantId>.png` y se servía por
 * `express.static`, es decir: **sin autenticación y con nombre predecible**. Conocer un
 * tenantId alcanzaba para descargar la firma de un odontólogo, que es el insumo directo
 * de una suplantación. Ver AUD.8 en el handoff 2026-08-17.
 *
 * Ahora el blob va al almacén PRIVADO (S3 con SSE en prod, `private-uploads/` en local),
 * con clave aleatoria, y sólo se lee por endpoint autenticado y filtrado por tenant.
 */
@Injectable()
export class TenantSignatureService {
  constructor(
    @InjectRepository(TenantConfigEntity)
    private readonly repo: Repository<TenantConfigEntity>,
    private readonly storage: EvidenceStorageService,
  ) {}

  /** Valida el contenido real del archivo y devuelve su MIME confirmado. */
  private assertRealImage(file: Express.Multer.File): string {
    const mime = file.mimetype;
    const magic = MAGIC[mime];
    if (!magic) {
      throw new BadRequestException(
        'La firma debe ser una imagen PNG, JPG o WebP.',
      );
    }
    const head = Array.from(file.buffer.subarray(0, magic.length));
    if (!magic.every((b, i) => head[i] === b)) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con su tipo declarado.',
      );
    }
    return mime;
  }

  private extFor(mime: string): string {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    return 'png';
  }

  /**
   * Guarda (o reemplaza) la firma del profesional del tenant.
   * La clave es aleatoria a propósito: aunque el almacén ya es privado, un nombre
   * derivado del tenantId volvía a hacerla adivinable si mañana se expone por otra vía.
   */
  async save(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ signatureUrl: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió la imagen de la firma.');
    }
    const mime = this.assertRealImage(file);
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `sig-${Date.now()}-${crypto
      .randomBytes(8)
      .toString('hex')}.${this.extFor(mime)}`;

    await this.storage.put(CATEGORY, tenantId, storageKey, file.buffer, mime);

    // La fila puede no existir todavía (tenant recién creado).
    const existing = await this.repo.findOne({ where: { tenantId } });
    if (!existing) {
      await this.repo.save(this.repo.create({ tenantId }));
    }

    await this.repo.update(
      { tenantId },
      {
        signatureUrl: SIGNATURE_ENDPOINT_PATH,
        signatureStorageKey: storageKey,
        signatureStorageBackend: this.storage.backend(),
        signatureContentType: mime,
        signatureHash: hash,
      },
    );

    return { signatureUrl: SIGNATURE_ENDPOINT_PATH };
  }

  /**
   * Devuelve el stream de la firma del tenant indicado.
   * El tenantId SIEMPRE viene del JWT, nunca de un parámetro de la request:
   * no hay forma de pedir la firma de otra clínica.
   */
  async getStream(
    tenantId: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const row = await this.repo
      .createQueryBuilder('c')
      .addSelect([
        'c.signatureStorageKey',
        'c.signatureStorageBackend',
        'c.signatureContentType',
      ])
      .where('c.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!row?.signatureStorageKey) {
      throw new NotFoundException(
        'Este consultorio todavía no tiene una firma cargada.',
      );
    }

    const stream = await this.storage.getStream(
      row.signatureStorageBackend || 'local',
      CATEGORY,
      tenantId,
      row.signatureStorageKey,
    );
    return { stream, mimeType: row.signatureContentType || 'image/png' };
  }
}
