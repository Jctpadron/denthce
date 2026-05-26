import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Request,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantConfigService } from './tenant-config.service';
import * as fs from 'fs';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_SIZE = 1 * 1024 * 1024; // 1 MB

@Controller('api/tenant')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TenantConfigController {
  constructor(private readonly tenantService: TenantConfigService) {}

  /**
   * GET /api/tenant/config
   * Cualquier usuario autenticado puede leer la configuración de su tenant
   * (necesario para cargar el branding al iniciar la app)
   */
  @Get('config')
  @Roles('medico', 'enfermero', 'recepcionista', 'administrador', 'paciente')
  async getConfig(@Request() req: any) {
    return this.tenantService.getConfig(req.user.tenantId);
  }

  /**
   * PUT /api/tenant/config
   * Solo administrador puede guardar cambios de personalización
   */
  @Put('config')
  @Roles('administrador')
  async updateConfig(@Body() body: any, @Request() req: any) {
    // Sanitizar campos permitidos (evitar inyección de campos no permitidos)
    const allowed = [
      'clinicName', 'specialty', 'primaryColor', 'darkMode',
      'doctorName', 'doctorLicense', 'doctorTitle',
      'address', 'city', 'province', 'postalCode',
      'phone', 'email', 'cuit', 'healthInsurance',
      'scheduleJson',
    ];
    const dto: Record<string, any> = {};
    allowed.forEach(key => {
      if (body[key] !== undefined) dto[key] = body[key];
    });

    return this.tenantService.updateConfig(req.user.tenantId, dto);
  }

  /**
   * POST /api/tenant/logo
   * Upload de logo del consultorio (PNG/SVG/JPG, max 1MB)
   * Solo administrador
   */
  @Post('logo')
  @Roles('administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'logos');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const tenantId = req.user?.tenantId || 'unknown';
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `logo-${tenantId}${ext}`);
        },
      }),
      limits: { fileSize: MAX_LOGO_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Solo se permiten imágenes PNG, SVG, JPG o WebP.'), false);
        }
      },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    const logoUrl = `http://localhost:3000/uploads/logos/${file.filename}`;
    return this.tenantService.saveLogoUrl(req.user.tenantId, logoUrl);
  }

  /**
   * POST /api/tenant/signature
   * Upload de imagen de firma digital del doctor (PNG, max 500KB)
   * Solo administrador
   */
  @Post('signature')
  @Roles('administrador')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'signatures');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const tenantId = req.user?.tenantId || 'unknown';
          cb(null, `signature-${tenantId}.png`);
        },
      }),
      limits: { fileSize: 500 * 1024 }, // 500 KB
      fileFilter: (_req, file, cb) => {
        if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('La firma debe ser una imagen PNG, JPG o WebP.'), false);
        }
      },
    }),
  )
  async uploadSignature(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    const signatureUrl = `http://localhost:3000/uploads/signatures/${file.filename}`;
    return this.tenantService.saveSignatureUrl(req.user.tenantId, signatureUrl);
  }
}
