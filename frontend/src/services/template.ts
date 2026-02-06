import { api } from './api';

export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  htmlBody: string;
  variables: string | string[]; // Can be JSON string from backend or parsed array
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCreate {
  name: string;
  subject: string;
  htmlBody: string;
  isActive?: boolean;
  autoAddUnsubscribe?: boolean;
}


export interface TemplateUpdate {
  name?: string;
  subject?: string;
  htmlBody?: string;
  isActive?: boolean;
  autoAddUnsubscribe?: boolean;
}

export interface TemplatePreview {
  subject: string;
  htmlBody: string;
}

export const templateService = {
  async getAll(): Promise<EmailTemplate[]> {
    const response = await api.get('/templates');
    return response.data;
  },

  async getById(id: string): Promise<EmailTemplate> {
    const response = await api.get(`/templates/${id}`);
    return response.data;
  },

  async create(data: TemplateCreate): Promise<EmailTemplate> {
    const response = await api.post('/templates', data);
    return response.data;
  },

  async update(id: string, data: TemplateUpdate): Promise<EmailTemplate> {
    const response = await api.put(`/templates/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/templates/${id}`);
  },

  async preview(id: string, variables: Record<string, string>): Promise<TemplatePreview> {
    const response = await api.post(`/templates/${id}/preview`, { variables });
    return response.data;
  },

  async toggleStatus(id: string): Promise<{ message: string }> {
    const response = await api.put(`/templates/${id}/toggle`);
    return response.data;
  },

  async duplicate(id: string, name?: string): Promise<EmailTemplate> {
    const response = await api.post(`/templates/${id}/duplicate`, { name });
    return response.data;
  },
};