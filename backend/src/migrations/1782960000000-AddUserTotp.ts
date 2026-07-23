import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTotp1782960000000 implements MigrationInterface {
  name = 'AddUserTotp1782960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "totpSecret" character varying(64),
      ADD COLUMN IF NOT EXISTS "totpEnabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "totpSecret",
      DROP COLUMN IF EXISTS "totpEnabled"
    `);
  }
}