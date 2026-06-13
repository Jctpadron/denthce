import axios from 'axios';
import keycloak from '../../utils/keycloak-config';

const API = import.meta.env.VITE_API_URL;
const auth = () => ({ headers: { Authorization: `Bearer ${keycloak.token}` } });

export interface SaMetrics {
  totalClinics: number;
  activeClinics: number;
  totalPatients: number;
  totalAppointments: number;
}

export interface SaClinic {
  tenantId: string;
  clinicName: string;
  specialty?: string;
  plan: string;
  isActive: boolean;
  modules: string[];
}

export interface SaModule {
  key: string;
  name: string;
  description: string | null;
  price: number | null;
  available: boolean;
  isBase: boolean;
}

export const saGetMetrics = (): Promise<SaMetrics> =>
  axios.get(`${API}/api/superadmin/metrics`, auth()).then((r) => r.data);

export const saGetClinics = (): Promise<SaClinic[]> =>
  axios.get(`${API}/api/superadmin/clinics`, auth()).then((r) => r.data);

export const saGetCatalog = (): Promise<SaModule[]> =>
  axios.get(`${API}/api/superadmin/modules`, auth()).then((r) => r.data);

export const saCreateClinic = (body: {
  tenantId: string;
  name: string;
  plan: string;
  adminUsername: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}): Promise<any> => axios.post(`${API}/api/superadmin/clinics`, body, auth()).then((r) => r.data);

export const saSetModule = (
  tenantId: string,
  moduleKey: string,
  enabled: boolean,
  expiresAt?: string | null,
  pairingCode?: string,
): Promise<any> =>
  axios
    .patch(`${API}/api/superadmin/clinics/${tenantId}/modules`, { moduleKey, enabled, expiresAt, pairingCode }, auth())
    .then((r) => r.data);
