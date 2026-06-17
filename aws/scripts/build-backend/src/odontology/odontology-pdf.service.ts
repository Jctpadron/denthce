import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PatientEntity } from '../patient/patient.entity';

// URL canónica de la extensión que distingue la capa del odontograma
const ODONTOGRAM_LAYER_URL = 'http://denthce.local/fhir/StructureDefinition/odontogram-layer';
const EVOLUTION_SYSTEM = 'http://denthce.local/evolution';

@Injectable()
export class OdontologyPdfService {
  /**
   * Genera el reporte en formato PDF de la Historia Clínica Odontológica (3 páginas)
   */
  async generatePdf(patient: PatientEntity, resources: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, compress: false });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      try {
        // --- PÁGINA 1: FICHA DE AFILIACIÓN, ODONTOGRAMA Y ESTADO BUCAL ---
        this.renderPage1(doc, patient, resources);

        // --- PÁGINA 2: ANAMNESIS Y CONSENTIMIENTO INFORMADO ---
        doc.addPage();
        this.renderPage2(doc, patient, resources);

        // --- PÁGINA 3: ANEXO DE EVOLUCIÓN Y TRATAMIENTOS ---
        doc.addPage();
        this.renderPage3(doc, patient, resources);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Dibuja el encabezado y el logo decorativo del reporte
   */
  private drawHeader(doc: typeof PDFDocument, title: string, pageNum: number) {
    // Logo decorativo
    doc.fillColor('#2962ff').fontSize(16).text('🦷', 40, 32, { continued: true });
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(' DentHCE', 55, 35);
    
    // Título secundario
    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
      .text('SISTEMA DE HISTORIA CLÍNICA ODONTOLÓGICA', 140, 38);

    // Número de página
    doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8)
      .text(`PÁGINA ${pageNum} DE 3`, 500, 38, { align: 'right' });

    // Línea divisoria superior
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, 52).lineTo(555, 52).stroke();

    // Título de la página
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(title, 40, 65);
    doc.moveDown(0.5);
  }

  /**
   * Dibuja una sección con un título con fondo sombreado
   */
  private drawSectionTitle(doc: typeof PDFDocument, title: string, y: number): number {
    doc.fillColor('#f1f5f9').rect(40, y, 515, 20).fill();
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9).text(title, 48, y + 6);
    return y + 26;
  }

  /**
   * PÁGINA 1: Encabezado, Datos de Afiliación, Odontograma y Estado Bucal General
   */
  private renderPage1(doc: typeof PDFDocument, patient: PatientEntity, resources: any[]) {
    this.drawHeader(doc, 'FICHA ODONTOLÓGICA DE AFILIACIÓN Y ODONTOGRAMA', 1);

    // 1. Datos Personales y Obra Social (Coverage)
    let y = 85;
    y = this.drawSectionTitle(doc, '1. DATOS DEL AFILIADO / COBERTURA', y);

    const coverage = resources.find((r) => r.resourceType === 'Coverage') || {};
    const patientName = `${patient.givenName} ${patient.familyName}`;
    const birthStr = patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-AR') : 'N/D';

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    
    // Fila 1 de datos
    doc.text('Nombre y Apellido:', 45, y).font('Helvetica').text(patientName, 140, y);
    doc.font('Helvetica-Bold').text('DNI:', 320, y).font('Helvetica').text(patient.dni || 'N/D', 350, y);
    doc.font('Helvetica-Bold').text('Fecha Nac.:', 440, y).font('Helvetica').text(birthStr, 500, y);
    
    y += 16;
    // Fila 2 de datos
    doc.font('Helvetica-Bold').text('Obra Social:', 45, y).font('Helvetica').text(coverage.obraSocial || 'Particular', 110, y);
    doc.font('Helvetica-Bold').text('Nº Afiliado:', 180, y).font('Helvetica').text(coverage.subscriberId || 'N/D', 240, y);
    doc.font('Helvetica-Bold').text('Nº Beneficio:', 340, y).font('Helvetica').text(coverage.beneficio || 'N/D', 400, y);
    
    y += 16;
    // Fila 3 de datos
    doc.font('Helvetica-Bold').text('Médico Cabecera:', 45, y).font('Helvetica').text(coverage.medicoCabecera || 'N/D', 130, y);
    doc.font('Helvetica-Bold').text('Cód. Prestador:', 320, y).font('Helvetica').text(coverage.prestador || 'N/D', 390, y);
    doc.font('Helvetica-Bold').text('Titular:', 470, y).font('Helvetica').text(coverage.titular === false ? `No (${coverage.parentesco || 'familiar'})` : 'Sí', 510, y);

    y += 24;

    // 2. Odontograma
    y = this.drawSectionTitle(doc, '2. ODONTOGRAMA CLÍNICO', y);

    // Dibujamos las dos arcadas dentales
    y = this.drawVisualOdontogram(doc, resources, y + 10);

    y += 15;

    // Leyenda del odontograma
    doc.lineWidth(1).strokeColor('#e2e8f0').rect(45, y, 505, 30).stroke();
    
    // Leyenda color rojo (existente)
    doc.fillColor('#ef4444').rect(60, y + 10, 10, 10).fill();
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8).text('Tratamiento Existente / Hallazgo (Rojo)', 75, y + 11);

    // Leyenda color azul (planificado)
    doc.fillColor('#2962ff').rect(260, y + 10, 10, 10).fill();
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8).text('Tratamiento Requerido / Planificado (Azul)', 275, y + 11);

    // Leyenda de extracción
    doc.font('Helvetica-Bold').fillColor('#ef4444').text('X', 465, y + 10).fillColor('#334155').font('Helvetica').text('Extracción', 478, y + 11);

    y += 45;

    // 3. Estado Bucal General (Observation)
    y = this.drawSectionTitle(doc, '3. ESTADO BUCAL GENERAL Y DIAGNÓSTICO', y);

    const obs = resources.find((r) => r.resourceType === 'Observation' && r.code?.coding?.[0]?.code === 'oral-status') || {};
    const comp = (key: string) => (obs.component || []).find((c: any) => c.code?.text === key);

    const placa = comp('placa')?.valueBoolean ? 'SÍ' : 'NO';
    const periodontal = comp('periodontal')?.valueBoolean ? 'SÍ' : 'NO';
    const diagnostico = comp('diagnostico')?.valueString || 'Sin diagnóstico registrado.';
    const observaciones = comp('observaciones')?.valueString || '';

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    doc.text('Placa Bacteriana:', 45, y).font('Helvetica').text(placa, 140, y);
    doc.font('Helvetica-Bold').text('Enf. Periodontal:', 210, y).font('Helvetica').text(periodontal, 290, y);

    y += 16;

    // Soft tissue examination
    const REGIONES = [
      { key: 'labios', label: 'Labios' },
      { key: 'mucosa_yugal', label: 'Mucosa yugal' },
      { key: 'encia', label: 'Encía' },
      { key: 'lengua_dorso', label: 'Lengua (dorso)' },
      { key: 'lengua_bordes', label: 'Lengua (bordes)' },
      { key: 'lengua_ventral', label: 'Lengua (ventral)' },
      { key: 'paladar_duro', label: 'Paladar duro' },
      { key: 'paladar_blando', label: 'Paladar blando' },
      { key: 'piso_boca', label: 'Piso de boca' },
      { key: 'orofaringe', label: 'Orofaringe' },
    ];

    let hallazgos: string[] = [];
    REGIONES.forEach(r => {
      const val = comp(`tejidos_${r.key}`)?.valueString;
      if (val && val !== 'normal') hallazgos.push(`${r.label}: ${val}`);
    });

    if (hallazgos.length > 0) {
      doc.font('Helvetica-Bold').fontSize(8).text('Examen de Tejidos Blandos:', 45, y);
      y += 11;
      hallazgos.forEach(h => {
        doc.font('Helvetica').fontSize(7.5).text(`• ${h}`, 50, y, { width: 500 });
        y += doc.heightOfString(`• ${h}`, { width: 500 }) + 3;
      });
    } else {
      doc.font('Helvetica').fontSize(8).text('Tejidos blandos: Sin hallazgos significativos.', 45, y);
      y += 12;
    }

    y += 4;
    doc.font('Helvetica-Bold').fontSize(8.5).text('Diagnóstico Presuntivo:', 45, y);
    y += 11;
    doc.font('Helvetica').fontSize(8).text(diagnostico, 45, y, { width: 505, align: 'justify' });
    y += Math.max(16, doc.heightOfString(diagnostico, { width: 505 }) + 5);

    // Structured treatment plan
    const planItemsRaw = comp('plan_items')?.valueString;
    let planItems: any[] = [];
    if (planItemsRaw) {
      try { planItems = JSON.parse(planItemsRaw); } catch { planItems = []; }
    }

    doc.font('Helvetica-Bold').fontSize(8.5).text('Plan de Tratamiento:', 45, y);
    y += 11;

    if (planItems.length === 0) {
      doc.font('Helvetica').fontSize(8).text('Sin procedimientos planificados.', 45, y, { width: 505 });
      y += 14;
    } else {
      // Table header
      doc.fillColor('#f8fafc').rect(45, y, 505, 16).fill();
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7.5);
      doc.text('PROCEDIMIENTO', 50, y + 4, { width: 200 });
      doc.text('PRIORIDAD', 280, y + 4, { width: 80 });
      doc.text('ESTADO', 360, y + 4, { width: 80 });
      doc.text('PIEZA', 450, y + 4, { width: 40 });
      y += 16;

      planItems.forEach((item: any) => {
        const rowH = Math.max(16, doc.heightOfString(item.descripcion || '', { width: 200 }) + 6);
        doc.fillColor('#0f172a').font('Helvetica').fontSize(7.5);
        doc.text(item.descripcion || '—', 50, y + 3, { width: 200 });
        doc.fillColor('#64748b').text(item.prioridad || '—', 280, y + 3, { width: 80 });
        doc.fillColor('#0f172a').text(item.estado || '—', 360, y + 3, { width: 80 });
        doc.text(item.pieza || '—', 450, y + 3, { width: 40 });
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, y + rowH).lineTo(550, y + rowH).stroke();
        y += rowH;
      });
    }

    if (observaciones) {
      y += 4;
      doc.font('Helvetica-Bold').fontSize(8.5).text('Observaciones:', 45, y);
      y += 11;
      doc.font('Helvetica').fontSize(8).text(observaciones, 45, y, { width: 505, align: 'justify' });
    }
  }

  /**
   * PÁGINA 2: Anamnesis y Consentimiento Informado
   */
  private renderPage2(doc: typeof PDFDocument, patient: PatientEntity, resources: any[]) {
    this.drawHeader(doc, 'ANAMNESIS MÉDICA Y CONSENTIMIENTO INFORMADO', 2);

    let y = 85;
    y = this.drawSectionTitle(doc, '4. ANAMNESIS MÉDICA Y CUESTIONARIO', y);

    const qr = resources.find((r) => r.resourceType === 'QuestionnaireResponse') || {};
    const qrItems = qr.item || [];
    const getItemVal = (linkId: string, type: 'bool' | 'str' | 'int') => {
      const it = qrItems.find((i: any) => i.linkId === linkId);
      if (!it) return null;
      const ans = it.answer?.[0] || {};
      if (type === 'bool') return ans.valueBoolean;
      if (type === 'str') return ans.valueString;
      if (type === 'int') return ans.valueInteger;
      return null;
    };
    const getItemDetail = (linkId: string) => {
      const it = qrItems.find((i: any) => i.linkId === linkId);
      if (!it || !it.answer || it.answer.length < 2) return '';
      return it.answer[1].valueString || '';
    };

    // Preguntas estructuradas
    const questions = [
      { id: 'enfermedad', label: '¿Sufre alguna enfermedad?' },
      { id: 'tratamiento', label: '¿Realiza tratamiento médico?' },
      { id: 'medicacion', label: '¿Consume medicación?' },
      { id: 'alergia', label: '¿Tiene alergias a drogas?' },
      { id: 'diabetes', label: '¿Diabetes?' },
      { id: 'cardiacos', label: '¿Problemas cardíacos?' },
      { id: 'hta', label: '¿Hipertensión arterial (HTA)?' },
      { id: 'anticoagulantes', label: '¿Toma anticoagulantes / aspirina?' },
      { id: 'operado', label: '¿Fue operado quirúrgicamente?' },
    ];

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);

    // Dibujamos una cuadrícula compacta de 3x3 para las preguntas
    let qx = 45;
    let qy = y;
    questions.forEach((q, idx) => {
      const val = getItemVal(q.id, 'bool');
      const textVal = val === true ? 'SÍ' : val === false ? 'NO' : 'N/R';
      const detail = val === true ? getItemDetail(q.id) : '';

      doc.font('Helvetica-Bold').text(q.label, qx, qy, { width: 130 });
      doc.font('Helvetica').fillColor(val === true ? '#ef4444' : '#0f172a')
        .text(textVal + (detail ? ` (${detail})` : ''), qx + 130, qy, { width: 45 });
      doc.fillColor('#0f172a'); // reset

      if ((idx + 1) % 3 === 0) {
        qx = 45;
        qy += 22;
      } else {
        qx += 175;
      }
    });

    y = qy + 10;
    
    // Hábitos de higiene y fuma
    const fuma = getItemVal('fuma', 'bool');
    const cigarrillos = fuma === true ? (qrItems.find((i: any) => i.linkId === 'fuma')?.answer?.[1]?.valueInteger || '') : '';
    const cepillados = getItemVal('cepillados', 'int') ?? 'N/R';
    const azucar = getItemVal('azucar', 'int') ?? 'N/R';
    const motivo = getItemVal('motivo', 'str') || '—';

    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('Fuma:', 45, y).font('Helvetica').text(fuma === true ? `SÍ (${cigarrillos} por día)` : fuma === false ? 'NO' : 'N/R', 85, y);
    doc.font('Helvetica-Bold').text('Cepillados diarios:', 200, y).font('Helvetica').text(String(cepillados), 295, y);
    doc.font('Helvetica-Bold').text('Momentos azúcar:', 360, y).font('Helvetica').text(String(azucar), 445, y);

    y += 15;
    doc.font('Helvetica-Bold').text('Motivo de consulta:', 45, y).font('Helvetica').text(motivo, 135, y);

    y += 30;

    // 5. Consentimiento Informado
    y = this.drawSectionTitle(doc, '5. CONSENTIMIENTO INFORMADO DEL PACIENTE', y);

    const consent = resources.find((r) => r.resourceType === 'Consent') || {};
    const consentText = consent.text || 
      'He comprendido todas las explicaciones que se me han facilitado en lenguaje claro y sencillo, ' +
      'he podido realizar todas las observaciones y se me han aclarado todas las dudas; por lo que estoy ' +
      'completamente de acuerdo con el tratamiento odontológico que se me va a realizar, otorgando mi ' +
      'consentimiento para rehabilitar mi salud bucodental según el plan propuesto por el profesional.';
    
    const firmadoEl = consent.dateTime ? new Date(consent.dateTime).toLocaleString('es-AR') : 'Sin firma';

    // Recuadro del texto legal del consentimiento
    doc.lineWidth(1).strokeColor('#cbd5e1').rect(45, y, 505, 75).stroke();
    doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
      .text(consentText, 52, y + 8, { width: 490, align: 'justify', lineGap: 3 });

    y += 85;

    // Registro de fecha
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8)
      .text(`Consentimiento registrado el: ${firmadoEl}`, 45, y);

    y += 18;

    // Área de Firmas
    doc.lineWidth(1).strokeColor('#e2e8f0').rect(45, y, 505, 95).stroke();
    
    // Firma del Paciente (decodificar base64 si existe)
    const sigPaciente = consent.firmaPaciente || (qr.extension || []).find((e: any) => e.url === 'http://denthce.local/fhir/StructureDefinition/patient-signature')?.valueString;
    this.drawSignature(doc, sigPaciente, 65, y + 10, 'Firma del Paciente / Tutor');

    // Firma del Profesional (sello)
    const sigProf = consent.firmaProfesional;
    const matricula = consent.matricula || 'N/D';
    this.drawSignature(doc, sigProf, 340, y + 10, `Firma y Sello del Profesional\nMatrícula: ${matricula}`);
  }

  /**
   * PÁGINA 3: Anexo de Evolución y Tratamientos
   */
  private renderPage3(doc: typeof PDFDocument, patient: PatientEntity, resources: any[]) {
    this.drawHeader(doc, 'ANEXO DE EVOLUCIÓN CLÍNICA Y CONFORMIDAD', 3);

    let y = 85;
    y = this.drawSectionTitle(doc, '6. EVOLUCIÓN CLÍNICA DE TRATAMIENTOS', y);

    const evolutions = resources
      .filter((r) => r.resourceType === 'Procedure' && r.code?.coding?.[0]?.system === EVOLUTION_SYSTEM)
      .sort((a, b) => (a.performedDateTime || '').localeCompare(b.performedDateTime || ''));

    // Tabla de Evoluciones
    // Encabezado de la tabla
    doc.fillColor('#f8fafc').rect(45, y, 505, 20).fill();
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
    doc.text('FECHA', 55, y + 6);
    doc.text('TRATAMIENTO REALIZADO Y DETALLES CLÍNICOS', 140, y + 6);
    doc.text('CONFORMIDAD DEL AFILIADO', 420, y + 6);

    doc.strokeColor('#cbd5e1').lineWidth(1.5).moveTo(45, y + 20).lineTo(550, y + 20).stroke();

    y += 20;

    doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
    
    if (evolutions.length === 0) {
      doc.text('No hay entradas de evolución clínica registradas para este paciente.', 55, y + 15);
      y += 30;
    } else {
      evolutions.forEach((ev) => {
        const dateStr = ev.performedDateTime ? new Date(ev.performedDateTime).toLocaleDateString('es-AR') : '—';
        const txt = ev.code?.text || '—';
        const conf = ev.conformidad ? 'SÍ (CONFORME)' : 'NO CONFORME / PENDIENTE';

        const rowHeight = Math.max(20, doc.heightOfString(txt, { width: 260 }) + 10);

        // Validar si la tabla se desborda
        if (y + rowHeight > 700) {
          doc.addPage();
          this.drawHeader(doc, 'ANEXO DE EVOLUCIÓN CLÍNICA Y CONFORMIDAD (CONT.)', 3);
          y = 85;
          // Redibujar encabezado de tabla
          doc.fillColor('#f8fafc').rect(45, y, 505, 20).fill();
          doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
          doc.text('FECHA', 55, y + 6);
          doc.text('TRATAMIENTO REALIZADO Y DETALLES CLÍNICOS', 140, y + 6);
          doc.text('CONFORMIDAD DEL AFILIADO', 420, y + 6);
          doc.strokeColor('#cbd5e1').lineWidth(1.5).moveTo(45, y + 20).lineTo(550, y + 20).stroke();
          y += 20;
          doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
        }

        // Imprimir fila
        doc.text(dateStr, 55, y + 6);
        doc.text(txt, 140, y + 6, { width: 260 });
        
        doc.font('Helvetica-Bold').fillColor(ev.conformidad ? '#10b981' : '#ef4444')
          .text(conf, 420, y + 6);
        doc.fillColor('#0f172a').font('Helvetica'); // reset

        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, y + rowHeight).lineTo(550, y + rowHeight).stroke();
        y += rowHeight;
      });
    }

    y += 40;

    // Espacio de firmas al pie del anexo
    doc.lineWidth(1).strokeColor('#cbd5e1').rect(45, y, 505, 80).stroke();
    doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
      .text('Aclaración de conformidad: Las prestaciones descritas arriba fueron recibidas de conformidad en las fechas indicadas, autorizando su cobro correspondiente a la obra social.', 52, y + 8, { width: 490 });

    doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(4, { space: 4 }).moveTo(160, y + 60).lineTo(280, y + 60).stroke().undash();
    doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(4, { space: 4 }).moveTo(370, y + 60).lineTo(490, y + 60).stroke().undash();

    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.5);
    doc.text('Firma y Aclaración Paciente', 165, y + 65);
    doc.text('Firma y Sello del Profesional', 380, y + 65);
  }

  /**
   * Decodifica una firma en base64 e intenta insertarla como imagen en el PDF.
   * Si no existe, dibuja un recuadro punteado.
   */
  private drawSignature(doc: typeof PDFDocument, signatureStr: string | null, x: number, y: number, label: string) {
    // Línea o recuadro de firma
    doc.strokeColor('#94a3b8').lineWidth(0.5).dash(2, { space: 2 }).rect(x, y, 150, 45).stroke().undash();

    if (signatureStr && signatureStr.includes('data:image')) {
      try {
        const base64Data = signatureStr.split(',')[1] || signatureStr;
        const buffer = Buffer.from(base64Data, 'base64');
        doc.image(buffer, x + 5, y + 5, { width: 140, height: 35 });
      } catch (err) {
        doc.fillColor('#ef4444').font('Helvetica').fontSize(7).text('[Error de firma]', x + 45, y + 20);
      }
    } else {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7).text('(Sin firma digitalizada)', x + 38, y + 20);
    }

    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text(label, x, y + 52, { align: 'center', width: 150 });
  }

  /**
   * Dibuja el odontograma vectorial detallado (arcada superior e inferior)
   */
  private drawVisualOdontogram(doc: typeof PDFDocument, resources: any[], y: number): number {
    const startX = 65;
    const itemSpacing = 30; // espacio entre piezas

    const upperTeeth = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
    const lowerTeeth = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

    // Buscar recursos de odontología (Condition/Procedure con bodySite)
    const odontoResources = resources.filter(
      (r) =>
        (r.resourceType === 'Condition' || r.resourceType === 'Procedure') &&
        r.bodySite?.coding?.[0]?.code
    );

    // Dibujar Arcada Superior
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8.5).text('Arcada Superior', 45, y - 8);
    upperTeeth.forEach((toothCode, idx) => {
      const cx = startX + idx * itemSpacing;
      this.drawTooth(doc, toothCode, cx, y, odontoResources);
    });

    y += 50;

    // Dibujar Arcada Inferior
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8.5).text('Arcada Inferior', 45, y - 8);
    lowerTeeth.forEach((toothCode, idx) => {
      const cx = startX + idx * itemSpacing;
      this.drawTooth(doc, toothCode, cx, y, odontoResources);
    });

    return y + 20;
  }

  /**
   * Dibuja un diente individual de forma vectorial (cuadrado dividido en 5 sectores)
   */
  private drawTooth(doc: typeof PDFDocument, toothCode: string, cx: number, cy: number, toothResources: any[]) {
    // Tamaño de la pieza
    const r = 9;   // radio exterior (ancho total = 18)
    const ri = 4.5; // radio interior (ancho total = 9)

    // Filtrar recursos de esta pieza
    const resThisTooth = toothResources.filter((r) => r.bodySite.coding[0].code === toothCode);

    // Deducir estado del diente completo
    const isAusente = resThisTooth.some((r) => r.code?.coding?.[0]?.code === '272673000'); // SNOMED ausente
    const extraccionResource = resThisTooth.find((r) => r.code?.coding?.[0]?.code === '65546002'); // SNOMED extraccion
    const coronaResource = resThisTooth.find((r) => r.code?.coding?.[0]?.code === '172922005'); // SNOMED corona
    const endoResource = resThisTooth.find((r) => r.code?.coding?.[0]?.code === '234961008' || r.code?.coding?.[0]?.code === '42425007');

    // Obtener capas
    const getLayer = (payload: any) => {
      const ext = (payload?.extension || []).find((e: any) => e.url === ODONTOGRAM_LAYER_URL);
      return ext?.valueCode === 'planned' ? 'planned' : 'existing';
    };

    // Color del diente completo
    const getLayerColor = (res: any) => (getLayer(res) === 'planned' ? '#2962ff' : '#ef4444');

    // Dibujar número del diente
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.5).text(toothCode, cx - 8, cy - 20, { align: 'center', width: 16 });

    // Si está ausente, dibujamos una diagonal gris y no dibujamos caras
    if (isAusente) {
      doc.strokeColor('#94a3b8').lineWidth(1).moveTo(cx - 8, cy - 8).lineTo(cx + 8, cy + 8).stroke();
      doc.strokeColor('#94a3b8').lineWidth(1).moveTo(cx + 8, cy - 8).lineTo(cx - 8, cy + 8).stroke();
      return;
    }

    // Geometría del diente
    // Coordenadas exteriores
    const xTL = cx - r, yTL = cy - r;
    const xTR = cx + r, yTR = cy - r;
    const xBR = cx + r, yBR = cy + r;
    const xBL = cx - r, yBL = cy + r;

    // Coordenadas interiores (oclusal)
    const xiTL = cx - ri, yiTL = cy - ri;
    const xiTR = cx + ri, yiTR = cy - ri;
    const xiBR = cx + ri, yiBR = cy + ri;
    const xiBL = cx - ri, yiBL = cy + ri;

    // Polígonos de las 5 caras
    const facePolys: Record<string, { pts: [number, number][]; name: string }> = {
      V: { pts: [[xTL, yTL], [xTR, yTR], [xiTR, yiTR], [xiTL, yiTL]], name: 'Vestibular' },
      L: { pts: [[xiBL, yiBL], [xiBR, yiBR], [xBR, yBR], [xBL, yBL]], name: 'Palatina/Lingual' },
      O: { pts: [[xiTL, yiTL], [xiTR, yiTR], [xiBR, yiBR], [xiBL, yiBL]], name: 'Oclusal' },
      // Izquierda y Derecha cambian Mesial/Distal según el cuadrante
      // Cuadrantes 1 y 4 (izq del observador): Izquierda es Distal, Derecha es Mesial
      // Cuadrantes 2 y 3 (der del observador): Izquierda es Mesial, Derecha es Distal
      // Para consistencia con el backend mapeamos a códigos de cara: 'D' (Izquierda) y 'M' (Derecha) o viceversa.
      // Del frontend: la cara izquierda se mapea a 'D' (cuadrantes 1,4) y 'M' (cuadrantes 2,3).
      izq: { pts: [[xTL, yTL], [xiTL, yiTL], [xiBL, yiBL], [xBL, yBL]], name: 'Izquierda' },
      der: { pts: [[xiTR, yiTR], [xTR, yTR], [xBR, yBR], [xiBR, yiBR]], name: 'Derecha' },
    };

    // Identificar qué cara de la BD corresponde a cada una
    const isCuadranteDerecho = toothCode.startsWith('1') || toothCode.startsWith('4');
    const faceMapping: Record<string, string> = {
      V: 'V',
      L: 'L',
      O: 'O',
      izq: isCuadranteDerecho ? 'D' : 'M',
      der: isCuadranteDerecho ? 'M' : 'D',
    };

    // Dibujar cada cara
    Object.keys(facePolys).forEach((polyKey) => {
      const dbFaceCode = faceMapping[polyKey];
      const poly = facePolys[polyKey];
      const resFace = resThisTooth.find((r) => r.bodySite.coding[1]?.code === dbFaceCode);

      doc.lineWidth(0.5).strokeColor('#94a3b8');

      if (resFace) {
        const color = getLayerColor(resFace);
        const snomed = resFace.code?.coding?.[0]?.code;

        if (snomed === '23450005' || snomed === '80967001') {
          // Restauración / Caries -> Relleno completo
          doc.fillColor(color);
          this.drawPolygon(doc, poly.pts).fillAndStroke();
        } else if (snomed === '60116006') {
          // Incrustación -> Relleno gris claro + rayas
          doc.fillColor('#f1f5f9');
          this.drawPolygon(doc, poly.pts).fillAndStroke();
          doc.strokeColor(color).lineWidth(1);
          // Dibujar líneas internas horizontales
          const midY = (poly.pts[0][1] + poly.pts[2][1]) / 2;
          doc.moveTo(poly.pts[0][0] + 2, midY).lineTo(poly.pts[1][0] - 2, midY).stroke();
        } else if (snomed === '418705001') {
          // Sellante -> Letra S
          doc.fillColor('#f8fafc');
          this.drawPolygon(doc, poly.pts).fillAndStroke();
          doc.fillColor(color).font('Helvetica-Bold').fontSize(6).text('S', cx - 2, cy - 3);
        } else {
          // Otros -> Relleno simple
          doc.fillColor(color);
          this.drawPolygon(doc, poly.pts).fillAndStroke();
        }
      } else {
        doc.fillColor('#ffffff');
        this.drawPolygon(doc, poly.pts).fillAndStroke();
      }
    });

    // Superponer efectos de pieza completa
    if (extraccionResource) {
      // Extracción -> Gran X
      const color = getLayerColor(extraccionResource);
      doc.strokeColor(color).lineWidth(2);
      doc.moveTo(cx - r - 2, cy - r - 2).lineTo(cx + r + 2, cy + r + 2).stroke();
      doc.moveTo(cx + r + 2, cy - r - 2).lineTo(cx - r - 2, cy + r + 2).stroke();
    }

    if (coronaResource) {
      // Corona -> Círculo envolvente
      const color = getLayerColor(coronaResource);
      doc.strokeColor(color).lineWidth(1.5);
      doc.circle(cx, cy, r + 4).stroke();
    }

    if (endoResource) {
      // Endodoncia -> Conductos representados por líneas verticales centrales
      const color = getLayerColor(endoResource);
      doc.strokeColor(color).lineWidth(1.5);
      doc.moveTo(cx, cy - r).lineTo(cx, cy + r).stroke();
    }
  }

  private drawPolygon(doc: typeof PDFDocument, points: [number, number][]): typeof PDFDocument {
    if (points.length === 0) return doc;
    doc.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      doc.lineTo(points[i][0], points[i][1]);
    }
    doc.closePath();
    return doc;
  }
}
