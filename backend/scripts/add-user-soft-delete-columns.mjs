// Fix urgente: agrega las columnas `deletedAt` y `deletedById` a la tabla
// `users`. Estas se añadieron al entity User (soft delete de usuarios) pero
// como `synchronize: false` en TypeORM nunca se crearon en Postgres → el
// login fallaba con 500 porque el SELECT las incluía y no existían.
//
// Idempotente: usa IF NOT EXISTS. Se puede correr N veces sin efecto.
//
// Uso:  node scripts/add-user-soft-delete-columns.mjs

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'soulformsdb',
});

await client.connect();

const sql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL,
    ADD COLUMN IF NOT EXISTS "deletedById" integer NULL;
`;

console.log('Aplicando ALTER TABLE users…');
await client.query(sql);
console.log('OK.');

const { rows } = await client.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name IN ('deletedAt', 'deletedById');
`);
console.log('Columnas verificadas:');
console.table(rows);

await client.end();
