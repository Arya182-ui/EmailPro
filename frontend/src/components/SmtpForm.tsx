import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SmtpAccountCreate } from '../services/smtp';

interface SmtpFormProps {
  initialData?: SmtpAccountCreate;
  onSubmit: (data: SmtpAccountCreate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

export const SmtpForm: React.FC<SmtpFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SmtpAccountCreate>({
    defaultValues: initialData || {
      name: '',
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      fromName: '',
      fromEmail: '',
      dailyLimit: 100,
      delayMin: 15,
      delayMax: 20,
    },
  });

  const watchSecure = watch('secure');

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Edit SMTP Account' : 'Add New SMTP Account'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name *
              </label>
              <input
                {...register('name', { required: 'Account name is required' })}
                type="text"
                className="input"
                placeholder="e.g., Marketing SMTP"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Host *
              </label>
              <input
                {...register('host', { required: 'SMTP host is required' })}
                type="text"
                className="input"
                placeholder="smtp.gmail.com"
              />
              {errors.host && (
                <p className="mt-1 text-sm text-red-600">{errors.host.message}</p>
              )}
            </div>
          </div>

          {/* Connection Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port *
              </label>
              <input
                {...register('port', { 
                  required: 'Port is required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Port must be greater than 0' },
                  max: { value: 65535, message: 'Port must be less than 65536' }
                })}
                type="number"
                className="input"
                placeholder="587"
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-600">{errors.port.message}</p>
              )}
            </div>

            <div className="flex items-center pt-8">
              <input
                {...register('secure')}
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Use SSL/TLS (Port 465)
              </label>
            </div>
          </div>

          {/* Authentication */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                {...register('username', { required: 'Username is required' })}
                type="text"
                className="input"
                placeholder="your-email@domain.com"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="App password or SMTP password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {/* From Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Name *
              </label>
              <input
                {...register('fromName', { required: 'From name is required' })}
                type="text"
                className="input"
                placeholder="Your Company Name"
              />
              {errors.fromName && (
                <p className="mt-1 text-sm text-red-600">{errors.fromName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Email *
              </label>
              <input
                {...register('fromEmail', { 
                  required: 'From email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid email format'
                  }
                })}
                type="email"
                className="input"
                placeholder="noreply@yourdomain.com"
              />
              {errors.fromEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.fromEmail.message}</p>
              )}
            </div>
          </div>

          {/* Sending Limits */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sending Limits</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Email Limit
                </label>
                <input
                  {...register('dailyLimit', { 
                    valueAsNumber: true,
                    min: { value: 1, message: 'Must be at least 1' },
                    max: { value: 10000, message: 'Must be less than 10,000' }
                  })}
                  type="number"
                  className="input"
                  placeholder="100"
                />
                {errors.dailyLimit && (
                  <p className="mt-1 text-sm text-red-600">{errors.dailyLimit.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Delay (seconds)
                </label>
                <input
                  {...register('delayMin', { 
                    valueAsNumber: true,
                    min: { value: 10, message: 'Must be at least 10 seconds' },
                    max: { value: 3600, message: 'Must be less than 1 hour' }
                  })}
                  type="number"
                  className="input"
                  placeholder="15"
                />
                {errors.delayMin && (
                  <p className="mt-1 text-sm text-red-600">{errors.delayMin.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Delay (seconds)
                </label>
                <input
                  {...register('delayMax', { 
                    valueAsNumber: true,
                    min: { value: 10, message: 'Must be at least 10 seconds' },
                    max: { value: 3600, message: 'Must be less than 1 hour' }
                  })}
                  type="number"
                  className="input"
                  placeholder="20"
                />
                {errors.delayMax && (
                  <p className="mt-1 text-sm text-red-600">{errors.delayMax.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Common SMTP Providers Help */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Common SMTP Settings</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div><strong>Gmail:</strong> smtp.gmail.com, Port: 587, Use app password</div>
              <div><strong>Outlook:</strong> smtp-mail.outlook.com, Port: 587</div>
              <div><strong>SendGrid:</strong> smtp.sendgrid.net, Port: 587</div>
              <div><strong>Mailgun:</strong> smtp.mailgun.org, Port: 587</div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
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
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : isEdit ? 'Update Account' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};