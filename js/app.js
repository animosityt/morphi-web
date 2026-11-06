(function () {
  'use strict';

  var POLL_MS = 3000;
  var moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  var APARTADO = { mozo: 'floor', cocinero: 'kitchen', cajero: 'billing', encargado: 'floor' };
  var AREAS = {
    mozo: ['floor'], cocinero: ['kitchen'], cajero: ['billing'],
    encargado: ['floor', 'kitchen', 'billing']
  };
  var AREA_TXT = { floor: 'Salón', kitchen: 'Cocina', billing: 'Caja' };
  var CARGO_TXT = { mozo: 'Mozo/a', cocinero: 'Cocina', cajero: 'Caja', encargado: 'Encargado/a' };
  var HERO_EYEBROW = {
    mozo: 'Mozos y salón · Panel del equipo',
    cocinero: 'Cocina · Panel del equipo',
    cajero: 'Caja · Panel del equipo',
    encargado: 'Encargado · Los tres apartados'
  };

  var estado = {
    empleado: null,
    mesas: [],
    productos: [],
    mesaModal: null,
    borrador: {},
    mesaCaja: null,
    cuenta: null,
    enviando: false
  };
  var firmas = {};
  var timer = null;

  var $ = function (id) { return document.getElementById(id); };
  var noop = function () {};

  function tiene(area) {
    return !!estado.empleado && AREAS[estado.empleado.cargo].indexOf(area) !== -1;
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dinero(valor) { return moneda.format(Number(valor)); }
  function cambio(clave, datos) {
    var f = JSON.stringify(datos);
    if (firmas[clave] === f) return false;
    firmas[clave] = f;
    return true;
  }

  function setOnline(ok) {
    $('conn-banner').hidden = ok;
    $('service-status').classList.toggle('offline', !ok);
    $('service-status').lastElementChild.textContent = ok ? 'Turno activo' : 'Sin conexión';
  }

  function api(url, cuerpo) {
    var opciones = cuerpo === undefined ? { credentials: 'same-origin' } : {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    };
    return fetch(url, opciones).then(function (res) {
      setOnline(true);
      return res.json().catch(function () { return null; }).then(function (datos) {
        if (res.status === 401 && estado.empleado) {
          mostrarAuth();
          aviso('Tu sesión terminó. Ingresá de nuevo.', true);
        }
        if (!res.ok || !datos || datos.ok === false) {
          throw new Error((datos && datos.error) || 'Error del servidor (' + res.status + ').');
        }
        return datos;
      });
    }, function () {
      setOnline(false);
      throw new Error('Sin conexión con el servidor.');
    });
  }

  var toastTimer = null;
  function aviso(mensaje, esError) {
    var t = $('toast');
    t.textContent = mensaje;
    t.className = 'toast' + (esError ? ' error' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3400);
  }

  function confirmar(titulo, detalle) {
    return new Promise(function (resolve) {
      var bg = document.createElement('div');
      bg.className = 'confirm-bg';
      bg.setAttribute('role', 'dialog');
      bg.setAttribute('aria-modal', 'true');
      bg.innerHTML =
        '<div class="confirm-box">' +
        '<p class="eyebrow">Confirmar acción</p>' +
        '<h3>' + esc(titulo) + '</h3>' +
        '<p class="confirm-detalle">' + esc(detalle || '') + '</p>' +
        '<button type="button" class="confirm-oval">Confirmar?</button>' +
        '<p class="confirm-hint">Tocá en cualquier otro lado para cancelar</p>' +
        '</div>';
      var cerrado = false;
      function cerrar(resultado) {
        if (cerrado) return;
        cerrado = true;
        document.removeEventListener('keydown', tecla, true);
        bg.remove();
        resolve(resultado);
      }
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(false); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cerrar(true); }
      }
      bg.addEventListener('click', function (e) {
        cerrar(!!e.target.closest('.confirm-oval'));
      });
      document.addEventListener('keydown', tecla, true);
      document.body.appendChild(bg);
      bg.querySelector('.confirm-oval').focus();
    });
  }

  function mostrarAuth() {
    estado.empleado = null;
    clearInterval(timer);
    timer = null;
    cerrarComanda();
    firmas = {};
    estado.mesas = []; estado.productos = []; estado.mesaCaja = null; estado.cuenta = null;
    $('app').hidden = true;
    $('auth').hidden = false;
    document.body.classList.add('en-auth');
    window.scrollTo(0, 0);
  }

  function mostrarTab(tab) {
    var login = tab === 'login';
    Array.prototype.forEach.call(document.querySelectorAll('.auth-tabs button'), function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    $('form-login').hidden = !login;
    $('form-registro').hidden = login;
    $('auth-titulo').textContent = login ? 'Bienvenido al turno.' : 'Sumate al equipo.';
    $('auth-sub').textContent = login
      ? 'Ingresá con tu usuario para entrar a tu apartado.'
      : 'Creá tu cuenta con el código del local y elegí tu cargo.';
    $('login-error').textContent = '';
    $('registro-error').textContent = '';
  }

  document.querySelector('.auth-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) mostrarTab(b.dataset.tab);
  });

  function enviarAuth(form, errorId, cuerpo) {
    var btn = form.querySelector('.auth-submit');
    var err = $(errorId);
    err.textContent = '';
    btn.disabled = true;
    return api('api/auth.php', cuerpo).then(function (d) {
      form.reset();
      entrar(d.empleado);
    }).catch(function (e) {
      err.textContent = e.message;
    }).then(function () { btn.disabled = false; });
  }

  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    enviarAuth(this, 'login-error', {
      accion: 'login',
      usuario: $('l-usuario').value,
      clave: $('l-clave').value
    });
  });

  $('form-registro').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('registro-error');
    var cargo = document.querySelector('input[name="cargo"]:checked');
    if (!cargo) { err.textContent = 'Elegí tu cargo.'; return; }
    if ($('r-clave').value !== $('r-clave2').value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    enviarAuth(this, 'registro-error', {
      accion: 'registro',
      nombre: $('r-nombre').value,
      usuario: $('r-usuario').value,
      clave: $('r-clave').value,
      codigo: $('r-codigo').value,
      cargo: cargo.value
    });
  });

  $('form-registro').addEventListener('change', function (e) {
    if (e.target.name === 'cargo') {
      $('lbl-codigo').textContent = e.target.value === 'encargado' ? 'Código de encargado' : 'Código del local';
    }
  });

  function entrar(emp) {
    estado.empleado = emp;
    firmas = {};
    $('auth').hidden = true;
    $('app').hidden = false;
    document.body.classList.remove('en-auth');
    window.scrollTo(0, 0);

    var apartado = APARTADO[emp.cargo];
    ['floor', 'kitchen', 'billing'].forEach(function (id) { $(id).hidden = !tiene(id); });
    $('user-nombre').textContent = emp.nombre;
    $('user-cargo').textContent = CARGO_TXT[emp.cargo];
    $('hero-eyebrow').textContent = HERO_EYEBROW[emp.cargo];
    $('hero-copy').textContent = 'Hola, ' + emp.nombre.split(' ')[0] + '. Tu apartado está listo: todo lo que cargues queda guardado al instante.';
    $('hero-cta').setAttribute('href', '#' + apartado);
    $('nav-links').innerHTML = AREAS[emp.cargo].map(function (a) {
      return '<a href="#' + a + '">' + AREA_TXT[a] + '</a>';
    }).join('');

    pintarRecibo();
    ciclo();
    clearInterval(timer);
    timer = setInterval(ciclo, POLL_MS);
  }

  $('btn-salir').addEventListener('click', function () {
    confirmar('Cerrar sesión', estado.empleado ? estado.empleado.nombre : '').then(function (ok) {
      if (!ok) return;
      api('api/auth.php', { accion: 'logout' }).catch(noop).then(function () {
        mostrarAuth();
        mostrarTab('login');
      });
    });
  });

  function cargarCarta() {
    return api('api/productos.php').then(function (d) { estado.productos = d.productos; });
  }

  function cargarMesas() {
    return api('api/mesas.php').then(function (d) {
      estado.mesas = d.mesas;
      if (tiene('floor')) pintarMesas(d);
      if (tiene('billing')) {
        pintarListaCaja();
        if (estado.mesaCaja !== null) {
          var sigue = d.mesas.some(function (m) { return m.id === estado.mesaCaja && m.ocupada; });
          if (!sigue) { estado.mesaCaja = null; estado.cuenta = null; pintarListaCaja(); pintarRecibo(); }
        }
      }
    });
  }

  function pintarMesas(d) {
    var r = d.resumen;
    $('stat-ocupadas-big').textContent = r.ocupadas;
    $('stat-ocupadas').textContent = r.ocupadas;
    $('stat-libres').textContent = r.libres;
    $('stat-cubiertos').textContent = r.lugares_en_uso;

    if (!cambio('mesas', d.mesas)) return;
    var card = $('floor-card');
    var ph = $('floor-placeholder');
    ph.style.display = d.mesas.length ? 'none' : '';
    if (!d.mesas.length) ph.lastElementChild.textContent = 'No hay mesas cargadas en la base de datos';

    Array.prototype.forEach.call(card.querySelectorAll('button.table'), function (b) { b.remove(); });
    d.mesas.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'table table-' + m.capacidad + (m.ocupada ? ' occupied' : '');
      b.style.left = m.x;
      b.style.top = m.y;
      b.dataset.id = m.id;
      b.setAttribute('aria-label', 'Mesa ' + m.numero + ', ' + (m.ocupada ? 'ocupada' : 'libre'));
      b.innerHTML = '<span>' + esc(m.numero) + '</span><small>' + esc(m.capacidad) + ' lugares</small>';
      card.appendChild(b);
    });
  }

  $('floor-card').addEventListener('click', function (e) {
    var b = e.target.closest('button.table');
    if (b) abrirComanda(Number(b.dataset.id));
  });

  function abrirComanda(mesaId) {
    var mesa = estado.mesas.filter(function (m) { return m.id === mesaId; })[0];
    if (!mesa) return;
    if (!estado.productos.length) { aviso('La carta todavía no cargó. Probá de nuevo.', true); return; }
    estado.mesaModal = mesa;
    estado.borrador = {};

    var grupos = {}, orden = [];
    estado.productos.forEach(function (p) {
      if (!grupos[p.categoria]) { grupos[p.categoria] = []; orden.push(p.categoria); }
      grupos[p.categoria].push(p);
    });

    var html = '';
    orden.forEach(function (cat) {
      html += '<div><h4>' + esc(cat) + '</h4>';
      grupos[cat].forEach(function (p) {
        html += '<div class="menu-item"><div><b>' + esc(p.nombre) + '</b><span>' + esc(dinero(p.precio)) + '</span></div>' +
          '<div class="stepper">' +
          '<button type="button" data-id="' + p.id + '" data-delta="-1" aria-label="Quitar uno">−</button>' +
          '<span id="cant-' + p.id + '">0</span>' +
          '<button type="button" data-id="' + p.id + '" data-delta="1" aria-label="Agregar uno">+</button>' +
          '</div></div>';
      });
      html += '</div>';
    });

    $('modal-root').innerHTML =
      '<div class="modal-backdrop" id="modal-bg"><div class="order-modal">' +
      '<button type="button" class="close" id="modal-close" aria-label="Cerrar">×</button>' +
      '<p class="eyebrow">' + (mesa.ocupada ? 'Agregar a la comanda' : 'Nueva comanda') + '</p>' +
      '<h2>Mesa ' + esc(mesa.numero) + '</h2>' +
      '<p class="modal-intro">' + (mesa.ocupada
        ? 'La mesa está ocupada desde las ' + esc(mesa.abierto_a_las) + '. Lo que cargues se suma a su cuenta.'
        : 'Seleccioná los productos y las cantidades para esta mesa.') + '</p>' +
      '<div class="menu-list" id="menu-list">' + html + '</div>' +
      '<p class="modal-error" id="modal-error"></p>' +
      '<button type="button" class="payment-button" id="btn-enviar">Enviar pedido <span class="arrow">→</span></button>' +
      '</div></div>';
  }

  function cerrarComanda() {
    estado.mesaModal = null;
    estado.borrador = {};
    $('modal-root').innerHTML = '';
  }

  $('modal-root').addEventListener('mousedown', function (e) {
    if (e.target.id === 'modal-bg') cerrarComanda();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && estado.mesaModal) cerrarComanda();
  });

  $('modal-root').addEventListener('click', function (e) {
    if (e.target.closest('#modal-close')) { cerrarComanda(); return; }

    var paso = e.target.closest('.stepper button');
    if (paso) {
      var id = Number(paso.dataset.id);
      var nueva = Math.min(99, Math.max(0, (estado.borrador[id] || 0) + Number(paso.dataset.delta)));
      if (nueva === 0) delete estado.borrador[id]; else estado.borrador[id] = nueva;
      $('cant-' + id).textContent = nueva;
      $('modal-error').textContent = '';
      return;
    }
    if (e.target.closest('#btn-enviar')) enviarComanda();
  });

  function enviarComanda() {
    if (estado.enviando || !estado.mesaModal) return;
    var items = Object.keys(estado.borrador).map(function (id) {
      return { producto_id: Number(id), cantidad: estado.borrador[id] };
    });
    if (!items.length) {
      $('modal-error').textContent = 'Seleccioná al menos un producto antes de enviar el pedido.';
      return;
    }
    var mesa = estado.mesaModal;
    var unidades = items.reduce(function (n, it) { return n + it.cantidad; }, 0);
    var detalle = 'Mesa ' + mesa.numero + ' · ' + unidades + (unidades === 1 ? ' producto' : ' productos');

    confirmar('Enviar pedido', detalle).then(function (ok) {
      if (!ok || estado.enviando) return;
      estado.enviando = true;
      var btn = $('btn-enviar');
      if (btn) btn.disabled = true;
      return api('api/comandas.php', { mesa_id: mesa.id, items: items }).then(function () {
        cerrarComanda();
        aviso('Pedido enviado: mesa ' + mesa.numero);
        return ciclo();
      }).catch(function (err) {
        var e = $('modal-error');
        if (e) e.textContent = err.message; else aviso(err.message, true);
      }).then(function () {
        estado.enviando = false;
        if ($('btn-enviar')) $('btn-enviar').disabled = false;
      });
    });
  }

  function cargarCocina() {
    return api('api/cocina.php').then(function (d) {
      $('queue-count').textContent = d.cola.length + (d.cola.length === 1 ? ' plato pendiente' : ' platos pendientes');
      if (!cambio('cola', d.cola)) return;
      var grid = $('queue-grid');
      if (!d.cola.length) {
        grid.innerHTML = '<div class="empty-state">Todo al día. No hay platos pendientes.</div>';
        return;
      }
      grid.innerHTML = d.cola.map(function (it, i) {
        var desc = it.cantidad + '× ' + it.nombre + ' · Mesa ' + it.mesa;
        return '<article class="ticket">' +
          '<div class="ticket-top"><div><span class="ticket-number">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
          '<b>MESA ' + esc(it.mesa) + '</b></div><time>' + esc(it.hora) + '</time></div>' +
          '<div class="ticket-body"><span class="qty">' + esc(it.cantidad) + '</span>' +
          '<div><h3>' + esc(it.nombre) + '</h3><p>' + esc(it.categoria) +
          (it.mozo ? '<span class="por">Cargó: ' + esc(it.mozo) + '</span>' : '') + '</p></div></div>' +
          '<button type="button" class="ready-button" data-detalle="' + it.detalle_id + '" data-desc="' + esc(desc) + '">Listo <span>✓</span></button>' +
          '</article>';
      }).join('');
    });
  }

  $('queue-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.ready-button');
    if (!b || b.disabled) return;
    var detalleId = Number(b.dataset.detalle);
    confirmar('Marcar plato como listo', b.dataset.desc).then(function (ok) {
      if (!ok) return;
      b.disabled = true;
      return api('api/cocina.php', { detalle_id: detalleId }).then(function () {
        aviso('Plato marcado como listo');
        return cargarCocina();
      }).catch(function (err) {
        b.disabled = false;
        aviso(err.message, true);
      });
    });
  });

  function pintarListaCaja() {
    var ocupadas = estado.mesas.filter(function (m) { return m.ocupada; });
    if (!cambio('listaCaja', [ocupadas, estado.mesaCaja])) return;
    var lista = $('bill-list');
    if (!ocupadas.length) { lista.innerHTML = '<div class="data-placeholder">No hay mesas con cuenta abierta</div>'; return; }
    lista.innerHTML = ocupadas.map(function (m) {
      return '<button type="button" data-id="' + m.id + '"' + (estado.mesaCaja === m.id ? ' class="active"' : '') + '>' +
        '<span>Mesa ' + esc(m.numero) + '</span><small>' + esc(m.abierto_a_las) + '</small></button>';
    }).join('');
  }

  $('bill-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    estado.mesaCaja = Number(b.dataset.id);
    estado.cuenta = null;
    pintarListaCaja();
    cargarCuenta().catch(function (err) { aviso(err.message, true); });
  });

  function cargarCuenta() {
    if (estado.mesaCaja === null) return Promise.resolve();
    var pedida = estado.mesaCaja;
    return api('api/caja.php?mesa_id=' + pedida).then(function (d) {
      if (estado.mesaCaja !== pedida) return;
      estado.cuenta = d;
      pintarRecibo();
    });
  }

  function pintarRecibo() {
    var c = estado.cuenta;
    var r = $('receipt');
    if (!cambio('recibo', c)) return;
    if (!c) {
      r.innerHTML = '<div class="receipt-head"><div><p class="eyebrow">MPW</p><h3>Mesa —</h3></div><span>CUENTA —</span></div>' +
        '<div class="receipt-lines"><div class="receipt-line"><span>Elegí una mesa activa</span><span>$-</span></div></div>' +
        '<div class="receipt-total"><span>Total</span><b>$-</b></div>';
      return;
    }
    r.innerHTML =
      '<div class="receipt-head"><div><p class="eyebrow">MPW</p><h3>Mesa ' + esc(c.mesa) + '</h3></div>' +
      '<span>CUENTA #' + esc(c.pedido_id) + '</span></div>' +
      '<div class="receipt-lines">' + c.lineas.map(function (l) {
        return '<div class="receipt-line"><span><b>' + esc(l.cantidad) + '×</b> ' + esc(l.nombre) + '</span>' +
          '<span>' + esc(dinero(l.subtotal)) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="receipt-total"><span>Total</span><b>' + esc(dinero(c.total)) + '</b></div>' +
      '<button type="button" class="payment-button" id="btn-cobrar">Cobrar y liberar mesa <span class="arrow">→</span></button>' +
      '<p class="payment-note">Al cobrar, la cuenta se cierra y la mesa queda libre.</p>';
  }

  $('receipt').addEventListener('click', function (e) {
    var b = e.target.closest('#btn-cobrar');
    if (!b || b.disabled || estado.mesaCaja === null || !estado.cuenta) return;
    var mesaId = estado.mesaCaja;
    var mesaNum = estado.cuenta.mesa;
    var total = estado.cuenta.total;

    confirmar('Cobrar la cuenta', 'Mesa ' + mesaNum + ' · Total ' + dinero(total)).then(function (ok) {
      if (!ok) return;
      b.disabled = true;
      return api('api/caja.php', { mesa_id: mesaId }).then(function (d) {
        aviso('Cobrado ' + dinero(d.total_cobrado) + ' — mesa ' + mesaNum + ' libre');
        estado.mesaCaja = null;
        estado.cuenta = null;
        return ciclo();
      }).catch(function (err) {
        b.disabled = false;
        aviso(err.message, true);
      });
    });
  });

  function ciclo() {
    var emp = estado.empleado;
    if (!emp) return Promise.resolve();
    var tareas = [];
    if (tiene('floor') && !estado.productos.length) tareas.push(cargarCarta());
    if (tiene('floor') || tiene('billing')) {
      tareas.push(cargarMesas().then(function () {
        if (tiene('billing')) { pintarListaCaja(); return cargarCuenta(); }
      }));
    }
    if (tiene('kitchen')) tareas.push(cargarCocina());
    return Promise.all(tareas.map(function (t) { return t.catch(noop); })).then(function () {
      if (tiene('billing')) pintarRecibo();
    });
  }

  api('api/auth.php').then(function (d) {
    if (d.empleado) entrar(d.empleado); else mostrarAuth();
  }).catch(function () {
    mostrarAuth();
  });
})();
