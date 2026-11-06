-- =====================================================================
-- MORPHI WEB - MIGRACIÓN: agrega el cargo 'encargado' (ve los tres apartados)
-- Ejecutar UNA vez en bases ya instaladas. No toca los datos existentes.
-- Si instalás desde cero con 01_schema.sql, no hace falta.
-- =====================================================================
USE morphi_web;

ALTER TABLE empleados
  MODIFY COLUMN cargo ENUM('mozo','cocinero','cajero','encargado') NOT NULL;
