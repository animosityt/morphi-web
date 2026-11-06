<?php
require __DIR__ . '/_bootstrap.php';

manejar(function () {
    metodo('GET');
    exigir_area('salon');
    $productos = db()->query(
        'SELECT id, nombre, categoria, precio FROM productos WHERE activo = 1 ORDER BY id'
    )->fetchAll();
    return ['ok' => true, 'productos' => $productos];
});
