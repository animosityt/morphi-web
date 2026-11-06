USE morphi_web;

SELECT m.id, m.numero, m.capacidad, m.pos_x, m.pos_y,
       p.id AS pedido_id,
       DATE_FORMAT(p.creado_en, '%H:%i') AS abierto_a_las,
       (p.id IS NOT NULL) AS ocupada
FROM mesas m
LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto'
ORDER BY m.numero;

SELECT COUNT(*)                                AS total_mesas,
       COALESCE(SUM(p.id IS NOT NULL), 0)      AS ocupadas,
       COALESCE(SUM(p.id IS NULL), 0)          AS libres,
       COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN m.capacidad END), 0) AS lugares_en_uso
FROM mesas m
LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto';

SELECT id, nombre, categoria, precio FROM productos WHERE activo = 1 ORDER BY id;

SELECT d.id AS detalle_id, m.numero AS mesa, pr.nombre, pr.categoria, d.cantidad,
       DATE_FORMAT(d.creado_en, '%H:%i') AS hora
FROM detalle_pedidos d
JOIN pedidos   p  ON p.id  = d.pedido_id AND p.estado = 'abierto'
JOIN mesas     m  ON m.id  = p.mesa_id
JOIN productos pr ON pr.id = d.producto_id
WHERE d.listo = 0 AND pr.va_a_cocina = 1
ORDER BY d.creado_en ASC, d.id ASC;

UPDATE detalle_pedidos SET listo = 1, listo_en = NOW() WHERE id = ? AND listo = 0;

SELECT pr.nombre,
       SUM(d.cantidad)                     AS cantidad,
       d.precio_unitario,
       SUM(d.cantidad * d.precio_unitario) AS subtotal
FROM detalle_pedidos d
JOIN productos pr ON pr.id = d.producto_id
WHERE d.pedido_id = ?
GROUP BY d.producto_id, pr.nombre, d.precio_unitario
ORDER BY d.producto_id;

SELECT SUM(cantidad * precio_unitario) AS total
FROM detalle_pedidos
WHERE pedido_id = ?;

UPDATE pedidos
SET estado = 'cobrado',
    cobrado_en = NOW(),
    total_cobrado = (SELECT SUM(cantidad * precio_unitario)
                     FROM detalle_pedidos WHERE pedido_id = ?)
WHERE id = ? AND estado = 'abierto';

SELECT COUNT(*) AS cuentas_cobradas, COALESCE(SUM(total_cobrado), 0) AS recaudado
FROM pedidos
WHERE estado = 'cobrado' AND DATE(cobrado_en) = CURDATE();

SELECT pr.nombre, SUM(d.cantidad) AS unidades
FROM detalle_pedidos d JOIN productos pr ON pr.id = d.producto_id
GROUP BY pr.id, pr.nombre
ORDER BY unidades DESC;

SELECT p.id FROM pedidos p
LEFT JOIN detalle_pedidos d ON d.pedido_id = p.id
WHERE p.estado = 'abierto' AND d.id IS NULL;
