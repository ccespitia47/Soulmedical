import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla de auditoría de acciones administrativas.
 * Índices para acelerar las consultas más comunes:
 *  - listado cronológico descendente
 *  - filtrar por actor
 *  - buscar el historial de un target específico (ej: ¿qué le hicieron al user 42?)
 */
export class AddAdminActionsTable1782970000000 implements MigrationInterface {
  name = 'AddAdminActionsTable1782970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_actions" (
        "id" SERIAL PRIMARY KEY,
        "action" character varying(64) NOT NULL,
        "actorId" integer NOT NULL,
        "actorName" character varying(200) NOT NULL,
        "actorRole" character varying(32) NOT NULL,
        "targetType" character varying(32) NOT NULL,
        "targetId" character varying(64) NOT NULL,
        "targetName" character varying(300),
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_createdAt" ON "admin_actions" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_actor_createdAt" ON "admin_actions" ("actorId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_target" ON "admin_actions" ("targetType", "targetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_actions_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_actions_actor_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_actions_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_actions"`);
  }
}
