<?php
require __DIR__ . '/_bootstrap.php';

manejar(function () {
    metodo('GET');
    exigir_area('salon', 'caja');
    $pdo = db();

    $mesas = $pdo->query(
        "SELECT m.id, m.numero, m.capacidad,
                CONCAT(m.pos_x, '%') AS x, CONCAT(m.pos_y, '%') AS y,
                p.id AS pedido_id,
                DATE_FORMAT(p.creado_en, '%H:%i') AS abierto_a_las,
                (p.id IS NOT NULL) AS ocupada
         FROM mesas m
         LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto'
         ORDER BY m.numero"
    )->fetchAll();

    $resumen = $pdo->query(
        "SELECT COUNT(*)                           AS total,
                COALESCE(SUM(p.id IS NOT NULL), 0) AS ocupadas,
                COALESCE(SUM(p.id IS NULL), 0)     AS libres,
                COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN m.capacidad END), 0) AS lugares_en_uso
         FROM mesas m
         LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = 'abierto'"
    )->fetch();

    foreach ($mesas as &$m) {
        $m['ocupada'] = (bool) $m['ocupada'];
    }

    return ['ok' => true, 'mesas' => $mesas, 'resumen' => $resumen];
});
