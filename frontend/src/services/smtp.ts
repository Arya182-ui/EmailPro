import api from './api';

export interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  dailyLimit: number;
  delayMin: number;
  delayMax: number;
  isActive: boolean;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpAccountCreate {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  dailyLimit: number;
  delayMin: number;
  delayMax: number;
}

export const smtpService = {
  async getAll(): Promise<SmtpAccount[]> {
    const response = await api.get<SmtpAccount[]>('/smtp');
    return response.data;
  },

  async getById(id: string): Promise<SmtpAccount> {
    const response = await api.get<SmtpAccount>(`/smtp/${id}`);
    return response.data;
  },

  async create(data: SmtpAccountCreate): Promise<{ message: string; smtpAccount: SmtpAccount }> {
    const response = await api.post('/smtp', data);
    return response.data;
  },

  async update(id: string, data: SmtpAccountCreate): Promise<{ message: string; smtpAccount: SmtpAccount }> {
    const response = await api.put(`/smtp/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/smtp/${id}`);
    return response.data;
  },

  async testConnection(id: string): Promise<{ message: string }> {
    const response = await api.post(`/smtp/${id}/test`);
    return response.data;
  },

  async toggleStatus(id: string): Promise<{ message: string; smtpAccount: SmtpAccount }> {
    const response = await api.patch(`/smtp/${id}/toggle`);
    return response.data;
  },
};