import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega columnas de soft delete a users: `deletedAt` (timestamp) y
 * `deletedById` (id del admin que borró). Con estas columnas, DELETE
 * /users/:id ya no borra la fila — la marca con deletedAt para conservar
 * email/nombre/histórico de submissions. El login rechaza usuarios con
 * deletedAt != null.
 *
 * Idempotente: usa IF NOT EXISTS por si el ALTER se corrió con el script
 * scripts/add-user-soft-delete-columns.mjs antes de que existiera esta
 * migración (fix urgente cuando el 500 en login bloqueó a la usuaria).
 */
export class AddUserSoftDelete1789603200000 implements MigrationInterface {
  name = 'AddUserSoftDelete1789603200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedById" INTEGER NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
