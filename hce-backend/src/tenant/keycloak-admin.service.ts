import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
  private readonly realm = 'hce-realm';

  /**
   * Obtiene un token de acceso del administrador de Keycloak
   */
  private async getAdminToken(): Promise<string> {
    try {
      // Intentar primero con las credenciales de administrador de master (password grant)
      // que siempre funciona de forma robusta por defecto en nuestro docker-compose.
      const url = `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', 'admin-cli');
      params.append('username', 'admin');
      params.append('password', 'admin_secure_password_2026');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        // Si falla, intentamos con Client Credentials en hce-realm como fallback
        this.logger.warn('Fallo autenticación password de master, intentando con client_credentials...');
        return await this.getClientCredentialsToken();
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      this.logger.error('Error al obtener token de administrador', error);
      throw new HttpException(
        'Error de comunicación con el servidor de identidad.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getClientCredentialsToken(): Promise<string> {
    const url = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', 'hce-backend');
    params.append('client_secret', 'hce_backend_super_secret_key_2026');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Keycloak token request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Crea un usuario en Keycloak y le asigna el tenantId y el rol clínico.
   */
  async createUser(dto: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    /** Rol clínico a asignar. El SuperAdmin lo usa con 'administrador' al provisionar una clínica. */
    role: 'recepcionista' | 'enfermero' | 'administrador' | 'medico';
    tenantId: string;
  }): Promise<any> {
    const token = await this.getAdminToken();

    // 1. Crear el usuario
    const createUserUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/users`;
    const userPayload = {
      username: dto.username,
      enabled: true,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      credentials: [
        {
          type: 'password',
          // Generamos una contraseña por defecto basada en el username o fija para pruebas
          value: `${dto.username}_pass_2026`,
          temporary: false,
        },
      ],
      attributes: {
        tenant_id: [dto.tenantId],
      },
    };

    const createResponse = await fetch(createUserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userPayload),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      this.logger.error(`Error al crear usuario en Keycloak: ${errText}`);
      let errMsg = 'No se pudo crear el usuario en el servidor de identidad.';
      if (createResponse.status === 409) {
        errMsg = 'El nombre de usuario o email ya se encuentra registrado.';
      }
      throw new HttpException(errMsg, createResponse.status);
    }

    // 2. Obtener el ID del usuario creado a partir del header Location
    const locationHeader = createResponse.headers.get('Location');
    if (!locationHeader) {
      throw new HttpException(
        'No se recibió la ubicación del usuario creado desde Keycloak.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const userId = locationHeader.split('/').pop();

    // 3. Buscar la representación del Rol en Keycloak
    const getRoleUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/roles/${dto.role}`;
    const roleResponse = await fetch(getRoleUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!roleResponse.ok) {
      this.logger.error(`No se encontró el rol ${dto.role} en Keycloak.`);
      throw new HttpException(
        `Rol ${dto.role} no configurado en el servidor de identidad.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const roleData = await roleResponse.json();

    // 4. Asignar el rol al usuario
    const assignRoleUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`;
    const assignResponse = await fetch(assignRoleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([roleData]),
    });

    if (!assignResponse.ok) {
      this.logger.error('Error al mapear el rol al usuario.');
      throw new HttpException(
        'Usuario creado pero no se pudo asignar el rol correspondiente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      id: userId,
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      defaultPassword: `${dto.username}_pass_2026`,
    };
  }

  /**
   * Obtiene la lista de usuarios pertenecientes a un tenant.
   */
  async listUsersByTenant(tenantId: string): Promise<any[]> {
    const token = await this.getAdminToken();

    // Keycloak permite filtrar por atributos de usuario usando query params en search o q
    // Para Keycloak >= 22, q es más específico: q=tenant_id:value
    const url = `${this.keycloakUrl}/admin/realms/${this.realm}/users?q=tenant_id:${tenantId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      this.logger.error('Error al listar usuarios de Keycloak por tenantId.');
      throw new HttpException(
        'No se pudo obtener el listado de personal.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const users = await response.json();

    // Mapear los usuarios a un formato limpio
    const mappedUsers: any[] = [];
    for (const u of users) {
      // Obtener roles de cada usuario
      const rolesUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/users/${u.id}/role-mappings/realm`;
      const rolesRes = await fetch(rolesUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let role = 'desconocido';
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        const clinicalRoleObj = rolesData.find((r: any) =>
          ['medico', 'enfermero', 'recepcionista', 'administrador', 'paciente'].includes(r.name),
        );
        if (clinicalRoleObj) {
          role = clinicalRoleObj.name;
        }
      }

      mappedUsers.push({
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        enabled: u.enabled,
        role: role,
      });
    }

    return mappedUsers;
  }
}
