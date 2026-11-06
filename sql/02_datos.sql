USE morphi_web;

INSERT INTO mesas (numero, capacidad, pos_x, pos_y) VALUES
 ( 1, 2, 12, 22), ( 2, 2, 28, 22), ( 3, 4, 46, 26),
 ( 4, 4, 14, 50), ( 5, 4, 34, 50), ( 6, 6, 58, 50),
 ( 7, 2, 82, 30), ( 8, 4, 14, 78), ( 9, 4, 34, 78),
 (10, 6, 58, 78), (11, 2, 82, 62), (12, 4, 84, 84);

INSERT INTO productos (nombre, categoria, precio, va_a_cocina) VALUES
 ('Rabas',                     'Entradas',           14500.00, 1),
 ('Empanadas de carne (x3)',   'Entradas',            7800.00, 1),
 ('Provoleta',                 'Entradas',            8900.00, 1),
 ('Milanesa con fritas',       'Platos principales', 13500.00, 1),
 ('Milanesa napolitana',       'Platos principales', 15200.00, 1),
 ('Merluza a la romana',       'Platos principales', 14800.00, 1),
 ('Ravioles con salsa',        'Platos principales', 12900.00, 1),
 ('Bife de chorizo con papas', 'Platos principales', 18700.00, 1),
 ('Flan con dulce de leche',   'Postres',             5600.00, 1),
 ('Helado (2 bochas)',         'Postres',             5200.00, 1),
 ('Gaseosa',                   'Bebidas',             3200.00, 0),
 ('Agua mineral',              'Bebidas',             2800.00, 0),
 ('Cerveza tirada (pinta)',    'Bebidas',             4800.00, 0),
 ('Copa de vino',              'Bebidas',             4500.00, 0),
 ('Café',                      'Bebidas',             2600.00, 0);
