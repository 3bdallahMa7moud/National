import type { ApiViewer } from './backendAdapters';
import api from './axios';

export async function fetchSessionViewer(): Promise<ApiViewer> {
  const response = await api.get<{ user: ApiViewer }>('/auth/session');
  return response.data.user;
}
