import { api } from './api';

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  templateId: string;
  smtpAccountIds: string[];
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  settings: {
    delayBetweenEmails: number;
    batchSize: number;
    batchDelay: number;
    maxRetriesPerEmail: number;
  };
  createdAt: string;
  updatedAt: string;
  template?: {
    name: string;
    subject: string;
  };
  smtpAccounts?: {
    name: string;
    fromEmail: string;
  }[];
  recipients?: CampaignRecipient[];
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customData: Record<string, string>;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sentAt?: string;
  failedReason?: string;
  smtpAccountId?: string;
}

export interface CampaignCreate {
  name: string;
  templateId: string;
  smtpAccountIds: string[];
  scheduledAt?: string;
  recipients: {
    email: string;
    firstName?: string;
    lastName?: string;
    customData?: Record<string, string>;
  }[];
  settings?: {
    delayBetweenEmails?: number;
    batchSize?: number;
    batchDelay?: number;
    maxRetriesPerEmail?: number;
  };
}

export interface CampaignUpdate {
  name?: string;
  templateId?: string;
  smtpAccountIds?: string[];
  scheduledAt?: string;
  settings?: {
    delayBetweenEmails?: number;
    batchSize?: number;
    batchDelay?: number;
    maxRetriesPerEmail?: number;
  };
}

export interface CampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalEmailsSent: number;
  totalEmailsFailed: number;
  averageDeliveryRate: number;
  recentActivity: {
    date: string;
    sent: number;
    failed: number;
  }[];
}

export interface FileUploadResponse {
  message: string;
  totalRecipients: number;
  validRecipients: number;
  invalidRecipients: number;
  recipients: {
    email: string;
    firstName?: string;
    lastName?: string;
    customData?: Record<string, string>;
  }[];
}

export const campaignService = {
  async getAll(): Promise<Campaign[]> {
    const response = await api.get('/campaigns');
    return response.data;
  },

  async getById(id: string): Promise<Campaign> {
    const response = await api.get(`/campaigns/${id}`);
    return response.data;
  },

  async create(data: CampaignCreate): Promise<Campaign> {
    const response = await api.post('/campaigns', data);
    return response.data;
  },

  async update(id: string, data: CampaignUpdate): Promise<Campaign> {
    const response = await api.put(`/campaigns/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/campaigns/${id}`);
  },

  async start(id: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/start`);
    return response.data;
  },

  async pause(id: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/pause`);
    return response.data;
  },

  async resume(id: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/resume`);
    return response.data;
  },

  async stop(id: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/stop`);
    return response.data;
  },

  async getRecipients(id: string): Promise<CampaignRecipient[]> {
    const response = await api.get(`/campaigns/${id}/recipients`);
    return response.data;
  },

  async uploadRecipients(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/campaigns/upload-recipients', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getStats(): Promise<CampaignStats> {
    const response = await api.get('/campaigns/stats');
    return response.data;
  },

  async duplicate(id: string, name?: string): Promise<Campaign> {
    const response = await api.post(`/campaigns/${id}/duplicate`, { name });
    return response.data;
  },

  async restart(id: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/restart`);
    return response.data;
  },

  async test(id: string, testEmail: string): Promise<{ message: string }> {
    const response = await api.post(`/campaigns/${id}/test`, { testEmail });
    return response.data;
  },
};