-- =====================================================================
-- morphi web - migracion para bases que ya estaban instaladas
-- (agrega empleados/cargos y registra que empleado hizo cada accion).
--
-- ejecutar una sola vez, con la base morphi_web ya creada.
-- no borra mesas, productos ni pedidos existentes.
-- si instalas desde cero con 01_schema.sql, este archivo no hace falta.
-- =====================================================================
USE morphi_web;

CREATE TABLE empleados (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(60) NOT NULL,
  usuario     VARCHAR(30) NOT NULL,
  clave_hash  VARCHAR(255) NOT NULL,
  cargo       ENUM('mozo','cocinero','cajero') NOT NULL,
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_empleados_usuario (usuario)
) ENGINE=InnoDB;

ALTER TABLE pedidos
  ADD COLUMN abierto_por INT UNSIGNED NULL,
  ADD COLUMN cobrado_por INT UNSIGNED NULL,
  ADD CONSTRAINT fk_pedidos_abierto_por FOREIGN KEY (abierto_por) REFERENCES empleados (id),
  ADD CONSTRAINT fk_pedidos_cobrado_por FOREIGN KEY (cobrado_por) REFERENCES empleados (id);

ALTER TABLE detalle_pedidos
  ADD COLUMN cargado_por INT UNSIGNED NULL,
  ADD COLUMN listo_por   INT UNSIGNED NULL,
  ADD CONSTRAINT fk_detalle_cargado_por FOREIGN KEY (cargado_por) REFERENCES empleados (id),
  ADD CONSTRAINT fk_detalle_listo_por   FOREIGN KEY (listo_por)   REFERENCES empleados (id);
