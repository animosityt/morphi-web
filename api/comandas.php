<?php
require __DIR__ . '/_bootstrap.php';

// POST {"mesa_id": 3, "items": [{"producto_id": 4, "cantidad": 1}, ...]}
manejar(function () {
    metodo('POST');
    $emp = exigir_area('salon');
    $in = leer_json();

    $mesaId = entero_positivo($in['mesa_id'] ?? null, 'mesa_id');
    $items  = $in['items'] ?? null;
    if (!is_array($items) || count($items) === 0) {
        throw new ApiError('No se puede enviar una comanda sin productos.', 422);
    }

    // Unifica repetidos: [producto_id => cantidad total]
    $cantidades = [];
    foreach ($items as $it) {
        if (!is_array($it)) {
            throw new ApiError('Ítem inválido.', 422);
        }
        $pid = entero_positivo($it['producto_id'] ?? null, 'producto_id');
        $cant = entero_positivo($it['cantidad'] ?? null, 'cantidad');
        $cantidades[$pid] = ($cantidades[$pid] ?? 0) + $cant;
    }
    foreach ($cantidades as $c) {
        if ($c > 99) {
            throw new ApiError('La cantidad máxima por producto es 99.', 422);
        }
    }

    return transaccion(function (PDO $pdo) use ($mesaId, $cantidades, $emp) {
        // Bloquea la mesa: dos mozos cargando a la vez se ponen en fila.
        $st = $pdo->prepare('SELECT numero FROM mesas WHERE id = ? FOR UPDATE');
        $st->execute([$mesaId]);
        $mesa = $st->fetch();
        if (!$mesa) {
            throw new ApiError('La mesa no existe.', 404);
        }

        // Los precios se leen de la base, nunca se confía en el navegador.
        $ids = array_keys($cantidades);
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $st = $pdo->prepare("SELECT id, precio FROM productos WHERE activo = 1 AND id IN ($marcas)");
        $st->execute($ids);
        $precios = array_column($st->fetchAll(), 'precio', 'id');
        foreach ($ids as $pid) {
            if (!isset($precios[$pid])) {
                throw new ApiError('Hay un producto que ya no está disponible.', 422);
            }
        }

        // Cuenta abierta de la mesa (o se abre una nueva).
        $st = $pdo->prepare("SELECT id FROM pedidos WHERE mesa_id = ? AND estado = 'abierto' FOR UPDATE");
        $st->execute([$mesaId]);
        $pedidoId = $st->fetchColumn();
        if ($pedidoId === false) {
            $pdo->prepare('INSERT INTO pedidos (mesa_id, abierto_por) VALUES (?, ?)')->execute([$mesaId, $emp['id']]);
            $pedidoId = (int) $pdo->lastInsertId();
        }

        $ins = $pdo->prepare(
            'INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, cargado_por)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($cantidades as $pid => $cant) {
            $ins->execute([$pedidoId, $pid, $cant, $precios[$pid], $emp['id']]);
        }

        return ['ok' => true, 'pedido_id' => (int) $pedidoId, 'mesa' => (int) $mesa['numero']];
    });
});
