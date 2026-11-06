USE morphi_web;

ALTER TABLE empleados
  MODIFY COLUMN cargo ENUM('mozo','cocinero','cajero','encargado') NOT NULL;
