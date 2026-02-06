import React, { useState, useRef } from 'react';
import { useQuery } from 'react-query';
import { XMarkIcon, DocumentArrowUpIcon, TrashIcon } from '@heroicons/react/24/outline';
import { templateService } from '../services/template';
import { smtpService } from '../services/smtp';
import { campaignService, CampaignCreate, FileUploadResponse } from '../services/campaign';

// Helper function to parse variables from backend
const parseVariables = (variables: string | string[]): string[] => {
  try {
    if (typeof variables === 'string') {
      return JSON.parse(variables);
    }
    return Array.isArray(variables) ? variables : [];
  } catch {
    return [];
  }
};

interface CampaignFormProps {
  initialData?: Partial<CampaignCreate>;
  onSubmit: (data: CampaignCreate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

interface RecipientData {
  email: string;
  firstName?: string;
  lastName?: string;
  customData?: Record<string, string>;
}

export const CampaignForm: React.FC<CampaignFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CampaignCreate>({
    name: initialData?.name || '',
    templateId: initialData?.templateId || '',
    smtpAccountIds: initialData?.smtpAccountIds || [],
    scheduledAt: initialData?.scheduledAt || '',
    recipients: initialData?.recipients || [],
    settings: {
      delayBetweenEmails: 18,
      batchSize: 12,
      batchDelay: 120,
      maxRetriesPerEmail: 3,
      ...initialData?.settings,
    },
  });

  const [manualRecipients, setManualRecipients] = useState('');
  const [, setUploadedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates and SMTP accounts
  const { data: templates } = useQuery('templates', templateService.getAll);
  const { data: smtpAccounts } = useQuery('smtp-accounts', smtpService.getAll);

  const activeTemplates = templates?.filter(t => t.isActive) || [];
  const activeSmtpAccounts = smtpAccounts?.filter(s => s.isActive) || [];

  const steps = [
    { id: 1, name: 'Basic Info', description: 'Campaign name and template' },
    { id: 2, name: 'Recipients', description: 'Upload or add recipients' },
    { id: 3, name: 'Settings', description: 'SMTP accounts and timing' },
    { id: 4, name: 'Schedule', description: 'When to send emails' },
  ];

  const handleInputChange = (field: keyof CampaignCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSettingsChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings!, [field]: value },
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|xlsx)$/i)) {
      alert('Please upload a CSV or Excel file');
      return;
    }

    try {
      setUploadedFile(file);
      const result = await campaignService.uploadRecipients(file);
      setUploadResult(result);
      setFormData(prev => ({ ...prev, recipients: result.recipients }));
    } catch (error) {
      alert('Failed to upload file. Please check the format and try again.');
      setUploadedFile(null);
      setUploadResult(null);
    }
  };

  const handleManualRecipients = () => {
    const lines = manualRecipients.split('\n').filter(line => line.trim());
    const recipients: RecipientData[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts[0] && parts[0].includes('@')) {
        recipients.push({
          email: parts[0],
          firstName: parts[1] || undefined,
          lastName: parts[2] || undefined,
          customData: parts[3] ? { custom: parts[3] } : undefined,
        });
      }
    }

    setFormData(prev => ({ ...prev, recipients }));
    setManualRecipients('');
  };

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      return;
    }

    try {
      // Format the data before submission
      const submissionData = {
        ...formData,
        scheduledAt: formData.scheduledAt 
          ? new Date(formData.scheduledAt + ':00').toISOString() 
          : undefined,
      };
      
      console.log('Submitting campaign data:', submissionData);
      await onSubmit(submissionData);
    } catch (error: any) {
      console.error('Campaign creation error:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() && formData.templateId;
      case 2:
        return formData.recipients.length > 0;
      case 3:
        return formData.smtpAccountIds.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const selectedTemplate = templates?.find(t => t.id === formData.templateId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit Campaign' : 'Create New Campaign'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Step {currentStep} of {steps.length}: {steps[currentStep - 1].name}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.id 
                      ? 'bg-blue-600 text-white'
                      : currentStep > step.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-700'
                  }`}>
                    {currentStep > step.id ? '✓' : step.id}
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.name}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1">
          <div className="p-6 min-h-96">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="label">Campaign Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="input"
                    placeholder="e.g., Product Launch Email, Newsletter #1"
                    required
                  />
                </div>

                <div>
                  <label className="label">Email Template</label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => handleInputChange('templateId', e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Select a template...</option>
                    {activeTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  
                  {selectedTemplate && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">
                        Subject: {selectedTemplate.subject}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Variables: {parseVariables(selectedTemplate.variables).join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  
                  {activeTemplates.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      No active templates available. Please create a template first.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Recipients */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* File Upload */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Upload Recipients File</h4>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <span className="btn btn-primary">Upload CSV/Excel</span>
                          <input
                            ref={fileInputRef}
                            id="file-upload"
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={handleFileUpload}
                            className="sr-only"
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          CSV or Excel file with email, firstName, lastName columns
                        </p>
                      </div>
                    </div>

                    {uploadResult && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-900">
                          File uploaded successfully!
                        </p>
                        <p className="text-xs text-green-700">
                          {uploadResult.validRecipients} valid recipients loaded
                          {uploadResult.invalidRecipients > 0 && 
                            `, ${uploadResult.invalidRecipients} invalid entries skipped`
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manual Entry */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Add Recipients Manually</h4>
                    
                    <div>
                      <textarea
                        value={manualRecipients}
                        onChange={(e) => setManualRecipients(e.target.value)}
                        className="input h-32"
                        placeholder={`Enter recipients, one per line:
email@example.com,John,Doe,Custom Data
jane@example.com,Jane,Smith
admin@company.com`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: email,firstName,lastName,customData (firstName, lastName, customData are optional)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualRecipients}
                      disabled={!manualRecipients.trim()}
                      className="btn btn-secondary w-full"
                    >
                      Add Recipients
                    </button>
                  </div>
                </div>

                {/* Recipients List */}
                {formData.recipients.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        Recipients ({formData.recipients.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleInputChange('recipients', [])}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      {formData.recipients.slice(0, 10).map((recipient, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {recipient.email}
                            </p>
                            {(recipient.firstName || recipient.lastName) && (
                              <p className="text-xs text-gray-600">
                                {recipient.firstName} {recipient.lastName}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRecipient(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {formData.recipients.length > 10 && (
                        <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                          ... and {formData.recipients.length - 10} more recipients
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Settings */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="label">SMTP Accounts</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeSmtpAccounts.map((account) => (
                      <label key={account.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.smtpAccountIds.includes(account.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange('smtpAccountIds', [...formData.smtpAccountIds, account.id]);
                            } else {
                              handleInputChange('smtpAccountIds', formData.smtpAccountIds.filter(id => id !== account.id));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900">{account.name}</p>
                          <p className="text-xs text-gray-600">
                            {account.fromName} &lt;{account.fromEmail}&gt; • Limit: {account.dailyLimit}/day
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  {activeSmtpAccounts.length === 0 && (
                    <p className="text-sm text-red-600">
                      No active SMTP accounts available. Please configure SMTP accounts first.
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Emails will be distributed across selected accounts to respect daily limits
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Delay Between Emails (seconds)</label>
                    <input
                      type="number"
                      min="15"
                      max="300"
                      value={formData.settings?.delayBetweenEmails}
                      onChange={(e) => handleSettingsChange('delayBetweenEmails', parseInt(e.target.value))}
                      className="input"
                    />
                    <p className="text-xs text-gray-500">15-20 seconds recommended</p>
                  </div>

                  <div>
                    <label className="label">Batch Size</label>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={formData.settings?.batchSize}
                      onChange={(e) => handleSettingsChange('batchSize', parseInt(e.target.value))}
                      className="input"
                    />
                    <p className="text-xs text-gray-500">10-15 emails recommended</p>
                  </div>

                  <div>
                    <label className="label">Batch Delay (seconds)</label>
                    <input
                      type="number"
                      min="60"
                      max="600"
                      value={formData.settings?.batchDelay}
                      onChange={(e) => handleSettingsChange('batchDelay', parseInt(e.target.value))}
                      className="input"
                    />
                    <p className="text-xs text-gray-500">2 minutes recommended</p>
                  </div>

                  <div>
                    <label className="label">Max Retries</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={formData.settings?.maxRetriesPerEmail}
                      onChange={(e) => handleSettingsChange('maxRetriesPerEmail', parseInt(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Schedule */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="label">When to send emails</label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="schedule"
                        checked={!formData.scheduledAt}
                        onChange={() => handleInputChange('scheduledAt', '')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Send immediately</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="schedule"
                        checked={!!formData.scheduledAt}
                        onChange={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          tomorrow.setHours(9, 0, 0, 0);
                          handleInputChange('scheduledAt', tomorrow.toISOString().slice(0, 16));
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Schedule for later</span>
                    </label>
                  </div>

                  {formData.scheduledAt && (
                    <div className="mt-3">
                      <input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                        className="input"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>

                {/* Campaign Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Campaign Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Campaign Name:</span>
                      <span className="text-blue-900 font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Template:</span>
                      <span className="text-blue-900 font-medium">{selectedTemplate?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Recipients:</span>
                      <span className="text-blue-900 font-medium">{formData.recipients.length} emails</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">SMTP Accounts:</span>
                      <span className="text-blue-900 font-medium">{formData.smtpAccountIds.length} accounts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Schedule:</span>
                      <span className="text-blue-900 font-medium">
                        {formData.scheduledAt 
                          ? new Date(formData.scheduledAt).toLocaleString()
                          : 'Immediate'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="btn btn-secondary"
                  disabled={isLoading}
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !canProceed()}
              >
                {isLoading 
                  ? 'Processing...' 
                  : currentStep < 4 
                  ? 'Next' 
                  : isEdit 
                  ? 'Update Campaign' 
                  : 'Create Campaign'
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};