import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../../generated/prisma/client';
import {
  IAM_POSTGRES_DATABASE,
  IAM_POSTGRES_SCHEMA,
} from './iam-postgres.constants';

type DatabaseConnectionProbe = {
  database: string;
  schema: string;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString =
      configService.getOrThrow<string>('iam.databaseUrl');
    const pool = new Pool({
      connectionString,
      max: 10,
      options: `-c search_path=${IAM_POSTGRES_SCHEMA}`,
    });

    super({
      adapter: new PrismaPg(pool, {
        schema: IAM_POSTGRES_SCHEMA,
      }),
    });

    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.assertIamSchemaConnection();
    } catch {
      this.logger.error('IAM Prisma connection failed');
      throw new Error('IAM Prisma connection failed');
    }

    this.logger.log(
      `IAM PostgreSQL connected (database=${IAM_POSTGRES_DATABASE}, schema=${IAM_POSTGRES_SCHEMA})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } finally {
      await this.pool.end();
      this.logger.log('IAM Prisma disconnected');
    }
  }

  private async assertIamSchemaConnection(): Promise<void> {
    const rows = await this.$queryRaw<DatabaseConnectionProbe[]>`
      SELECT current_database()::text AS database, current_schema()::text AS schema
    `;
    const probe = rows[0];

    if (
      probe?.database !== IAM_POSTGRES_DATABASE ||
      probe.schema !== IAM_POSTGRES_SCHEMA
    ) {
      throw new Error(
        `IAM Prisma must use database "${IAM_POSTGRES_DATABASE}" and schema "${IAM_POSTGRES_SCHEMA}"`,
      );
    }
  }
}
