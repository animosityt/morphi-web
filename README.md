# Morphi Web

Sistema de comandas para el restaurante: salón, cocina y caja sobre la intranet.
Stack: HTML5 + CSS3 + JavaScript nativo · PHP 8 · MySQL/MariaDB (XAMPP). Sin frameworks.
No usa recursos de internet (sin Google Fonts ni imágenes externas).

## Estructura
```
morphi-web/
├── index.html            Login/registro + Salón · Cocina · Caja (cada cargo ve el suyo)
├── css/styles.css        Estilos del diseño de Figma
├── js/app.js             Lógica de pantalla (fetch a la API, sin cálculos de dinero)
├── img/hero.svg          Ilustración del salón (se puede reemplazar por img/hero.jpg)
├── api/
│   ├── _bootstrap.php    Conexión PDO, sesiones, permisos por cargo, transacciones
│   ├── auth.php          GET quién soy · POST login / registro / logout
│   ├── mesas.php         GET  mapa de mesas + resumen
│   ├── productos.php     GET  carta
│   ├── comandas.php      POST cargar pedido
│   ├── cocina.php        GET  cola  ·  POST botón "Listo"
│   └── caja.php          GET  cuenta + total  ·  POST cobrar
└── sql/
    ├── 01_schema.sql     Tablas y relaciones
    ├── 02_datos.sql      Mesas y carta de ejemplo
    └── 03_consultas.sql  Todas las consultas documentadas
```

## Instalación (Etapa 2)
1. Instalar XAMPP y abrir el panel. Iniciar **Apache** y **MySQL**
   (tildar "Service" en ambos para que arranquen solos al prender la PC).
2. Copiar la carpeta `morphi-web` a `C:\xampp\htdocs\`.
3. Abrir `http://localhost/phpmyadmin` → pestaña **Importar** → importar
   `sql/01_schema.sql` y después `sql/02_datos.sql`.
4. Abrir `http://localhost/morphi-web/`.
5. Si MySQL tiene contraseña, editarla en `api/_bootstrap.php`
   (`DB_USER` / `DB_PASS`). Para producción conviene crear un usuario propio
   en vez de `root`.

## Cargos y acceso desde cualquier dispositivo
| Cargo | Entra a | Puede usar |
|---|---|---|
| Mozo/a | Salón | mapa de mesas, cargar comandas |
| Cocina | Cocina | cola de preparación, botón "Listo" |
| Caja | Caja | ver cuentas, cobrar y liberar mesas |

- Cada empleado se registra una vez (nombre, usuario, contraseña, cargo y el **código del local**
  que le da el encargado) y después entra con usuario y contraseña desde su teléfono, tablet o PC.
- Averiguar la IP de la terminal (`ipconfig`, por ej. `192.168.1.10`) y abrir
  `http://192.168.1.10/morphi-web/` desde cualquier dispositivo **conectado a la misma red/Wi-Fi del local**.
- Si no abre: permitir Apache en el Firewall de Windows (red privada).
- Los permisos los controla el **servidor** en cada pedido (no solo la pantalla). Para cambiar qué
  cargo accede a qué, editar la línea `exigir_cargo(...)` de cada archivo de `api/`.
- La sesión dura 12 horas. Cada acción queda registrada con el empleado que la hizo
  (`abierto_por`, `cargado_por`, `listo_por`, `cobrado_por`).
- Acceso desde fuera del local (por internet) no está incluido: requeriría HTTPS y una VPN. Sobre HTTP en la
  red local las contraseñas viajan sin cifrar, aceptable en una red privada de confianza.

## Cómo cumple las reglas de ingeniería
| Regla | Cómo se resuelve |
|---|---|
| Consistencia de datos | InnoDB + claves foráneas. Todo se guarda en MySQL al instante; si se corta la luz, al reiniciar el estado es el mismo. El estado "ocupada" se deduce del pedido abierto, no se duplica. |
| Cero inventos matemáticos | Subtotales y total salen de `SUM(cantidad * precio_unitario)` en SQL. El JS solo les da formato de moneda. El precio se lee de la base, nunca viene del navegador. |
| Acceso por cargo | Sesión PHP + contraseñas con `password_hash`. Cada endpoint exige el cargo correcto (401/403). El registro pide el código del local. |
| Validación básica | Sin productos → no se envía (pantalla y servidor). Mesa sin cuenta o sin consumos → no se factura (HTTP 409). Cantidades 1–99. |
| Dos terminales a la vez | Transacciones + índice único: una mesa no puede tener dos cuentas abiertas. |

## Testing (Etapa 3)
Marcar cada caso en pantalla (los casos 1 a 12 se prueban con la sesión del cargo que corresponda). Lo que dice "Verificar en SQL" se mira en phpMyAdmin.

| # | Caso | Resultado esperado |
|---|---|---|
| A | Abrir la app sin sesión | Pantalla clara de login con viñeta oscura |
| B | Crear cuenta con código incorrecto | "El código del local no es correcto." |
| C | Crear 3 cuentas: una Mozo, una Cocina, una Caja | Cada una entra directo a su apartado |
| D | Login con contraseña mala | "Usuario o contraseña incorrectos." |
| E | Con la sesión de Cocina abrir `api/mesas.php` | 403 "Tu cargo no tiene acceso" |
| F | Enviar pedido / marcar Listo / Cobrar / Salir | Aparece el pop-up con el botón ovalado "Confirmar?"; tocar fuera cancela y no guarda nada |
| 1 | Abrir la app con la base cargada | 12 mesas verdes; resumen: 12 disponibles, 0 en servicio |
| 2 | Click en mesa 1, "Enviar pedido" sin elegir nada | Mensaje "Seleccioná al menos un producto"; la mesa sigue verde |
| 3 | Mesa 1: 1 Milanesa con fritas + 2 Gaseosas → Enviar | Mesa 1 roja; cocina muestra solo la milanesa (la bebida no va a cocina) |
| 4 | Cargar mesa 2 un minuto después | En cocina, mesa 1 aparece antes que mesa 2 |
| 5 | Click en mesa 1 (ocupada) y sumar un Flan | Se agrega a la misma cuenta; aparece un ticket nuevo al final de la cola |
| 6 | Cocina: "Listo" en la milanesa | El ticket desaparece; en SQL `listo = 1` |
| 7 | Caja → Mesa 1 | Detalle por ítem y total = 13500 + 2×3200 + 5600 = 25.500 (con los precios de ejemplo) |
| 8 | Cambiar un precio en `productos` y recargar Caja | La cuenta ya cargada NO cambia (usa `precio_unitario`) |
| 9 | "Cobrar y liberar mesa" | Mesa 1 verde; desaparece de Caja; en SQL `estado='cobrado'` y `total_cobrado` cargado |
| 10 | Cortar la luz / cerrar Apache y MySQL con mesas abiertas, volver a iniciar | Mesas rojas y consumos idénticos a antes |
| 11 | Apagar solo MySQL | Banner rojo "Sin conexión"; al volver, se recupera solo |
| 12 | Abrir la app en dos navegadores; cargar en uno | El otro lo ve en menos de 3 s |

Pruebas por consola (API directa):
```
curl http://localhost/morphi-web/api/mesas.php
  -> 401 "Tenés que iniciar sesión."   (sin sesión la API no devuelve datos)
```
Las pruebas de validación (comanda vacía, mesa sin cuenta) se hacen desde la pantalla con el cargo correcto.

Verificar en SQL (`sql/03_consultas.sql`): el chequeo de integridad del final no debe devolver filas.
