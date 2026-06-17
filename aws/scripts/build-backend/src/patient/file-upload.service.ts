import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalResourceEntity } from './clinical-resource.entity';
import { PatientEntity } from './patient.entity';

export interface UploadedFileInfo {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
}

@Injectable()
export class FileUploadService {
  constructor(
    @InjectRepository(ClinicalResourceEntity)
    private readonly resourceRepository: Repository<ClinicalResourceEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
  ) {}

  async saveFileReference(
    patientId: string,
    fileInfo: UploadedFileInfo,
    description: string,
    tenantId: string,
  ): Promise<any> {
    // Verificar paciente
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado en tu consultorio.');
    }

    const isImage = fileInfo.mimetype.startsWith('image/');
    const resourceType = isImage ? 'Media' : 'DocumentReference';

    // URL pública del archivo servido desde /uploads
    const fileUrl = `http://localhost:3000/uploads/${fileInfo.filename}`;

    let payload: any;

    if (resourceType === 'Media') {
      // FHIR Media resource
      payload = {
        resourceType: 'Media',
        status: 'completed',
        subject: { reference: `Patient/${patientId}` },
        content: {
          contentType: fileInfo.mimetype,
          url: fileUrl,
          title: description || fileInfo.originalname,
          size: fileInfo.size,
        },
        note: [{ text: description || fileInfo.originalname }],
        _originalName: fileInfo.originalname,
        _fileName: fileInfo.filename,
        _uploadedAt: new Date().toISOString(),
      };
    } else {
      // FHIR DocumentReference resource
      payload = {
        resourceType: 'DocumentReference',
        status: 'current',
        subject: { reference: `Patient/${patientId}` },
        description: description || fileInfo.originalname,
        content: [
          {
            attachment: {
              contentType: fileInfo.mimetype,
              url: fileUrl,
              title: description || fileInfo.originalname,
              size: fileInfo.size,
            },
          },
        ],
        date: new Date().toISOString(),
        _originalName: fileInfo.originalname,
        _fileName: fileInfo.filename,
        _uploadedAt: new Date().toISOString(),
      };
    }

    const entity = new ClinicalResourceEntity();
    entity.patientId = patientId;
    entity.resourceType = resourceType;
    entity.tenantId = tenantId;
    entity.payload = payload;

    const saved = await this.resourceRepository.save(entity);
    saved.payload.id = saved.id;
    await this.resourceRepository.update(saved.id, { payload: saved.payload });

    return {
      resourceType,
      id: saved.id,
      url: fileUrl,
      contentType: fileInfo.mimetype,
      fileName: fileInfo.originalname,
      size: fileInfo.size,
      uploadedAt: payload._uploadedAt,
    };
  }
}
