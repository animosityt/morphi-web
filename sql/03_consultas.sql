-- =====================================================================
-- morphi web - consultas del sistema (las mismas que usa la api en php)
-- los signos ? son parametros: para probar en phpmyadmin reemplazalos.
-- =====================================================================
USE morphi_web;

-- 1) mapa de mesas (api/mesas.php)
SELECT m.id, m.numero, m.capacidad, m.pos_x, m.pos_y,
       p.id AS pedido_id,
       DATE_FORMAT(p.creado_en, '%H:%i') AS abierto_a_las,
       (p.id IS NOT NULL) AS ocupada
FROM mesas m
LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto'
ORDER BY m.numero;

-- 2) resumen del turno (api/mesas.php)
SELECT COUNT(*)                                AS total_mesas,
       COALESCE(SUM(p.id IS NOT NULL), 0)      AS ocupadas,
       COALESCE(SUM(p.id IS NULL), 0)          AS libres,
       COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN m.capacidad END), 0) AS lugares_en_uso
FROM mesas m
LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto';

-- 3) carta (api/productos.php)
SELECT id, nombre, categoria, precio FROM productos WHERE activo = 1 ORDER BY id;

-- 4) cargar comanda, dentro de una transaccion (api/comandas.php)
--    a) select id from pedidos where mesa_id = ? and estado = 'abierto' for update;
--    b) si no existe:  insert into pedidos (mesa_id) values (?);
--    c) el precio sale de la base, nunca del navegador:
--       insert into detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
--       values (?, ?, ?, ?);   -- precio leido antes con select precio from productos

-- 5) cola de cocina, del mas viejo al mas nuevo (api/cocina.php)
SELECT d.id AS detalle_id, m.numero AS mesa, pr.nombre, pr.categoria, d.cantidad,
       DATE_FORMAT(d.creado_en, '%H:%i') AS hora
FROM detalle_pedidos d
JOIN pedidos   p  ON p.id  = d.pedido_id AND p.estado = 'abierto'
JOIN mesas     m  ON m.id  = p.mesa_id
JOIN productos pr ON pr.id = d.producto_id
WHERE d.listo = 0 AND pr.va_a_cocina = 1
ORDER BY d.creado_en ASC, d.id ASC;

-- 6) boton "listo" (api/cocina.php)
UPDATE detalle_pedidos SET listo = 1, listo_en = NOW() WHERE id = ? AND listo = 0;

-- 7) cuenta de una mesa: subtotal por item con sum (api/caja.php)
SELECT pr.nombre,
       SUM(d.cantidad)                     AS cantidad,
       d.precio_unitario,
       SUM(d.cantidad * d.precio_unitario) AS subtotal
FROM detalle_pedidos d
JOIN productos pr ON pr.id = d.producto_id
WHERE d.pedido_id = ?
GROUP BY d.producto_id, pr.nombre, d.precio_unitario
ORDER BY d.producto_id;

-- 8) total exacto a cobrar (api/caja.php)
SELECT SUM(cantidad * precio_unitario) AS total
FROM detalle_pedidos
WHERE pedido_id = ?;

-- 9) cobrar: cierra el pedido y libera la mesa (api/caja.php)
UPDATE pedidos
SET estado = 'cobrado',
    cobrado_en = NOW(),
    total_cobrado = (SELECT SUM(cantidad * precio_unitario)
                     FROM detalle_pedidos WHERE pedido_id = ?)
WHERE id = ? AND estado = 'abierto';

-- ---------------------------------------------------------------------
-- extras para el dueno / testing
-- ---------------------------------------------------------------------
-- recaudacion del dia
SELECT COUNT(*) AS cuentas_cobradas, COALESCE(SUM(total_cobrado), 0) AS recaudado
FROM pedidos
WHERE estado = 'cobrado' AND DATE(cobrado_en) = CURDATE();

-- platos mas pedidos
SELECT pr.nombre, SUM(d.cantidad) AS unidades
FROM detalle_pedidos d JOIN productos pr ON pr.id = d.producto_id
GROUP BY pr.id, pr.nombre
ORDER BY unidades DESC;

-- chequeo de integirdad: no debe devolver filas (pedidos abiertos sin items)
SELECT p.id FROM pedidos p
LEFT JOIN detalle_pedidos d ON d.pedido_id = p.id
WHERE p.estado = 'abierto' AND d.id IS NULL;
