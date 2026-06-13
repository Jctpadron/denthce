const { OdontologyPdfService } = require('../../hce-backend/dist/odontology/odontology-pdf.service');

// Datos de paciente simulados
const mockPatient = {
  givenName: 'Juan',
  familyName: 'Pérez',
  dni: '12345678',
  birthDate: '1970-05-15',
  gender: 'male'
};

// Recursos simulados
const mockResources = [
  {
    resourceType: 'Coverage',
    obraSocial: 'PAMI',
    subscriberId: '12345-PAMI',
    beneficio: '8888',
    medicoCabecera: 'Dr. López',
    prestador: 'PREST-1',
    titular: true
  },
  {
    resourceType: 'Observation',
    code: { coding: [{ code: 'oral-status' }] },
    component: [
      { code: { text: 'placa' }, valueBoolean: true },
      { code: { text: 'periodontal' }, valueBoolean: false },
      { code: { text: 'lesiones' }, valueBoolean: false },
      { code: { text: 'diagnostico' }, valueString: 'Caries simple' },
      { code: { text: 'plan' }, valueString: 'Tratamiento conducto' }
    ]
  },
  {
    resourceType: 'Consent',
    text: 'Texto de consentimiento informado mock.',
    dateTime: new Date().toISOString(),
    matricula: 'MN 9999',
    firmaPaciente: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    firmaProfesional: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
];

(async () => {
  try {
    console.log('⏳ Probando OdontologyPdfService localmente...');
    const service = new OdontologyPdfService();
    const buffer = await service.generatePdf(mockPatient, mockResources);
    console.log(`✅ PDF generado con éxito. Tamaño: ${buffer.length} bytes`);
    
    const fs = require('fs');
    fs.writeFileSync('debug_output.pdf', buffer);
    console.log('💾 Guardado en debug_output.pdf');
  } catch (err) {
    console.error('💥 Error durante la generación:', err);
  }
})();
