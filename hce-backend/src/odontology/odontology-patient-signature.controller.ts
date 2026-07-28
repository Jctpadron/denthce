import {
  Controller, Get, Post, Param, Body, UseGuards, Request, Res,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OdontologyPatientSignatureService, ActorCtx } from './odontology-patient-signature.service';

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB (una firma monocroma pesa mucho menos)

/**
 * Firma de conformidad del PACIENTE por prestación. Evidencia médico-legal (ePHI):
 * subida en memoria (para hash + magic-bytes), almacén PRIVADO y descarga SOLO por endpoint autenticado
 * con filtro tenant + auditoría. NO reusa la estática pública /uploads.
 */
@Controller('odontology')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OdontologyPatientSignatureController {
  constructor(private readonly service: OdontologyPatientSignatureService) {}

  private ctx(req: any): ActorCtx {
    return {
      tenantId: req.user.tenantId,
      actorId: req.user.sub || req.user.preferred_username,
      actorName: req.user.preferred_username,
      sourceIp: req.ip,
    };
  }

  /** Registrar la firma de una prestación (Procedure completado). */
  @Post('patient/:patientId/resource/:resourceId/signature')
  @Roles('medico', 'administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIGNATURE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'image/png') cb(null, true);
        else cb(new BadRequestException('La firma debe ser una imagen PNG.'), false);
      },
    }),
  )
  async register(
    @Param('patientId') patientId: string,
    @Param('resourceId') resourceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { encounterId?: string; deviceInfo?: string },
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió la imagen de la firma.');
    return this.service.register(this.ctx(req), patientId, resourceId, file, {
      encounterId: body?.encounterId,
      deviceInfo: body?.deviceInfo,
    });
  }

  /** Firma vigente de una prestación (para la Ficha). */
  @Get('patient/:patientId/resource/:resourceId/signature')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getByResource(
    @Param('patientId') patientId: string,
    @Param('resourceId') resourceId: string,
    @Request() req: any,
  ) {
    return this.service.getByResource(req.user.tenantId, patientId, resourceId);
  }

  /** Todas las firmas vigentes del paciente (batch para la Ficha, evita N+1). */
  @Get('patient/:patientId/signatures')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getAllByPatient(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.service.getAllByPatient(req.user.tenantId, patientId);
  }

  /** Firmas vigentes de una visita completa. */
  @Get('patient/:patientId/encounter/:encounterId/signatures')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getByEncounter(
    @Param('patientId') patientId: string,
    @Param('encounterId') encounterId: string,
    @Request() req: any,
  ) {
    return this.service.getByEncounter(req.user.tenantId, patientId, encounterId);
  }

  /** Descarga autenticada del PNG de la firma (ePHI). Auditada. */
  @Get('patient/:patientId/signature/:id/image')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getImage(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { stream, mimeType } = await this.service.getImage(this.ctx(req), patientId, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
  }
}
