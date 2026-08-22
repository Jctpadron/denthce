import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { EvidenceStorageService } from './evidence-storage.service';

/**
 * El almacén local guarda los blobs bajo `process.cwd()/private-uploads`, que
 * NO es un volumen: se pierde con cada reconstrucción del contenedor, y en
 * Elastic Beanstalk el filesystem de la instancia es efímero. La fila de la
 * base, en cambio, sobrevive. La referencia huérfana no es un caso raro: es el
 * estado esperable.
 *
 * Antes, `getStream` devolvía igual un ReadStream sobre un archivo inexistente
 * y el ENOENT llegaba de forma asincrónica, cuando el controller ya había
 * hecho `pipe(res)`. Sin listener de 'error', eso **mataba el proceso**.
 */
describe('EvidenceStorageService', () => {
  const service = new EvidenceStorageService();
  const base = join(process.cwd(), 'private-uploads');
  const categoria = 'test-evidencia';
  const dir = join(base, categoria);

  afterEach(() => {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('getStream con backend local', () => {
    it('lanza NotFoundException si el blob no está, en vez de un stream que falla después', async () => {
      await expect(
        service.getStream('local', categoria, 'clinica-a', 'no-existe.png'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve el stream cuando el blob sí está', async () => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(join(dir, 'existe.png'), Buffer.from([1, 2, 3]));

      const stream = await service.getStream(
        'local',
        categoria,
        'clinica-a',
        'existe.png',
      );

      expect(stream).toBeDefined();
      const leido: Buffer = await new Promise((resolve, reject) => {
        const partes: Buffer[] = [];
        stream.on('data', (c: Buffer) => partes.push(c));
        stream.on('end', () => resolve(Buffer.concat(partes)));
        stream.on('error', reject);
      });
      expect(leido).toEqual(Buffer.from([1, 2, 3]));
    });

    it('el mensaje no filtra la ruta del sistema de archivos', async () => {
      await expect(
        service.getStream('local', categoria, 'clinica-a', 'no-existe.png'),
      ).rejects.toThrow(/no pudimos recuperar|no está disponible/i);

      await service
        .getStream('local', categoria, 'clinica-a', 'no-existe.png')
        .catch((e: Error) => {
          expect(e.message).not.toContain('private-uploads');
          expect(e.message).not.toContain(process.cwd());
        });
    });
  });
});
