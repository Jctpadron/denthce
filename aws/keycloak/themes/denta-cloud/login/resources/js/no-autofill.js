/**
 * Denta Cloud — evita el autocompletado de credenciales en el login.
 * Apropiado para consultorios con computadoras compartidas: el formulario
 * nunca debe traer usuario/contraseña por defecto.
 *
 * No bloquea el campo (nada de readonly) para no arriesgar el ingreso:
 * - usuario  -> autocomplete="off"
 * - contraseña -> autocomplete="new-password" (Chrome no rellena la guardada)
 * - se limpian los valores al cargar.
 */
(function () {
  function apply(clear) {
    var u = document.getElementById('username');
    var p = document.getElementById('password');
    var f = document.getElementById('kc-form-login');
    if (u) { u.setAttribute('autocomplete', 'off'); if (clear) u.value = ''; }
    if (p) { p.setAttribute('autocomplete', 'new-password'); if (clear) p.value = ''; }
    if (f) f.setAttribute('autocomplete', 'off');
  }
  var run = function () { apply(true); };
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
  // Reaplicar (solo atributos, sin limpiar) por si el navegador autocompleta tarde.
  window.addEventListener('load', function () { setTimeout(function () { apply(false); }, 200); });
})();
