<?php
require __DIR__ . '/_bootstrap.php';

manejar(function () {
    $emp = exigir_area('cocina');
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $cola = $pdo->query(
            "SELECT d.id AS detalle_id, m.numero AS mesa, pr.nombre, pr.categoria, d.cantidad,
                    DATE_FORMAT(d.creado_en, '%H:%i') AS hora,
                    e.nombre AS mozo
             FROM detalle_pedidos d
             JOIN pedidos   p  ON p.id  = d.pedido_id AND p.estado = 'abierto'
             JOIN mesas     m  ON m.id  = p.mesa_id
             JOIN productos pr ON pr.id = d.producto_id
             LEFT JOIN empleados e ON e.id = d.cargado_por
             WHERE d.listo = 0 AND pr.va_a_cocina = 1
             ORDER BY d.creado_en ASC, d.id ASC"
        )->fetchAll();
        return ['ok' => true, 'cola' => $cola];
    }

    metodo('POST');
    $in = leer_json();
    $detalleId = entero_positivo($in['detalle_id'] ?? null, 'detalle_id');

    $st = $pdo->prepare('UPDATE detalle_pedidos SET listo = 1, listo_en = NOW(), listo_por = ? WHERE id = ? AND listo = 0');
    $st->execute([$emp['id'], $detalleId]);
    if ($st->rowCount() === 0) {
        $existe = $pdo->prepare('SELECT 1 FROM detalle_pedidos WHERE id = ?');
        $existe->execute([$detalleId]);
        if (!$existe->fetchColumn()) {
            throw new ApiError('Ese plato no existe.', 404);
        }
    }
    return ['ok' => true];
});
