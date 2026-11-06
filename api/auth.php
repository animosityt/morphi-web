<?php
require __DIR__ . '/_bootstrap.php';

function datos_publicos(array $e): array
{
    return ['id' => (int) $e['id'], 'nombre' => $e['nombre'], 'usuario' => $e['usuario'], 'cargo' => $e['cargo']];
}

/** Abre la sesión del empleado (renueva el identificador para evitar fijación de sesión). */
function iniciar_sesion(int $empleadoId): void
{
    session_start();
    session_regenerate_id(true);
    $_SESSION['empleado_id'] = $empleadoId;
    session_write_close();
}

manejar(function () {
    // GET: ¿hay alguien logueado? (el navegador lo consulta al abrir la página)
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $e = empleado_actual();
        return ['ok' => true, 'empleado' => $e ? datos_publicos($e) : null];
    }

    metodo('POST');
    $in = leer_json();
    $accion = (string) ($in['accion'] ?? '');
    $pdo = db();

    if ($accion === 'login') {
        $usuario = strtolower(trim((string) ($in['usuario'] ?? '')));
        $clave   = (string) ($in['clave'] ?? '');

        $st = $pdo->prepare('SELECT id, nombre, usuario, cargo, clave_hash FROM empleados WHERE usuario = ? AND activo = 1');
        $st->execute([$usuario]);
        $e = $st->fetch();

        if (!$e || !password_verify($clave, $e['clave_hash'])) {
            usleep(400000); // frena los intentos de adivinar contraseñas
            throw new ApiError('Usuario o contraseña incorrectos.', 401);
        }
        iniciar_sesion((int) $e['id']);
        return ['ok' => true, 'empleado' => datos_publicos($e)];
    }

    if ($accion === 'registro') {
        $cargo = (string) ($in['cargo'] ?? '');

        // El código va primero: quien no lo tiene no averigua nada más.
        // Los encargados usan su propio código; el resto, el código del local.
        if ($cargo === 'encargado') {
            if (CODIGO_ENCARGADO === '') {
                throw new ApiError('El registro de encargados está desactivado.', 403);
            }
            $esperado = CODIGO_ENCARGADO;
        } else {
            $esperado = CODIGO_REGISTRO;
        }
        if (!hash_equals($esperado, (string) ($in['codigo'] ?? ''))) {
            usleep(400000);
            throw new ApiError($cargo === 'encargado' ? 'El código de encargado no es correcto.' : 'El código del local no es correcto.', 403);
        }

        $nombre  = trim((string) ($in['nombre'] ?? ''));
        $usuario = strtolower(trim((string) ($in['usuario'] ?? '')));
        $clave   = (string) ($in['clave'] ?? '');

        if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 60) {
            throw new ApiError('Escribí tu nombre (entre 2 y 60 letras).', 422);
        }
        if (!preg_match('/^[a-z0-9._-]{3,30}$/', $usuario)) {
            throw new ApiError('El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.', 422);
        }
        if (strlen($clave) < 8 || strlen($clave) > 72) {
            throw new ApiError('La contraseña debe tener entre 8 y 72 caracteres.', 422);
        }
        if (!in_array($cargo, CARGOS, true)) {
            throw new ApiError('Elegí un cargo.', 422);
        }

        try {
            $st = $pdo->prepare('INSERT INTO empleados (nombre, usuario, clave_hash, cargo) VALUES (?, ?, ?, ?)');
            $st->execute([$nombre, $usuario, password_hash($clave, PASSWORD_DEFAULT), $cargo]);
        } catch (PDOException $ex) {
            if ($ex->getCode() === '23000') {
                throw new ApiError('Ese usuario ya existe. Probá con otro.', 409);
            }
            throw $ex;
        }
        $id = (int) $pdo->lastInsertId();
        iniciar_sesion($id);
        return ['ok' => true, 'empleado' => ['id' => $id, 'nombre' => $nombre, 'usuario' => $usuario, 'cargo' => $cargo]];
    }

    if ($accion === 'logout') {
        session_start();
        $_SESSION = [];
        session_destroy();
        setcookie(session_name(), '', time() - 3600, '/');
        return ['ok' => true];
    }

    throw new ApiError('Acción desconocida.', 400);
});
