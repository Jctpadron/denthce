import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Request,
  Body,
  BadRequestException,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileUploadService } from './file-upload.service';
import * as fs from 'fs';

// Tipos de archivo permitidos
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

@Controller('fhir/r4/Patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post(':patientId/upload')
  @Roles('medico', 'enfermero', 'administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadsDir = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `doc-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Tipo de archivo no permitido: ${file.mimetype}. Se aceptan imágenes (JPG, PNG, WebP) y documentos (PDF, DOC, DOCX).`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }

    return this.fileUploadService.saveFileReference(
      patientId,
      {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      },
      description,
      req.user.tenantId,
    );
  }

  @Delete(':patientId/upload/:filename')
  @Roles('medico', 'administrador')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('filename') filename: string,
    @Request() _req: any,
  ) {
    // Sanitizar para evitar path traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filePath = join(process.cwd(), 'uploads', safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { message: 'Archivo eliminado del servidor.' };
  }
}
