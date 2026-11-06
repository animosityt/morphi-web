-- =====================================================================
-- morphi web - esquema de base de datos (mysql / mariadb, xampp)
-- importar desde phpmyadmin (pestana "importar") o por consola:
--   mysql -u root < sql/01_schema.sql
-- =====================================================================
DROP DATABASE IF EXISTS morphi_web;
CREATE DATABASE morphi_web CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE morphi_web;

-- ---------------------------------------------------------------------
-- empleados: cada persona del equipo, con su cargo. define a que apartado
-- entra: mozo -> salon, cocinero -> cocina, cajero -> caja.
-- la contrasena se guarda como hash (password_hash de php), nunca en claro.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- mesas: el salon. el estado (libre/ocupada) no se guarda aca: se deduce
-- de si la mesa tiene un pedido 'abierto'. asi nunca puede quedar una
-- mesa "roja" sin consumo, ni un consumo en una mesa "verde".
-- ---------------------------------------------------------------------
CREATE TABLE mesas (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero     SMALLINT UNSIGNED NOT NULL,
  capacidad  TINYINT UNSIGNED NOT NULL,
  pos_x      TINYINT UNSIGNED NOT NULL,
  pos_y      TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mesas_numero (numero),
  CONSTRAINT ck_mesas_capacidad CHECK (capacidad > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- productos: la carta. va_a_cocina = 0 para bebidas (no pasan por cocina).
-- ---------------------------------------------------------------------
CREATE TABLE productos (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(80) NOT NULL,
  categoria    VARCHAR(40) NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  va_a_cocina  TINYINT(1) NOT NULL DEFAULT 1,
  activo       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT ck_productos_precio CHECK (precio >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- pedidos: una cuenta por mesa. estado: abierto -> cobrado.
-- mesa_abierta es una columna calculada: vale mesa_id mientras el pedido
-- esta abierto y null cuando se cobra. su indice unique garantiza que una
-- mesa no tenga dos pedidos abiertos a la vez.
-- ---------------------------------------------------------------------
CREATE TABLE pedidos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mesa_id        INT UNSIGNED NOT NULL,
  abierto_por    INT UNSIGNED NULL,
  estado         ENUM('abierto','cobrado') NOT NULL DEFAULT 'abierto',
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cobrado_en     DATETIME NULL,
  cobrado_por    INT UNSIGNED NULL,
  total_cobrado  DECIMAL(12,2) NULL,
  mesa_abierta   INT UNSIGNED GENERATED ALWAYS AS (IF(estado = 'abierto', mesa_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_una_cuenta_abierta_por_mesa (mesa_abierta),
  KEY idx_pedidos_mesa_estado (mesa_id, estado),
  CONSTRAINT fk_pedidos_mesa FOREIGN KEY (mesa_id) REFERENCES mesas (id),
  CONSTRAINT fk_pedidos_abierto_por FOREIGN KEY (abierto_por) REFERENCES empleados (id),
  CONSTRAINT fk_pedidos_cobrado_por FOREIGN KEY (cobrado_por) REFERENCES empleados (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- detalle_pedidos: cada linea cargada por el mozo.
-- precio_unitario es una copia del precio vigente al pedir: si cambia la
-- carta, las cuentas ya cargadas no se alteran.
-- ---------------------------------------------------------------------
CREATE TABLE detalle_pedidos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id        INT UNSIGNED NOT NULL,
  producto_id      INT UNSIGNED NOT NULL,
  cantidad         SMALLINT UNSIGNED NOT NULL,
  precio_unitario  DECIMAL(10,2) NOT NULL,
  cargado_por      INT UNSIGNED NULL,
  listo            TINYINT(1) NOT NULL DEFAULT 0,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  listo_en         DATETIME NULL,
  listo_por        INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_detalle_pedido (pedido_id),
  KEY idx_detalle_cola (listo, creado_en),
  CONSTRAINT fk_detalle_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos (id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT fk_detalle_cargado_por FOREIGN KEY (cargado_por) REFERENCES empleados (id),
  CONSTRAINT fk_detalle_listo_por   FOREIGN KEY (listo_por)   REFERENCES empleados (id),
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;
