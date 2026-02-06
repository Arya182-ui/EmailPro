import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useNotifications } from '../components/NotificationSystem';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { templateService, EmailTemplate, TemplateCreate } from '../services/template';
import { TemplateForm } from '../components/TemplateForm';

export const TemplatesPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const { data: templates, isLoading, error } = useQuery(
    'templates',
    templateService.getAll,
    {
      retry: 2,
      refetchOnWindowFocus: false,
      onError: (error: any) => {
        console.error('Templates loading error:', error);
        toast.error('Failed to load templates');
      },
    }
  );

  const createMutation = useMutation(templateService.create, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('templates');
      toast.success('Template created successfully');
      addNotification({
        title: 'Template Created! ✨',
        message: `"${data.name}" has been created and is ready to use in campaigns.`,
        type: 'success'
      });
      setShowForm(false);
    },
    onError: (error: any) => {
      console.error('Template creation error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Validation details:', error.response?.data?.details);
      toast.error('Failed to create template');
      addNotification({
        title: 'Template Creation Failed',
        message: error.response?.data?.details?.[0] || error.response?.data?.error || error.response?.data?.message || 'There was an error creating the template. Please try again.',
        type: 'error'
      });
    },
  });

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: TemplateCreate }) => 
      templateService.update(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('templates');
        toast.success('Template updated successfully');
        addNotification({
          title: 'Template Updated! ✨',
          message: `"${data.name}" has been updated with your latest changes.`,
          type: 'success'
        });
        setEditingTemplate(null);
      },
      onError: () => {
        toast.error('Failed to update template');
        addNotification({
          title: 'Update Failed',
          message: 'Could not update the template. Please try again.',
          type: 'error'
        });
      },
    }
  );

  const deleteMutation = useMutation(templateService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      toast.success('Template deleted successfully');
      addNotification({
        title: 'Template Deleted',
        message: 'The template has been permanently removed from your account.',
        type: 'info'
      });
    },
    onError: (error: any) => {
      console.error('Template deletion error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error || 
                          'Failed to delete template';
      
      toast.error(errorMessage);
      addNotification({
        title: 'Delete Failed',
        message: errorMessage,
        type: 'error'
      });
    },
  });

  const duplicateMutation = useMutation(
    ({ id, name }: { id: string; name?: string }) => 
      templateService.duplicate(id, name),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('templates');
        toast.success('Template duplicated successfully');
      },
      onError: () => {
        toast.error('Failed to duplicate template');
      },
    }
  );

  const toggleMutation = useMutation(templateService.toggleStatus, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('templates');
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to toggle template status');
    },
  });

  const handleCreate = async (data: TemplateCreate) => {
    await createMutation.mutateAsync(data);
  };

  const handleEdit = async (data: TemplateCreate) => {
    if (editingTemplate) {
      await updateMutation.mutateAsync({ id: editingTemplate.id, data });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete "${name}"?\n\nNote: Templates being used in campaigns cannot be deleted.`
    );
    
    if (isConfirmed) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        // Error handling is done in the mutation's onError
        console.log('Delete failed:', error);
      }
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    const duplicateName = prompt(`Enter a name for the duplicated template:`, `${name} (Copy)`);
    if (duplicateName) {
      await duplicateMutation.mutateAsync({ id, name: duplicateName });
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/{{(\w+)}}/g);
    return matches ? [...new Set(matches.map(match => match.replace(/[{}]/g, '')))] : [];
  };

  const getStatusBadge = (template: EmailTemplate) => {
    return template.isActive ? (
      <span className="badge badge-green">Active</span>
    ) : (
      <span className="badge badge-gray">Inactive</span>
    );
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
          <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
          <p className="mt-2 text-gray-600">
            Create and manage your email templates with dynamic variables
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const variables = extractVariables(template.subject + ' ' + template.htmlBody);
            
            return (
              <div key={template.id} className="card p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {template.name}
                    </h3>
                    {getStatusBadge(template)}
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="btn btn-secondary text-sm p-2"
                      title="Preview"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    
                    <div className="relative group">
                      <button className="btn btn-secondary text-sm p-2">⋮</button>
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        <div className="py-1">
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <PencilIcon className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicate(template.id, template.name)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate(template.id)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            {template.isActive ? (
                              <>
                                <PauseIcon className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <PlayIcon className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(template.id, template.name)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Subject:</p>
                    <p className="font-medium text-gray-900 truncate" title={template.subject}>
                      {template.subject}
                    </p>
                  </div>

                  {variables.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Variables:</p>
                      <div className="flex flex-wrap gap-1">
                        {variables.slice(0, 3).map((variable) => (
                          <span key={variable} className="badge badge-blue text-xs">
                            {variable}
                          </span>
                        ))}
                        {variables.length > 3 && (
                          <span className="badge badge-gray text-xs">
                            +{variables.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="card">
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first email template to start building campaigns.
            </p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Your First Template
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <TemplateForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Edit Form Modal */}
      {editingTemplate && (
        <TemplateForm
          initialData={{
            name: editingTemplate.name,
            subject: editingTemplate.subject,
            htmlBody: editingTemplate.htmlBody,
            isActive: editingTemplate.isActive
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditingTemplate(null)}
          isLoading={updateMutation.isLoading}
          isEdit={true}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Preview: {previewTemplate.name}
              </h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-auto">
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <strong>Subject:</strong> {previewTemplate.subject}
              </div>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};