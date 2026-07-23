import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade la columna `permissions` a la tabla `users`. Es un simple-array de
 * TypeORM (varchar separado por comas), default vacío. Los permisos extra
 * que se otorguen por usuario se persisten aquí.
 */
export class AddUserPermissions1782950400000 implements MigrationInterface {
  name = 'AddUserPermissions1782950400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" character varying NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "permissions"`);
  }
}
