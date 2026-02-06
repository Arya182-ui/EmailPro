import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import { TemplateCreate } from '../services/template';

interface TemplateFormProps {
  initialData?: Partial<TemplateCreate>;
  onSubmit: (data: TemplateCreate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

const commonVariables = [
  { name: 'firstName', description: 'Recipient first name' },
  { name: 'lastName', description: 'Recipient last name' },
  { name: 'fullName', description: 'Recipient full name' },
  { name: 'email', description: 'Recipient email address' },
  { name: 'company', description: 'Recipient company' },
  { name: 'position', description: 'Recipient position' },
];

const templateExamples = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to {{company}}, {{firstName}}!',
    content: `
      <div style="max-width: 100%; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333; font-size: 28px; margin-bottom: 20px; line-height: 1.3;">Welcome {{firstName}}! 🎉</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">Thank you for joining us at {{company}}. We're excited to have you on board and can't wait to help you succeed.</p>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
          <h3 style="margin: 0 0 15px 0; font-size: 20px;">🚀 What's next?</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 10px; font-size: 16px;">✅ Complete your profile setup</li>
            <li style="margin-bottom: 10px; font-size: 16px;">🔍 Explore our features</li>
            <li style="margin-bottom: 0; font-size: 16px;">💬 Connect with our support team if needed</li>
          </ul>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">We're here to help you every step of the way. If you have any questions, don't hesitate to reach out!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Get Started Now</a>
        </div>
        
        <p style="font-size: 16px; color: #555;">Best regards,<br><strong>The {{company}} Team</strong></p>
      </div>
    `
  },
  {
    name: 'Product Update',
    subject: 'New features just for you, {{firstName}}',
    content: `
      <div style="max-width: 100%; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #2563eb; font-size: 26px; margin-bottom: 20px;">Exciting Updates! 🎯</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">Hi {{firstName}},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 25px;">We've been working hard to bring you new features that will help you get more done, faster and better than ever before.</p>
        
        <div style="border: 2px solid #2563eb; padding: 25px; border-radius: 12px; margin: 25px 0; background: #f8faff;">
          <h3 style="margin: 0 0 20px 0; color: #2563eb; font-size: 22px;">🚀 What's New</h3>
          <div style="margin-bottom: 15px; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #374151; font-size: 16px;">📊 Enhanced Dashboard</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Real-time analytics and improved data visualization</p>
          </div>
          <div style="margin-bottom: 15px; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #374151; font-size: 16px;">📱 Mobile Experience</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Fully optimized for mobile devices and tablets</p>
          </div>
          <div style="padding: 10px 0;">
            <strong style="color: #374151; font-size: 16px;">🔗 New Integrations</strong>
            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Connect with your favorite tools seamlessly</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Explore New Features</a>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">Login to your account now to explore these exciting new features and boost your productivity!</p>
        <p style="font-size: 16px; color: #555;">Happy to help,<br><strong>{{company}} Team</strong></p>
      </div>
    `
  },
  {
    name: 'Newsletter Template',
    subject: '{{company}} Newsletter - {{firstName}}, here\'s what\'s new!',
    content: `
      <div style="max-width: 100%; padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a202c; font-size: 32px; margin: 0; font-weight: bold;">{{company}}</h1>
          <p style="color: #718096; font-size: 14px; margin: 5px 0 0 0;">Newsletter · Edition #1</p>
        </div>
        
        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">Hi {{firstName}},</p>
        
        <div style="background: #f7fafc; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #4299e1;">
          <h3 style="color: #2b6cb0; margin: 0 0 15px 0; font-size: 20px;">📰 This Week's Highlights</h3>
          <p style="margin: 0; color: #4a5568; line-height: 1.6;">Catch up on the most important updates, features, and announcements from our team.</p>
        </div>
        
        <div style="margin: 30px 0;">
          <h3 style="color: #2d3748; font-size: 20px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">🎯 Feature Spotlight</h3>
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 15px;">This month we're highlighting our advanced analytics dashboard that helps you make data-driven decisions.</p>
          <a href="#" style="color: #4299e1; text-decoration: none; font-weight: 500;">Learn More →</a>
        </div>
        
        <div style="margin: 30px 0;">
          <h3 style="color: #2d3748; font-size: 20px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">💡 Tips & Tricks</h3>
          <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 20px; border-radius: 8px;">
            <p style="margin: 0; color: #742a2a; font-size: 16px; line-height: 1.6;"><strong>Pro Tip:</strong> Did you know you can use keyboard shortcuts to navigate faster? Press Ctrl+K to open the command palette!</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
          <h3 style="color: white; margin: 0 0 15px 0; font-size: 20px;">📈 Your Progress</h3>
          <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 16px;">You're doing great! Keep up the momentum.</p>
          <a href="#" style="background: white; color: #667eea; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Dashboard</a>
        </div>
        
        <p style="font-size: 16px; color: #555; margin-bottom: 10px;">Thanks for being part of our community!</p>
        <p style="font-size: 16px; color: #555;">Best regards,<br><strong>The {{company}} Team</strong></p>
      </div>
    `
  }
];

export const TemplateForm: React.FC<TemplateFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
}) => {
  const [formData, setFormData] = useState<TemplateCreate>({
    name: initialData?.name || '',
    subject: initialData?.subject || '',
    htmlBody: initialData?.htmlBody || '',
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    autoAddUnsubscribe: initialData?.autoAddUnsubscribe || false,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [selectedExample, setSelectedExample] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [formData.htmlBody]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subject.trim() || !formData.htmlBody.trim()) {
      return;
    }
    await onSubmit(formData);
  };

  const handleInputChange = (field: keyof TemplateCreate, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = formData.htmlBody;
    const newContent = content.substring(0, start) + `{{${variable}}}` + content.substring(end);
    
    setFormData(prev => ({ ...prev, htmlBody: newContent }));
    
    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
      textarea.focus();
    }, 0);
  };

  const loadExample = () => {
    const example = templateExamples.find(t => t.name === selectedExample);
    if (example) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || example.name,
        subject: example.subject,
        htmlBody: example.content.trim(),
      }));
      setSelectedExample('');
    }
  };

  const generatePreview = () => {
    let previewSubject = formData.subject;
    let previewContent = formData.htmlBody;

    Object.entries(previewData).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      previewSubject = previewSubject.replace(placeholder, value || `[${key}]`);
      previewContent = previewContent.replace(placeholder, value || `[${key}]`);
    });

    return { subject: previewSubject, htmlBody: previewContent };
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/{{(\w+)}}/g);
    return matches ? [...new Set(matches.map(match => match.replace(/[{}]/g, '')))] : [];
  };

  const allVariables = extractVariables(formData.subject + ' ' + formData.htmlBody);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl my-2 sm:my-4 overflow-hidden flex flex-col border border-gray-200/50 max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-gray-200/50 flex-shrink-0 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold gradient-text">
              {isEdit ? '✏️ Edit Template' : '✨ Create New Template'}
            </h3>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Design beautiful email templates for your campaigns</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 p-2 rounded-xl hover:bg-white/80 transition-all duration-200"
            type="button"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
            {/* Template Name */}
            <div>
              <label className="label">Template Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="input"
                placeholder="e.g., Welcome Email, Product Update"
                required
              />
            </div>

            {/* Load Example */}
            {!isEdit && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Quick Start</h4>
                <div className="flex items-center space-x-3">
                  <select
                    value={selectedExample}
                    onChange={(e) => setSelectedExample(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">Choose a template example...</option>
                    {templateExamples.map((example) => (
                      <option key={example.name} value={example.name}>
                        {example.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadExample}
                    disabled={!selectedExample}
                    className="btn-primary text-sm"
                  >
                    Load Example
                  </button>
                </div>
              </div>
            )}

            {/* Subject Line */}
            <div>
              <label className="label">Subject Line</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="input"
                placeholder="e.g., Welcome to {{company}}, {{firstName}}!"
                required
              />
            </div>

            {/* Template Settings */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Template Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Template is active</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.autoAddUnsubscribe || false}
                    onChange={(e) => handleInputChange('autoAddUnsubscribe', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto-add unsubscribe link</span>
                </label>
                <p className="text-xs text-gray-600 ml-7">
                  If unchecked, you can manually add {'{unsubscribe_url}'} or [UNSUBSCRIBE] where you want the unsubscribe link
                </p>
              </div>
            </div>

            {/* Variables Helper */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Insert Variables</h4>
              <div className="flex flex-wrap gap-2">
                {commonVariables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    onClick={() => insertVariable(variable.name)}
                    className="btn-secondary text-xs"
                    title={variable.description}
                  >
                    {`{{${variable.name}}}`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Click to insert variables into your template content
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* HTML Content */}
              <div className="order-2 xl:order-1">
                <label className="label">HTML Content</label>
                <textarea
                  ref={textareaRef}
                  value={formData.htmlBody}
                  onChange={(e) => handleInputChange('htmlBody', e.target.value)}
                  className="input font-mono text-sm"
                  style={{ minHeight: window.innerWidth < 1280 ? '200px' : '400px' }}
                  placeholder={`<div style="font-family: Arial, sans-serif;">
  <h1>Hello {{firstName}}!</h1>
  <p>Welcome to {{company}}.</p>
</div>`}
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Use {'{'}{'{'}{'}'}variableName{'{'}{'}'}{'}'}for dynamic content. An unsubscribe link will be automatically added.
                </p>
              </div>

              {/* Preview */}
              <div className="order-1 xl:order-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Preview</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="btn-secondary text-sm"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                </div>

                {showPreview && (
                  <div className="space-y-4">
                    {/* Preview Data Inputs */}
                    {allVariables.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <h5 className="font-medium text-sm text-gray-700">Test Data</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {allVariables.map((variable) => (
                            <input
                              key={variable}
                              type="text"
                              placeholder={`${variable} value`}
                              value={previewData[variable] || ''}
                              onChange={(e) => 
                                setPreviewData(prev => ({ ...prev, [variable]: e.target.value }))
                              }
                              className="input text-sm"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview Output */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="bg-gray-100 px-3 py-2 border-b flex items-center justify-between">
                        <p className="text-sm font-medium truncate">Subject: {generatePreview().subject}</p>
                        <button
                          type="button"
                          onClick={() => {
                            const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                            if (previewWindow) {
                              previewWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <title>${generatePreview().subject}</title>
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                </head>
                                <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
                                  ${generatePreview().htmlBody}
                                </body>
                                </html>
                              `);
                              previewWindow.document.close();
                            }
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Open Full Preview
                        </button>
                      </div>
                      <div className="relative">
                        <div 
                          className="p-4 overflow-auto bg-white"
                          style={{
                            minHeight: '300px',
                            maxHeight: window.innerWidth < 768 ? '400px' : '500px'
                          }}
                          dangerouslySetInnerHTML={{ __html: generatePreview().htmlBody }}
                        />
                        {/* Fade overlay for long content */}
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !formData.name.trim() || !formData.subject.trim() || !formData.htmlBody.trim()}
            >
              {isLoading ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};