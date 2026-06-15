// ============================================================================
// lib.js — utilidades compartidas para el testing total QA (PRODUCCIÓN)
// Entorno: api.systia.ar / auth.systia.ar — máxima prudencia.
// SALVAGUARDA: todos los pacientes de prueba => DNI 90000000-90000250 + apellido " QA-TEST".
// ============================================================================

const API = 'https://api.systia.ar';
const TOKEN_URL = 'https://auth.systia.ar/realms/hce-realm/protocol/openid-connect/token';
const CREDS = { grant_type: 'password', client_id: 'hce-app', username: 'doctor_julio', password: 'doctor_pass_2026' };

const QA_SUFFIX = ' QA-TEST';
const DNI_BASE = 90000000;   // primer DNI reservado
const DNI_MAX = 90000250;    // último DNI reservado (inclusive)

let _token = null;
let _tokenExp = 0; // epoch ms

async function getToken() {
  const now = Date.now();
  // Renovar 45s antes de expirar
  if (_token && now < _tokenExp - 45000) return _token;
  const body = new URLSearchParams(CREDS).toString();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`No se pudo obtener token: HTTP ${res.status} ${await res.text()}`);
  const j = await res.json();
  _token = j.access_token;
  _tokenExp = now + (j.expires_in || 300) * 1000;
  return _token;
}

// fetch con auth, reintento ante 401 (token vencido) y medición de tiempo
async function apiFetch(method, path, body) {
  const doCall = async () => {
    const token = await getToken();
    const t0 = Date.now();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - t0;
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, ok: res.ok, data, ms };
  };
  let r = await doCall();
  if (r.status === 401) { _token = null; r = await doCall(); } // forzar renovación
  return r;
}

// --- Datos argentinos realistas ---
const NOMBRES_M = ['Juan','Carlos','José','Luis','Jorge','Roberto','Miguel','Héctor','Ricardo','Daniel','Pablo','Sergio','Marcelo','Gustavo','Fernando','Diego','Martín','Alejandro','Raúl','Oscar','Eduardo','Rubén','Néstor','Mario','Walter'];
const NOMBRES_F = ['María','Ana','Laura','Silvia','Patricia','Mónica','Graciela','Sandra','Claudia','Marta','Susana','Beatriz','Norma','Liliana','Gabriela','Verónica','Carolina','Florencia','Valentina','Sofía','Lucía','Camila','Rosa','Elena','Cristina'];
const APELLIDOS = ['González','Rodríguez','Gómez','Fernández','López','Díaz','Martínez','Pérez','García','Sánchez','Romero','Sosa','Torres','Álvarez','Ruiz','Ramírez','Flores','Acosta','Benítez','Medina','Suárez','Herrera','Aguirre','Pereyra','Gutiérrez','Molina','Castro','Rojas','Ortiz','Núñez'];
const CIUDADES = ['Buenos Aires','La Plata','Córdoba','Rosario','Mendoza','Mar del Plata','Quilmes','Lanús','Avellaneda','San Isidro','Morón','Tigre','Bahía Blanca','Tandil','Neuquén'];
const PROVINCIAS = ['Buenos Aires','CABA','Córdoba','Santa Fe','Mendoza','Neuquén'];
const COBERTURAS = ['OSDE','Swiss Medical','Galeno','Medifé','PAMI','IOMA','OSECAC','Particular','Sancor Salud','Omint'];

// Patologías odontológicas variadas (diagnóstico clínico textual + SNOMED aproximado)
const PATOLOGIAS = [
  { code: 'caries', text: 'Caries dental activa', snomed: '80967001' },
  { code: 'gingivitis', text: 'Gingivitis', snomed: '66383009' },
  { code: 'periodontitis', text: 'Periodontitis crónica', snomed: '5165002' },
  { code: 'absceso', text: 'Absceso periapical', snomed: '109563002' },
  { code: 'bruxismo', text: 'Bruxismo', snomed: '78675008' },
  { code: 'maloclusion', text: 'Maloclusión dentaria', snomed: '6531000' },
  { code: 'pulpitis', text: 'Pulpitis irreversible', snomed: '70036007' },
  { code: 'pericoronaritis', text: 'Pericoronaritis', snomed: '52359008' },
  { code: 'gingivorragia', text: 'Gingivorragia', snomed: '162576005' },
  { code: 'edentulismo', text: 'Edentulismo parcial', snomed: '234947007' },
];

const ALERGIAS = [
  { allergen: 'Penicilina', reaction: 'Erupción cutánea', criticality: 'high' },
  { allergen: 'AINES / Ibuprofeno', reaction: 'Broncoespasmo', criticality: 'high' },
  { allergen: 'Látex', reaction: 'Dermatitis de contacto', criticality: 'low' },
  { allergen: 'Anestésicos locales (Lidocaína)', reaction: 'Edema', criticality: 'high' },
  { allergen: 'Aspirina', reaction: 'Urticaria', criticality: 'low' },
  { allergen: 'Sulfas', reaction: 'Rash', criticality: 'low' },
];

const ANTECEDENTES_PERS = ['Hipertensión arterial','Diabetes Tipo 2','Hipotiroidismo','Asma','Gastritis crónica','Tabaquismo'];
const ANTECEDENTES_FAM = ['Diabetes (madre)','HTA (padre)','Cáncer de mama (familiar)','Cardiopatía isquémica (padre)'];

const FARMACOS = [
  { code: 'AMX-500', name: 'Amoxicilina 500 mg', dosage: '1 comprimido cada 8 horas', freq: 8, dose: 1, dur: 7 },
  { code: 'IBU-600', name: 'Ibuprofeno 600 mg', dosage: '1 comprimido cada 8 horas con las comidas', freq: 8, dose: 1, dur: 5 },
  { code: 'PAR-500', name: 'Paracetamol 500 mg', dosage: '1 comprimido cada 6 horas si hay dolor', freq: 6, dose: 1, dur: 3 },
  { code: 'CHX-012', name: 'Clorhexidina Colutorio 0.12%', dosage: 'Enjuague bucal 2 veces al día', freq: 12, dose: 1, dur: 14 },
  { code: 'CLN-300', name: 'Clindamicina 300 mg', dosage: '1 comprimido cada 8 horas', freq: 8, dose: 1, dur: 7 },
];

const SERVICIOS_TURNO = ['Consulta de control','Limpieza dental','Endodoncia','Extracción','Restauración','Urgencia odontológica','Ortodoncia'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Genera fecha de nacimiento para una edad dada
function birthDateForAge(age) {
  const y = new Date().getFullYear() - age;
  const m = String(randInt(1, 12)).padStart(2, '0');
  const d = String(randInt(1, 28)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Construye un recurso FHIR Patient con la salvaguarda QA
function buildPatient(index) {
  const dni = String(DNI_BASE + index); // secuencial dentro del rango reservado
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const given = gender === 'male' ? pick(NOMBRES_M) : pick(NOMBRES_F);
  const apellidoBase = pick(APELLIDOS);
  const family = `${apellidoBase}${QA_SUFFIX}`; // salvaguarda obligatoria
  const age = randInt(6, 88);
  const cobertura = pick(COBERTURAS);
  return {
    resource: {
      resourceType: 'Patient',
      active: true,
      identifier: [{ system: 'http://hospital.gov/dni', value: dni }],
      name: [{ family, given: [given] }],
      gender,
      birthDate: birthDateForAge(age),
      telecom: [
        { system: 'phone', value: `11${randInt(30000000, 69999999)}`, use: 'mobile' },
        { system: 'email', value: `qa.test.${dni}@example.test` },
      ],
      address: [{
        use: 'home',
        line: [`Calle ${pick(APELLIDOS)} ${randInt(100, 4999)}`],
        city: pick(CIUDADES),
        state: pick(PROVINCIAS),
        country: 'Argentina',
      }],
      extension: [
        { url: 'http://hospital.gov/fhir/StructureDefinition/coverage', valueString: cobertura },
      ],
    },
    meta: { dni, gender, age, given, family, cobertura },
  };
}

module.exports = {
  API, getToken, apiFetch,
  QA_SUFFIX, DNI_BASE, DNI_MAX,
  PATOLOGIAS, ALERGIAS, ANTECEDENTES_PERS, ANTECEDENTES_FAM, FARMACOS, SERVICIOS_TURNO,
  pick, randInt, buildPatient, birthDateForAge,
};
