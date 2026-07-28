import {
  Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Request, Res,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClinicalAttachmentService } from './clinical-attachment.service';
import type { AttachmentOwnerType } from './clinical-attachment.entity';
import type { ActorCtx } from './odontology-patient-signature.service';

const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Adjuntos clínicos (RX/PDF) al presupuesto y a cada prestación. ePHI: subida en memoria (hash + magic-bytes),
 * almacén PRIVADO y descarga SOLO por endpoint autenticado con filtro tenant + auditoría. Soft-delete.
 */
@Controller('odontology')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClinicalAttachmentController {
  constructor(private readonly service: ClinicalAttachmentService) {}

  private ctx(req: any): ActorCtx {
    return {
      tenantId: req.user.tenantId,
      actorId: req.user.sub || req.user.preferred_username,
      actorName: req.user.preferred_username,
      sourceIp: req.ip,
    };
  }

  @Post('attachment')
  @Roles('medico', 'administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException(`Tipo no permitido: ${file.mimetype}. Se aceptan JPG, PNG y PDF.`), false);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { ownerType: AttachmentOwnerType; ownerId: string; kind?: string },
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    if (!body?.ownerType || !body?.ownerId) throw new BadRequestException('Falta ownerType/ownerId.');
    return this.service.upload(this.ctx(req), body.ownerType, body.ownerId, file, { kind: body.kind });
  }

  @Get('attachments')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async list(
    @Query('ownerType') ownerType: AttachmentOwnerType,
    @Query('ownerId') ownerId: string,
    @Request() req: any,
  ) {
    if (!ownerType || !ownerId) throw new BadRequestException('Falta ownerType/ownerId.');
    return this.service.list(req.user.tenantId, ownerType, ownerId);
  }

  @Get('attachment/:id/download')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async download(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const { stream, mimeType, filename } = await this.service.download(this.ctx(req), id);
    // PDF/documentos: attachment (evita ejecución de JS embebido); imágenes: inline con tipo fijado por servidor.
    const disposition = mimeType.startsWith('image/') ? 'inline' : 'attachment';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
    stream.pipe(res);
  }

  @Delete('attachment/:id')
  @Roles('medico', 'administrador')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.service.softDelete(this.ctx(req), id);
  }
}
