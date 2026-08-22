import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Almacenamiento de blobs de EVIDENCIA CLÍNICA (firmas PNG + adjuntos RX/PDF), agnóstico del backend.
 * - Si `S3_EVIDENCE_BUCKET` está seteado → S3 privado (durable, cifrado en reposo SSE-S3).
 *   Las credenciales las toma el rol IAM de la instancia (EB) — NUNCA claves en el código.
 * - Si NO está seteado (dev/local) → disco local `process.cwd()/private-uploads/<category>`.
 * La fila persiste `storage_backend` para rutear la lectura correctamente (convivencia local/s3).
 * El almacén es PRIVADO: nunca se sirve por estática pública; la descarga va por endpoint autenticado.
 */
@Injectable()
export class EvidenceStorageService {
  private readonly bucket = process.env.S3_EVIDENCE_BUCKET;
  private readonly useS3 = !!process.env.S3_EVIDENCE_BUCKET;
  private readonly region = process.env.AWS_REGION || 'us-east-1';
  private readonly localBase = join(process.cwd(), 'private-uploads');
  private s3Client: S3Client | null = null;

  /** Backend efectivo según config. Se guarda en la fila para saber de dónde leer después. */
  backend(): 'local' | 's3' {
    return this.useS3 ? 's3' : 'local';
  }

  private client(): S3Client {
    if (!this.s3Client) this.s3Client = new S3Client({ region: this.region });
    return this.s3Client;
  }

  private s3Key(category: string, tenantId: string, key: string): string {
    return `clinical-evidence/${tenantId}/${category}/${key}`;
  }

  /** Guarda el blob. `category` = 'signatures' | 'attachments'. */
  async put(
    category: string,
    tenantId: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.useS3) {
      await this.client().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.s3Key(category, tenantId, key),
          Body: buffer,
          ContentType: contentType,
          ServerSideEncryption: 'AES256',
        }),
      );
    } else {
      const dir = join(this.localBase, category);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(join(dir, key), buffer);
    }
  }

  /** Devuelve un stream legible del blob, ruteando según el backend con que se guardó la fila. */
  async getStream(
    backend: string,
    category: string,
    tenantId: string,
    key: string,
  ): Promise<Readable> {
    if (backend === 's3') {
      const r = await this.client().send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.s3Key(category, tenantId, key),
        }),
      );
      return r.Body as Readable;
    }
    // Verificar ANTES de crear el stream. Si el archivo no está,
    // `createReadStream` no falla acá: emite 'error' de forma asincrónica, y
    // para entonces el controller ya hizo pipe(res). Un stream que emite
    // 'error' sin listener mata el proceso entero (pasó con la firma del
    // profesional: la fila apuntaba a un blob que ya no existía).
    //
    // Que la referencia quede huérfana es esperable, no excepcional:
    // `private-uploads/` no es un volumen y el filesystem de EB es efímero.
    const ruta = join(this.localBase, category, key);
    if (!fs.existsSync(ruta)) {
      // El mensaje no menciona la ruta: no se filtra la estructura del disco.
      throw new NotFoundException(
        'No pudimos recuperar el archivo guardado. Es posible que haya que volver a cargarlo.',
      );
    }
    return createReadStream(ruta);
  }
}
