import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega la columna documentNumber a users. Se usa como contraseña del ZIP
 * cifrado que contiene el Excel de reportes solicitados por el usuario.
 *
 * Nullable porque los usuarios existentes no tenían este dato — un admin
 * debe registrárselo antes de que puedan solicitar reportes.
 */
export class AddUserDocumentNumber1782980000000 implements MigrationInterface {
  name = 'AddUserDocumentNumber1782980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "documentNumber" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "documentNumber"`,
    );
  }
}
