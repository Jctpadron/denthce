import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SisaService } from './sisa.service';

/**
 * SisaController — Tarea 2.5
 * Expone la verificación de padrón SISA a través del backend (proxy seguro).
 * El frontend nunca llama a SISA directamente — siempre pasa por aquí con JWT.
 */
@Controller('api/sisa')
@UseGuards(AuthGuard('jwt'))
export class SisaController {
  constructor(private readonly sisaService: SisaService) {}

  /**
   * GET /api/sisa/verificar?dni=12345678&gender=male
   * Verifica un paciente por DNI contra el padrón SISA.
   */
  @Get('verificar')
  async verificar(
    @Query('dni') dni: string,
    @Query('gender') gender?: string,
  ) {
    if (!dni || !/^\d{6,10}$/.test(dni.trim())) {
      throw new BadRequestException('DNI inválido. Debe contener entre 6 y 10 dígitos numéricos.');
    }
    return this.sisaService.verificarPorDni(dni.trim(), gender);
  }
}
