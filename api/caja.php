<?php
require __DIR__ . '/_bootstrap.php';

function pedido_abierto(PDO $pdo, int $mesaId, bool $bloquear = false): int
{
    $sql = "SELECT id FROM pedidos WHERE mesa_id = ? AND estado = 'abierto'" . ($bloquear ? ' FOR UPDATE' : '');
    $st = $pdo->prepare($sql);
    $st->execute([$mesaId]);
    $id = $st->fetchColumn();
    if ($id === false) {
        throw new ApiError('La mesa no tiene una cuenta abierta: no hay nada para facturar.', 409);
    }
    return (int) $id;
}

function total_pedido(PDO $pdo, int $pedidoId): ?string
{
    $st = $pdo->prepare('SELECT SUM(cantidad * precio_unitario) FROM detalle_pedidos WHERE pedido_id = ?');
    $st->execute([$pedidoId]);
    $total = $st->fetchColumn();
    return $total === null || $total === false ? null : (string) $total;
}

manejar(function () {
    $emp = exigir_area('caja');
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $mesaId   = entero_positivo($_GET['mesa_id'] ?? null, 'mesa_id');
        $pedidoId = pedido_abierto($pdo, $mesaId);

        $st = $pdo->prepare(
            'SELECT pr.nombre,
                    SUM(d.cantidad)                     AS cantidad,
                    d.precio_unitario,
                    SUM(d.cantidad * d.precio_unitario) AS subtotal
             FROM detalle_pedidos d
             JOIN productos pr ON pr.id = d.producto_id
             WHERE d.pedido_id = ?
             GROUP BY d.producto_id, pr.nombre, d.precio_unitario
             ORDER BY d.producto_id'
        );
        $st->execute([$pedidoId]);
        $lineas = $st->fetchAll();

        $total = total_pedido($pdo, $pedidoId);
        if ($total === null) {
            throw new ApiError('La mesa no tiene consumos: no se puede facturar una mesa vacía.', 409);
        }

        $st = $pdo->prepare('SELECT numero FROM mesas WHERE id = ?');
        $st->execute([$mesaId]);

        return [
            'ok'        => true,
            'pedido_id' => $pedidoId,
            'mesa'      => (int) $st->fetchColumn(),
            'lineas'    => $lineas,
            'total'     => $total,
        ];
    }

    metodo('POST');
    $mesaId = entero_positivo(leer_json()['mesa_id'] ?? null, 'mesa_id');

    return transaccion(function (PDO $pdo) use ($mesaId, $emp) {
        $pedidoId = pedido_abierto($pdo, $mesaId, true);

        if (total_pedido($pdo, $pedidoId) === null) {
            throw new ApiError('No se puede facturar una mesa vacía.', 409);
        }

        $pdo->prepare(
            "UPDATE pedidos
             SET estado = 'cobrado',
                 cobrado_en = NOW(),
                 cobrado_por = ?,
                 total_cobrado = (SELECT SUM(cantidad * precio_unitario)
                                  FROM detalle_pedidos WHERE pedido_id = ?)
             WHERE id = ? AND estado = 'abierto'"
        )->execute([$emp['id'], $pedidoId, $pedidoId]);

        $st = $pdo->prepare('SELECT total_cobrado FROM pedidos WHERE id = ?');
        $st->execute([$pedidoId]);

        return ['ok' => true, 'pedido_id' => $pedidoId, 'total_cobrado' => (string) $st->fetchColumn()];
    });
});
