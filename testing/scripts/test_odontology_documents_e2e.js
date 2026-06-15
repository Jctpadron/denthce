/**
 * E2E — Pestaña "Imágenes y documentos" de HC Odontológica (local).
 * Flujo: token → paciente → subir radiografía (Media) → listar → servir archivo
 * → borrar → verificar que el registro y el archivo físico se eliminaron.
 * Uso: node testing/scripts/test_odontology_documents_e2e.js
 */
const KC = process.env.KC_BASE || 'http://localhost:8080';
const API = process.env.API_BASE || 'http://localhost:3000';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓ ' + m); pass++; };
const ko = (m) => { console.log('  ✗ ' + m); fail++; };

async function main() {
  // 1) Token (médico local)
  const tr = await fetch(`${KC}/realms/hce-realm/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=password&client_id=hce-app&username=doctor_julio&password=doctor_pass_2026',
  });
  if (!tr.ok) throw new Error('token ' + tr.status + ' ' + (await tr.text()));
  const token = (await tr.json()).access_token;
  const H = { Authorization: `Bearer ${token}` };
  ok('Token de doctor_julio obtenido');

  // 2) Paciente del tenant
  const pr = await fetch(`${API}/fhir/r4/Patient`, { headers: H });
  if (!pr.ok) throw new Error('listado pacientes ' + pr.status + ' ' + (await pr.text()));
  const pd = await pr.json();
  const list = Array.isArray(pd) ? pd : (pd.entry || []).map((e) => e.resource);
  if (!list.length) throw new Error('No hay pacientes en el tenant para probar');
  const pid = list[0].id;
  ok(`Paciente de prueba: ${pid}`);

  // 3) Subir radiografía (multipart)
  const fd = new FormData();
  fd.append('file', new Blob([PNG], { type: 'image/png' }), 'rx_e2e.png');
  fd.append('category', 'radiografia');
  fd.append('description', 'Radiografía e2e');
  const ur = await fetch(`${API}/odontology/patient/${pid}/upload`, { method: 'POST', headers: H, body: fd });
  if (!ur.ok) throw new Error('upload ' + ur.status + ' ' + (await ur.text()));
  const media = await ur.json();
  media.resourceType === 'Media' ? ok('Subida → FHIR Media') : ko('Esperaba resourceType Media, vino ' + media.resourceType);
  media.content?.url?.startsWith('/uploads/') ? ok('URL relativa: ' + media.content.url) : ko('URL inesperada: ' + media.content?.url);
  media._category === 'radiografia' ? ok('Categoría = radiografia') : ko('Categoría inesperada: ' + media._category);
  const resId = media.id;
  const fileUrl = media.content.url;

  // 4) Aparece en el listado del paciente
  const lr = await fetch(`${API}/odontology/patient/${pid}/resource`, { headers: H });
  const resources = await lr.json();
  resources.find((r) => r.id === resId) ? ok('Aparece en el listado del paciente') : ko('NO aparece en el listado');

  // 5) El archivo se sirve estáticamente
  const fr = await fetch(`${API}${fileUrl}`);
  const ct = fr.headers.get('content-type') || '';
  fr.ok && ct.includes('image/png') ? ok(`Archivo servido (HTTP ${fr.status}, ${ct})`) : ko(`Archivo no servido correctamente (HTTP ${fr.status}, ${ct})`);

  // 6) Borrar
  const dr = await fetch(`${API}/odontology/resource/${resId}`, { method: 'DELETE', headers: H });
  dr.ok ? ok(`Borrado (HTTP ${dr.status})`) : ko('No se pudo borrar (HTTP ' + dr.status + ')');

  // 7) Ya no está en el listado
  const lr2 = await fetch(`${API}/odontology/patient/${pid}/resource`, { headers: H });
  const resources2 = await lr2.json();
  resources2.find((r) => r.id === resId) ? ko('TODAVÍA aparece tras borrar') : ok('Ya no aparece en el listado');

  // 8) El archivo físico se eliminó
  const fr2 = await fetch(`${API}${fileUrl}`);
  fr2.status === 404 ? ok('Archivo físico eliminado (HTTP 404)') : ko('El archivo sigue accesible (HTTP ' + fr2.status + ')');

  console.log(`\n=== Resultado: ${pass} OK / ${fail} fallos ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('✗ E2E ABORTADO:', e.message); process.exit(1); });
