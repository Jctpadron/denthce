import { Response } from 'express';
import { Readable } from 'stream';
import { enviarBlob } from './enviar-blob.util';

/**
 * Un `stream.pipe(res)` sin manejo de 'error' es una excepción NO capturada:
 * en Node, un stream que emite 'error' sin listener **tumba el proceso**.
 *
 * Pasó de verdad: `GET /api/tenant/signature` mataba el backend cuando la fila
 * de la base apuntaba a un blob que ya no estaba en disco (ENOENT). Con
 * `restart: always` quedaba en ciclo de caída, y cualquier usuario autenticado
 * podía provocarlo a voluntad con un GET.
 */
describe('enviarBlob', () => {
  /** Response falsa que registra lo que el handler intenta hacer. */
  function resFalsa() {
    const estado = {
      status: 0,
      body: null as unknown,
      destruida: false,
      headersSent: false,
      piped: false,
    };
    // El tipo es explícito para que `status()`/`json()` puedan encadenarse
    // (el helper hace `res.status(404).json(...)`) sin que el retorno sea `any`.
    type ResEncadenable = {
      readonly headersSent: boolean;
      status(code: number): ResEncadenable;
      json(body: unknown): ResEncadenable;
      destroy(): void;
      write(): boolean;
      end(): undefined;
      on(): undefined;
      once(): undefined;
      emit(): boolean;
      removeListener(): undefined;
    };
    const res: ResEncadenable = {
      get headersSent() {
        return estado.headersSent;
      },
      status(code: number): ResEncadenable {
        estado.status = code;
        return res;
      },
      json(body: unknown): ResEncadenable {
        estado.body = body;
        return res;
      },
      destroy() {
        estado.destruida = true;
      },
      // lo que usa stream.pipe(res)
      write: () => true,
      end: () => undefined,
      on: () => undefined,
      once: () => undefined,
      emit: () => false,
      removeListener: () => undefined,
    };
    return { res: res as unknown as Response, estado };
  }

  it('un stream que falla NO propaga la excepción (no tumba el proceso)', () => {
    const stream = new Readable({ read() {} });
    const { res } = resFalsa();

    enviarBlob(stream, res, 'firma de prueba');

    // Emitir 'error' no debe lanzar: si nadie lo escuchara, el proceso moriría.
    expect(() => {
      stream.emit(
        'error',
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );
    }).not.toThrow();
  });

  it('responde 404 cuando el blob no está, en vez de caerse', () => {
    const stream = new Readable({ read() {} });
    const { res, estado } = resFalsa();

    enviarBlob(stream, res, 'firma del profesional');
    stream.emit(
      'error',
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    expect(estado.status).toBe(404);
    expect(JSON.stringify(estado.body)).toContain('404');
  });

  it('si ya se enviaron headers, corta la respuesta sin intentar un status nuevo', () => {
    const stream = new Readable({ read() {} });
    const { res, estado } = resFalsa();
    estado.headersSent = true;

    enviarBlob(stream, res, 'adjunto clínico');
    stream.emit('error', new Error('se cayó la red a mitad del stream'));

    // No se puede cambiar el status con la respuesta ya empezada: hay que cortar.
    expect(estado.destruida).toBe(true);
    expect(estado.status).toBe(0);
  });

  it('el camino feliz sigue haciendo pipe hacia la respuesta', () => {
    const stream = new Readable({ read() {} });
    const { res } = resFalsa();
    const pipe = jest.spyOn(stream, 'pipe');

    enviarBlob(stream, res, 'firma del paciente');

    expect(pipe).toHaveBeenCalledWith(res);
  });
});
