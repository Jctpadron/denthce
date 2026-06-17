import { Controller, Get, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = { status: 'ok' };
    } catch (err) {
      checks.database = { status: 'error', message: 'No se puede conectar a la base de datos' };
      checks.status = 'degraded';
      this.logger.error('Health check — database error', err);
    }

    const httpCode = checks.status === 'ok' ? 200 : 503;
    return { statusCode: httpCode, ...checks };
  }
}
