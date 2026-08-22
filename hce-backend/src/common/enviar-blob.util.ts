import { Logger } from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';

const logger = new Logger('EnviarBlob');

/**
 * Envía al cliente un stream de blob del almacén privado (firmas, adjuntos
 * clínicos) sin que un fallo de lectura tumbe el proceso.
 *
 * Por qué existe: `stream.pipe(res)` a secas es una excepción no capturada
 * esperando a ocurrir. En Node, un stream que emite 'error' **sin listener**
 * mata el proceso entero. Pasó de verdad en `GET /api/tenant/signature`: la
 * fila de la base apuntaba a un blob que ya no estaba en disco y el backend se
 * caía, con `restart: always` dejándolo en ciclo. Cualquier usuario
 * autenticado podía provocarlo a voluntad — una denegación de servicio con un
 * GET.
 *
 * Que la referencia quede huérfana no es raro: en Elastic Beanstalk el
 * filesystem de la instancia es efímero, así que el blob puede desaparecer
 * mientras la fila sobrevive en la base.
 *
 * Este helper cubre el fallo **a mitad de camino** (disco, red hacia S3), que
 * no se puede prever antes de empezar a leer. El caso "el blob directamente no
 * está" se detecta antes, en `EvidenceStorageService.getStream`, para poder
 * responder un 404 limpio.
 *
 * @param stream   blob del almacén privado
 * @param res      respuesta de Express, con sus headers ya seteados
 * @param contexto qué se estaba enviando, para el log (NUNCA datos de paciente)
 */
export function enviarBlob(
  stream: Readable,
  res: Response,
  contexto: string,
): void {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    logger.error(
      `No se pudo leer el blob (${contexto}): ${err.code || ''} ${err.message}`,
    );

    // Con la respuesta ya empezada no se puede cambiar el status: sólo cortar,
    // para que el cliente vea una descarga truncada en vez de un cuerpo mentiroso.
    if (res.headersSent) {
      res.destroy();
      return;
    }

    res.status(404).json({
      statusCode: 404,
      message:
        'No pudimos recuperar el archivo guardado. Es posible que haya que volver a cargarlo.',
      error: 'Not Found',
    });
  });

  stream.pipe(res);
}
