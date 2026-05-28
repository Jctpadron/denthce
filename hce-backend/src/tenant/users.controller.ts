import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KeycloakAdminService } from './keycloak-admin.service';

@Controller('api/tenant/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly keycloakService: KeycloakAdminService) {}

  /**
   * GET /api/tenant/users
   * Lista todo el personal (secretarias, enfermeros) asignados al consultorio del doctor actual
   */
  @Get()
  @Roles('administrador', 'medico')
  async listUsers(@Request() req: any) {
    return this.keycloakService.listUsersByTenant(req.user.tenantId);
  }

  /**
   * POST /api/tenant/users
   * Crea una nueva cuenta de personal (secretaria o enfermero) y la asocia al consultorio del doctor actual
   */
  @Post()
  @Roles('administrador', 'medico')
  async createUser(@Body() body: any, @Request() req: any) {
    const { username, email, firstName, lastName, role } = body;

    // Validaciones básicas
    if (!username || !email || !firstName || !lastName || !role) {
      throw new BadRequestException('Todos los campos son obligatorios.');
    }

    if (role !== 'recepcionista' && role !== 'enfermero') {
      throw new BadRequestException('El rol asignado debe ser recepcionista o enfermero.');
    }

    // El tenantId del nuevo usuario será el del doctor actual
    const tenantId = req.user.tenantId;

    return this.keycloakService.createUser({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role,
      tenantId: tenantId,
    });
  }
}
