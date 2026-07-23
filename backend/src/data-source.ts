import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './users/user.entity';
import { AdminAction } from './admin-audit/admin-action.entity';

/**
 * Opciones del DataSource compartidas entre la app NestJS y la CLI de TypeORM.
 * Usar el mismo objeto evita drift entre el schema "vivo" y el de las migraciones.
 *
 * - synchronize: false en todos los entornos. Cambios al schema → migración explícita.
 * - migrationsRun: false. El operador decide cuándo correr `migration:run`.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'soulformsdb',
  entities: [User, AdminAction],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
};

/** DataSource usado por la CLI de TypeORM (migration:generate, migration:run, etc.). */
export const AppDataSource = new DataSource(dataSourceOptions);
