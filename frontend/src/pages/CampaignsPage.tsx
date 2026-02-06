import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { campaignService, Campaign, CampaignCreate } from '../services/campaign';
import { CampaignForm } from '../components/CampaignForm';

export const CampaignsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery(
    'campaigns',
    campaignService.getAll,
    {
      onError: () => {
        toast.error('Failed to load campaigns');
      },
    }
  );

  const createMutation = useMutation(campaignService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign created successfully');
      setShowForm(false);
    },
    onError: (error: any) => {
      console.error('Campaign creation error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Validation details:', error.response?.data?.details);
      toast.error(error.response?.data?.details?.[0] || error.response?.data?.error || 'Failed to create campaign');
    },
  });

  const startMutation = useMutation(campaignService.start, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to start campaign');
    },
  });

  const pauseMutation = useMutation(campaignService.pause, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to pause campaign');
    },
  });

  const resumeMutation = useMutation(campaignService.resume, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to resume campaign');
    },
  });

  const stopMutation = useMutation(campaignService.stop, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to stop campaign');
    },
  });

  const deleteMutation = useMutation(campaignService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete campaign');
    },
  });

  const duplicateMutation = useMutation(
    ({ id, name }: { id: string; name?: string }) => 
      campaignService.duplicate(id, name),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('campaigns');
        toast.success('Campaign duplicated successfully');
      },
      onError: () => {
        toast.error('Failed to duplicate campaign');
      },
    }
  );

  const restartMutation = useMutation(campaignService.restart, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to restart campaign');
    },
  });

  const handleCreate = async (data: CampaignCreate) => {
    await createMutation.mutateAsync(data);
  };

  const handleStart = async (id: string) => {
    await startMutation.mutateAsync(id);
  };

  const handlePause = async (id: string) => {
    await pauseMutation.mutateAsync(id);
  };

  const handleResume = async (id: string) => {
    await resumeMutation.mutateAsync(id);
  };

  const handleStop = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to stop "${name}"? This action cannot be undone.`)) {
      await stopMutation.mutateAsync(id);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    const duplicateName = prompt(`Enter a name for the duplicated campaign:`, `${name} (Copy)`);
    if (duplicateName) {
      await duplicateMutation.mutateAsync({ id, name: duplicateName });
    }
  };

  const handleRestart = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to restart "${name}"? This will reset all progress and start sending emails again.`)) {
      await restartMutation.mutateAsync(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      draft: 'badge-gray',
      scheduled: 'badge-blue',
      running: 'badge-green',
      paused: 'badge-yellow', 
      completed: 'badge-blue',
      failed: 'badge-red',
    } as const;

    return `badge ${statusStyles[status as keyof typeof statusStyles] || 'badge-gray'}`;
  };

  const getStatusActions = (campaign: Campaign) => {
    const status = campaign.status.toLowerCase();
    console.log(`Campaign ${campaign.name} status: "${campaign.status}" (lowercase: "${status}")`); // Debug log
    switch (status) {
      case 'draft':
      case 'scheduled':
        return (
          <>
            <button
              onClick={() => handleStart(campaign.id)}
              className="btn btn-primary text-sm"
              title="Start campaign"
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              Start
            </button>
            <button
              onClick={() => setEditingCampaign(campaign)}
              className="btn btn-secondary text-sm"
              title="Edit campaign"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </>
        );
        
      case 'running':
        return (
          <button
            onClick={() => handlePause(campaign.id)}
            className="btn btn-secondary text-sm"
            title="Pause campaign"
          >
            <PauseIcon className="h-4 w-4 mr-1" />
            Pause
          </button>
        );
        
      case 'paused':
        return (
          <>
            <button
              onClick={() => handleResume(campaign.id)}
              className="btn btn-primary text-sm"
              title="Resume campaign"
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              Resume
            </button>
            <button
              onClick={() => handleStop(campaign.id, campaign.name)}
              className="btn btn-danger text-sm"
              title="Stop campaign"
            >
              <StopIcon className="h-4 w-4" />
            </button>
          </>
        );
        
      case 'completed':
      case 'failed':
        return (
          <>
            <button
              onClick={() => handleRestart(campaign.id, campaign.name)}
              className="btn btn-primary text-sm"
              title="Restart campaign"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Restart
            </button>
            <button
              onClick={() => handleDuplicate(campaign.id, campaign.name)}
              className="btn btn-secondary text-sm"
              title="Duplicate campaign"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
          </>
        );
        
      default:
        return null;
    }
  };

  const getProgressPercentage = (campaign: Campaign) => {
    if (campaign.totalRecipients === 0) return 0;
    return Math.round((campaign.sentCount / campaign.totalRecipients) * 100);
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-gray-600">
            Monitor and manage your email campaigns
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns && campaigns.length > 0 ? (
        <div className="space-y-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {campaign.name}
                    </h3>
                    <span className={getStatusBadge(campaign.status)}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Template</p>
                      <p className="font-medium text-gray-900">
                        {campaign.template?.name || 'No template'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Recipients</p>
                      <p className="font-medium text-gray-900">
                        {campaign.sentCount} / {campaign.totalRecipients}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">SMTP Accounts</p>
                      <p className="font-medium text-gray-900">
                        {campaign.smtpAccounts?.length || campaign.smtpAccountIds.length} accounts
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Created</p>
                      <p className="font-medium text-gray-900">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {campaign.totalRecipients > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium text-gray-900">
                          {getProgressPercentage(campaign)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            campaign.status === 'completed' 
                              ? 'bg-green-600' 
                              : campaign.status === 'failed'
                              ? 'bg-red-600'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${getProgressPercentage(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Failed Count */}
                  {campaign.failedCount > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      {campaign.failedCount} failed deliveries
                    </div>
                  )}

                  {/* Schedule Info */}
                  {campaign.scheduledAt && campaign.status === 'scheduled' && (
                    <div className="mt-2 text-sm text-blue-600">
                      Scheduled for: {new Date(campaign.scheduledAt).toLocaleString()}
                    </div>
                  )}

                  {/* Timing Info */}
                  {(campaign.startedAt || campaign.completedAt) && (
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      {campaign.startedAt && (
                        <span>Started: {new Date(campaign.startedAt).toLocaleString()}</span>
                      )}
                      {campaign.completedAt && (
                        <span>Completed: {new Date(campaign.completedAt).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="btn btn-secondary text-sm"
                    title="View details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>

                  {getStatusActions(campaign)}

                  <div className="relative group">
                    <button className="btn btn-secondary text-sm p-2">⋮</button>
                    <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <div className="py-1">
                        <button
                          onClick={() => handleDuplicate(campaign.id, campaign.name)}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                          Duplicate
                        </button>
                        {(campaign.status.toLowerCase() === 'completed' || campaign.status.toLowerCase() === 'failed') && (
                          <button
                            onClick={() => handleRestart(campaign.id, campaign.name)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <ArrowPathIcon className="h-4 w-4 mr-2" />
                            Restart
                          </button>
                        )}
                        {(campaign.status.toLowerCase() === 'draft' || campaign.status.toLowerCase() === 'scheduled') && (
                          <button
                            onClick={() => setEditingCampaign(campaign)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <PencilIcon className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                        )}
                        <hr className="my-1" />
                        <button
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                          disabled={campaign.status.toLowerCase() === 'running'}
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="card">
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first email campaign to start sending emails to your audience.
            </p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Your First Campaign
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <CampaignForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Edit Form Modal */}
      {editingCampaign && (
        <CampaignForm
          initialData={{
            name: editingCampaign.name,
            templateId: editingCampaign.templateId,
            smtpAccountIds: editingCampaign.smtpAccountIds,
            scheduledAt: editingCampaign.scheduledAt,
            recipients: editingCampaign.recipients || [],
            settings: editingCampaign.settings,
          }}
          onSubmit={async (data) => {
            // Handle edit logic here - could be added as an update mutation
            await handleCreate(data);
            setEditingCampaign(null);
          }}
          onCancel={() => setEditingCampaign(null)}
          isLoading={createMutation.isLoading}
          isEdit={true}
        />
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Campaign Details: {selectedCampaign.name}
              </h3>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedCampaign.totalRecipients}</p>
                  <p className="text-sm text-gray-600">Total Recipients</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedCampaign.sentCount}</p>
                  <p className="text-sm text-gray-600">Emails Sent</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedCampaign.failedCount}</p>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">{getProgressPercentage(selectedCampaign)}%</p>
                  <p className="text-sm text-gray-600">Progress</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Campaign Info</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Status:</dt>
                      <dd className={getStatusBadge(selectedCampaign.status)}>
                        {selectedCampaign.status.charAt(0).toUpperCase() + selectedCampaign.status.slice(1)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Template:</dt>
                      <dd className="font-medium">{selectedCampaign.template?.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Created:</dt>
                      <dd className="font-medium">{new Date(selectedCampaign.createdAt).toLocaleString()}</dd>
                    </div>
                    {selectedCampaign.scheduledAt && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Scheduled:</dt>
                        <dd className="font-medium">{new Date(selectedCampaign.scheduledAt).toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Settings</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Email Delay:</dt>
                      <dd className="font-medium">{selectedCampaign.settings.delayBetweenEmails}s</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Batch Size:</dt>
                      <dd className="font-medium">{selectedCampaign.settings.batchSize} emails</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Batch Delay:</dt>
                      <dd className="font-medium">{selectedCampaign.settings.batchDelay}s</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Max Retries:</dt>
                      <dd className="font-medium">{selectedCampaign.settings.maxRetriesPerEmail}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};