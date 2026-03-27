-- =====================================================
-- SoulForms - Script de inicialización PostgreSQL
-- Ejecutar en pgAdmin (Query Tool) o psql
-- =====================================================

-- PASO 1: Crear la base de datos
-- Ejecutar esto conectado a la BD "postgres" (la default)
CREATE DATABASE soulformsdb;

-- =====================================================
-- PASO 2: Conectarse a soulformsdb y ejecutar lo siguiente
-- En pgAdmin: click derecho en soulformsdb > Query Tool
-- En psql: \c soulformsdb
-- =====================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id              UUID            DEFAULT uuid_generate_v4() PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password        VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'user'
                                    CHECK (role IN ('admin', 'coordinator', 'user')),
    "isActive"      BOOLEAN         NOT NULL DEFAULT TRUE,
    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por email (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- =====================================================
-- NOTA: TypeORM con synchronize:true también crea esta
-- tabla automáticamente al arrancar el backend.
-- Este script es de referencia y control manual.
-- =====================================================
