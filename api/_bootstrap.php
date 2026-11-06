<?php
declare(strict_types=1);

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Falta el archivo api/config.php.'], JSON_UNESCAPED_UNICODE);
    exit;
}
require_once __DIR__ . '/config.php';

const CARGOS = ['mozo', 'cocinero', 'cajero', 'encargado'];

const AREAS_POR_CARGO = [
    'mozo'      => ['salon'],
    'cocinero'  => ['cocina'],
    'cajero'    => ['caja'],
    'encargado' => ['salon', 'cocina', 'caja'],
];

date_default_timezone_set('America/Argentina/Buenos_Aires');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', (string) SESION_SEGUNDOS);
session_name('MORPHI_SESION');
session_set_cookie_params([
    'lifetime' => SESION_SEGUNDOS,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => !empty($_SERVER['HTTPS']),
]);
session_start();
session_write_close();

class ApiError extends Exception
{
    public int $http;
    public function __construct(string $mensaje, int $http = 400)
    {
        parent::__construct($mensaje);
        $this->http = $http;
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        $pdo->exec("SET time_zone = '-03:00'");
    }
    return $pdo;
}

function responder(array $datos, int $http = 200): void
{
    http_response_code($http);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function metodo(string $esperado): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $esperado) {
        throw new ApiError('Método no permitido.', 405);
    }
}

function leer_json(): array
{
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === false) {
        throw new ApiError('Formato de pedido no admitido.', 415);
    }
    $crudo = file_get_contents('php://input');
    $datos = json_decode($crudo === false ? '' : $crudo, true);
    if (!is_array($datos)) {
        throw new ApiError('El pedido no tiene un formato válido.', 400);
    }
    return $datos;
}

function entero_positivo(mixed $valor, string $campo): int
{
    $n = filter_var($valor, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($n === false) {
        throw new ApiError("El campo '$campo' es inválido.", 422);
    }
    return $n;
}

function empleado_actual(): ?array
{
    static $listo = false, $emp = null;
    if (!$listo) {
        $listo = true;
        if (!empty($_SESSION['empleado_id'])) {
            $st = db()->prepare('SELECT id, nombre, usuario, cargo FROM empleados WHERE id = ? AND activo = 1');
            $st->execute([(int) $_SESSION['empleado_id']]);
            $fila = $st->fetch();
            $emp = $fila ?: null;
        }
    }
    return $emp;
}

function exigir_area(string ...$areas): array
{
    $emp = empleado_actual();
    if ($emp === null) {
        throw new ApiError('Tenés que iniciar sesión.', 401);
    }
    $permitidas = AREAS_POR_CARGO[$emp['cargo']] ?? [];
    if (count(array_intersect($areas, $permitidas)) === 0) {
        throw new ApiError('Tu cargo no tiene acceso a esta función.', 403);
    }
    return $emp;
}

function manejar(callable $endpoint): void
{
    try {
        responder($endpoint());
    } catch (ApiError $e) {
        responder(['ok' => false, 'error' => $e->getMessage()], $e->http);
    } catch (Throwable $e) {
        error_log('[morphi] ' . $e->getMessage());
        responder(['ok' => false, 'error' => 'Error interno del servidor. ¿Está corriendo MySQL?'], 500);
    }
}

function transaccion(callable $fn): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $resultado = $fn($pdo);
        $pdo->commit();
        return $resultado;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}
