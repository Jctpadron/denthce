import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OdontologyService } from './odontology.service';
import { OdontologyPdfService } from './odontology-pdf.service';

// Tipos permitidos: imágenes (radiografías/fotos) y documentos.
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * API de la HISTORIA CLÍNICA ODONTOLÓGICA (módulo aislado).
 * Prefijo propio `/odontology`, separado del `/fhir/r4/Patient` de la HC original.
 * Aislamiento multi-inquilino Zero Trust: todo se filtra por req.user.tenantId.
 */
@Controller('odontology')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OdontologyController {
  constructor(
    private readonly odontologyService: OdontologyService,
    private readonly odontologyPdfService: OdontologyPdfService,
  ) {}

  @Post('patient/:patientId/resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async createResource(
    @Param('patientId') patientId: string,
    @Body() body: { resourceType: string; payload: any; encounterId?: string | null },
    @Request() req: any,
  ) {
    return this.odontologyService.saveResource(
      patientId,
      body.resourceType,
      body.payload,
      req.user.tenantId,
      body.encounterId ?? null,
    );
  }

  @Post('patients/enrich')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async enrichPatients(
    @Body() body: { patientIds: string[] },
    @Request() req: any,
  ) {
    return this.odontologyService.enrichPatients(body?.patientIds || [], req.user.tenantId);
  }

  @Post('patient/:patientId/upload')
  @Roles('medico', 'enfermero', 'administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadsDir = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `odo-${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}. Se aceptan imágenes (JPG, PNG, WebP) y documentos (PDF, DOC, DOCX).`), false);
      },
    }),
  )
  async uploadFile(
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @Body('category') category: string,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    return this.odontologyService.saveFile(
      patientId,
      { originalname: file.originalname, filename: file.filename, mimetype: file.mimetype, size: file.size },
      description,
      category,
      req.user.tenantId,
    );
  }

  @Get('patient/:patientId/resource')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador')
  async getResources(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    return this.odontologyService.getResourcesByPatient(patientId, req.user.tenantId);
  }

  @Get('patient/:patientId/report/pdf')
  @Roles('medico', 'enfermero', 'administrador')
  async getPdfReport(
    @Param('patientId') patientId: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    try {
      const patient = await this.odontologyService.getPatient(patientId, req.user.tenantId);
      const resources = await this.odontologyService.getResourcesByPatient(patientId, req.user.tenantId);
      const buffer = await this.odontologyPdfService.generatePdf(patient, resources);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hc_odontologica_${patient.dni}.pdf"`,
        'Content-Length': buffer.length,
      });
      
      res.end(buffer);
    } catch (err) {
      console.error('Error generando PDF de Odontología:', err);
      res.status(500).json({
        statusCode: 500,
        message: 'Error interno al generar el reporte PDF.',
        error: err.message,
      });
    }
  }

  @Patch('resource/:id/complete')
  @Roles('medico', 'enfermero', 'administrador')
  async completeResource(@Param('id') id: string, @Request() req: any) {
    return this.odontologyService.completeResource(id, req.user.tenantId);
  }

  @Delete('resource/:id')
  @Roles('medico', 'enfermero', 'administrador')
  async deleteResource(@Param('id') id: string, @Request() req: any) {
    return this.odontologyService.deleteResource(id, req.user.tenantId);
  }
}
