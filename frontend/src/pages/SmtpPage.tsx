import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { smtpService, SmtpAccount, SmtpAccountCreate } from '../services/smtp';
import { SmtpForm } from '../components/SmtpForm';

export const SmtpPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SmtpAccount | null>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: smtpAccounts, isLoading } = useQuery(
    'smtp-accounts',
    smtpService.getAll,
    {
      onError: () => {
        toast.error('Failed to load SMTP accounts');
      },
    }
  );

  const createMutation = useMutation(smtpService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success('SMTP account created successfully');
      setShowForm(false);
    },
    onError: () => {
      toast.error('Failed to create SMTP account');
    },
  });

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: SmtpAccountCreate }) => 
      smtpService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('smtp-accounts');
        toast.success('SMTP account updated successfully');
        setEditingAccount(null);
      },
      onError: () => {
        toast.error('Failed to update SMTP account');
      },
    }
  );

  const deleteMutation = useMutation(smtpService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success('SMTP account deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.details || 'Failed to delete SMTP account');
    },
  });

  const testMutation = useMutation(smtpService.testConnection, {
    onSuccess: () => {
      toast.success('SMTP connection test successful');
      setTestingAccount(null);
    },
    onError: () => {
      toast.error('SMTP connection test failed');
      setTestingAccount(null);
    },
  });

  const toggleMutation = useMutation(smtpService.toggleStatus, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to toggle SMTP account status');
    },
  });

  const handleCreate = async (data: SmtpAccountCreate) => {
    await createMutation.mutateAsync(data);
  };

  const handleEdit = async (data: SmtpAccountCreate) => {
    if (editingAccount) {
      await updateMutation.mutateAsync({ id: editingAccount.id, data });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleTest = async (id: string) => {
    setTestingAccount(id);
    await testMutation.mutateAsync(id);
  };

  const handleToggleStatus = async (id: string) => {
    await toggleMutation.mutateAsync(id);
  };

  const getStatusBadge = (account: SmtpAccount) => {
    if (!account.isActive) {
      return <span className="badge badge-gray">Inactive</span>;
    }
    
    const now = new Date();
    const lastUsed = account.lastUsed ? new Date(account.lastUsed) : null;
    const daysSinceUsed = lastUsed ? 
      Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (!lastUsed) {
      return <span className="badge badge-yellow">Never Used</span>;
    } else if (daysSinceUsed! <= 1) {
      return <span className="badge badge-green">Active</span>;
    } else if (daysSinceUsed! <= 7) {
      return <span className="badge badge-blue">Recent</span>;
    } else {
      return <span className="badge badge-yellow">Idle</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMTP Accounts</h1>
          <p className="mt-2 text-gray-600">
            Configure email sending accounts for your campaigns
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add SMTP Account
          </button>
        </div>
      </div>

      {/* SMTP Accounts List */}
      {smtpAccounts && smtpAccounts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {smtpAccounts.map((account) => (
            <div key={account.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {account.name}
                    </h3>
                    {getStatusBadge(account)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">SMTP Server</p>
                      <p className="font-medium text-gray-900">
                        {account.host}:{account.port} {account.secure && '(SSL)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">From</p>
                      <p className="font-medium text-gray-900">
                        {account.fromName} &lt;{account.fromEmail}&gt;
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Daily Limit</p>
                      <p className="font-medium text-gray-900">{account.dailyLimit} emails</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-4 text-sm text-gray-600">
                    <span>Username: {account.username}</span>
                    <span>Delay: {account.delayMin}-{account.delayMax}s</span>
                    {account.lastUsed && (
                      <span>Last used: {new Date(account.lastUsed).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleTest(account.id)}
                    disabled={testingAccount === account.id}
                    className="btn btn-secondary text-sm"
                    title="Test connection"
                  >
                    {testingAccount === account.id ? (
                      'Testing...'
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Test
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleToggleStatus(account.id)}
                    className={`btn text-sm ${account.isActive ? 'btn-secondary' : 'btn-primary'}`}
                    title={account.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {account.isActive ? (
                      <>
                        <PauseIcon className="h-4 w-4 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-4 w-4 mr-1" />
                        Activate
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setEditingAccount(account)}
                    className="btn btn-secondary text-sm"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(account.id, account.name)}
                    className="btn btn-danger text-sm"
                    title="Delete"
                    disabled={deleteMutation.isLoading}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No SMTP accounts yet</h3>
            <p className="text-gray-600 mb-6">
              Add your first SMTP account to start sending emails.
            </p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Your First SMTP Account
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <SmtpForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Edit Form Modal */}
      {editingAccount && (
        <SmtpForm
          initialData={{
            name: editingAccount.name,
            host: editingAccount.host,
            port: editingAccount.port,
            secure: editingAccount.secure,
            username: editingAccount.username,
            password: '', // Don't prefill password for security
            fromName: editingAccount.fromName,
            fromEmail: editingAccount.fromEmail,
            dailyLimit: editingAccount.dailyLimit,
            delayMin: editingAccount.delayMin,
            delayMax: editingAccount.delayMax,
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditingAccount(null)}
          isLoading={updateMutation.isLoading}
          isEdit={true}
        />
      )}
    </div>
  );
};