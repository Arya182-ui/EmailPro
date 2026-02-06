import React, { useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../components/NotificationSystem';
import LoadingState from '../components/LoadingState';
import {
  EnvelopeIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { smtpService } from '../services/smtp';
import { templateService } from '../services/template';
import { campaignService } from '../services/campaign';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  // Fetch real data
  const { data: smtpAccounts, isLoading: smtpLoading } = useQuery('smtp-accounts', smtpService.getAll, {
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('SMTP accounts loading error:', error);
    }
  });
  const { data: templates, isLoading: templatesLoading } = useQuery('templates', templateService.getAll, {
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Templates loading error:', error);
    }
  });
  const { data: campaigns, isLoading: campaignLoading } = useQuery('campaigns', campaignService.getAll, {
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Campaigns loading error:', error);
    }
  });
  const { data: campaignStats, isLoading: statsLoading } = useQuery('campaign-stats', campaignService.getStats, {
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Campaign stats loading error:', error);
    }
  });

  // Calculate stats
  const activeSmtpCount = smtpAccounts?.filter(s => s.isActive).length || 0;
  const activeTemplateCount = templates?.filter(t => t.isActive).length || 0;
  const activeCampaignCount = campaigns?.filter(c => ['running', 'scheduled'].includes(c.status.toLowerCase())).length || 0;
  const totalEmailsSent = campaignStats?.totalEmailsSent || 0;

  // Welcome notification for new users or returning users
  useEffect(() => {
    const hasShownWelcome = localStorage.getItem('dashboard-welcome-shown');
    
    if (!hasShownWelcome && user?.firstName) {
      const timer = setTimeout(() => {
        addNotification({
          title: `Welcome back, ${user.firstName}! 👋`,
          message: 'Your email automation platform is ready. Start by creating templates and launching campaigns.',
          type: 'info',
          action: {
            label: 'Get Started',
            onClick: () => navigate('/templates')
          }
        });
        localStorage.setItem('dashboard-welcome-shown', 'true');
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user?.firstName, addNotification, navigate]); // Only depend on firstName, not entire user object
  
  // System status notifications - separate effect with different key
  useEffect(() => {
    const hasShownSetupGuide = localStorage.getItem('dashboard-setup-guide-shown');
    
    if (hasShownSetupGuide || !smtpAccounts || !templates || !campaigns) {
      return;
    }
    
    const hasSmtp = smtpAccounts.length > 0;
    const hasTemplates = templates.length > 0;
    
    if (!hasSmtp) {
      const timer = setTimeout(() => {
        addNotification({
          title: 'Setup Required: SMTP Account',
          message: 'Add an SMTP account to start sending emails.',
          type: 'warning',
          action: {
            label: 'Add SMTP',
            onClick: () => navigate('/smtp')
          }
        });
        localStorage.setItem('dashboard-setup-guide-shown', 'smtp-shown');
      }, 3000);
      
      return () => clearTimeout(timer);
    } else if (!hasTemplates && localStorage.getItem('dashboard-setup-guide-shown') !== 'template-shown') {
      const timer = setTimeout(() => {
        addNotification({
          title: 'Create Your First Template',
          message: 'Design beautiful email templates for your campaigns.',
          type: 'info',
          action: {
            label: 'Create Template',
            onClick: () => navigate('/templates')
          }
        });
        localStorage.setItem('dashboard-setup-guide-shown', 'template-shown');
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [smtpAccounts?.length, templates?.length, campaigns?.length, addNotification, navigate]);

  const stats = [
    {
      name: 'SMTP Accounts',
      value: activeSmtpCount.toString(),
      total: smtpAccounts?.length || 0,
      icon: EnvelopeIcon,
      change: `${smtpAccounts?.length || 0} total configured`,
      color: 'from-blue-500 to-cyan-400',
      bgColor: 'from-blue-50 to-cyan-50',
      iconColor: 'text-blue-600',
    },
    {
      name: 'Email Templates',
      value: activeTemplateCount.toString(),
      total: templates?.length || 0,
      icon: DocumentTextIcon,
      change: `${templates?.length || 0} total created`,
      color: 'from-green-500 to-emerald-400',
      bgColor: 'from-green-50 to-emerald-50',
      iconColor: 'text-green-600',
    },
    {
      name: 'Active Campaigns',
      value: activeCampaignCount.toString(),
      total: campaigns?.length || 0,
      icon: MegaphoneIcon,
      change: `${campaigns?.length || 0} total campaigns`,
      color: 'from-purple-500 to-pink-400',
      bgColor: 'from-purple-50 to-pink-50',
      iconColor: 'text-purple-600',
    },
    {
      name: 'Emails Sent',
      value: totalEmailsSent.toLocaleString(),
      total: totalEmailsSent,
      icon: CheckCircleIcon,
      change: 'This month',
      color: 'from-orange-500 to-red-400',
      bgColor: 'from-orange-50 to-red-50',
      iconColor: 'text-orange-600',
    },
  ];


  // Recent activity from campaigns
  const recentActivity = campaigns?.slice(0, 5).map(campaign => ({
    id: campaign.id,
    type: campaign.status === 'completed' ? 'Campaign completed' : 
          campaign.status === 'running' ? 'Campaign running' :
          campaign.status === 'scheduled' ? 'Campaign scheduled' : 
          'Campaign created',
    description: campaign.name,
    timestamp: campaign.completedAt || campaign.startedAt || campaign.scheduledAt || campaign.createdAt,
    status: campaign.status,
  })) || [];

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'scheduled': return 'text-purple-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  // Show enhanced loading state
  if (smtpLoading || templatesLoading || campaignLoading || statsLoading) {
    return <LoadingState type="dashboard" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Welcome back, {user?.firstName}! ✨</h1>
            <p className="page-subtitle">Here's what's happening with your email campaigns today.</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isLoading = smtpLoading || templatesLoading || campaignLoading || statsLoading;
          
          return (
            <div key={stat.name} className="stats-card group">
              <div className={`w-16 h-16 bg-gradient-to-br ${stat.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`h-8 w-8 ${stat.iconColor}`} />
              </div>
              
              <div className={`stats-value bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {isLoading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  stat.value
                )}
              </div>
              
              <div className="stats-label">{stat.name}</div>
              
              <div className="text-xs text-gray-500 mt-2 font-medium">
                {stat.change}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="feature-card">
          <div className="feature-header">
            <h2 className="feature-title">⚡ Quick Actions</h2>
            <p className="feature-subtitle">Get started with these common tasks</p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/campaigns?new=true')}
              className="action-button group"
            >
              <div className="action-icon bg-gradient-to-br from-purple-50 to-pink-50 group-hover:from-purple-100 group-hover:to-pink-100">
                <MegaphoneIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="action-content">
                <h3 className="action-title">Create New Campaign</h3>
                <p className="action-description">Start a new email campaign</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/smtp')}
              className="action-button group"
            >
              <div className="action-icon bg-gradient-to-br from-blue-50 to-cyan-50 group-hover:from-blue-100 group-hover:to-cyan-100">
                <EnvelopeIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="action-content">
                <h3 className="action-title">Add SMTP Account</h3>
                <p className="action-description">Configure a new email sender</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/templates')}
              className="action-button group"
            >
              <div className="action-icon bg-gradient-to-br from-green-50 to-emerald-50 group-hover:from-green-100 group-hover:to-emerald-100">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="action-content">
                <h3 className="action-title">Create Template</h3>
                <p className="action-description">Design a new email template</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="feature-card">
          <div className="feature-header">
            <h2 className="feature-title">📊 Recent Activity</h2>
            <p className="feature-subtitle">Latest updates from your campaigns</p>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className={`activity-indicator ${
                    activity.status === 'completed' ? 'bg-green-500' :
                    activity.status === 'running' ? 'bg-blue-500' :
                    activity.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <div className="activity-content">
                    <p className={`activity-type ${getActivityStatusColor(activity.status)}`}>
                      {activity.type}
                    </p>
                    <p className="activity-description">
                      {activity.description}
                    </p>
                    <p className="activity-time">
                      {getTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p className="empty-title">No recent activity</p>
              <p className="empty-description">Start by creating your first campaign</p>
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="feature-card">
        <div className="feature-header">
          <h2 className="feature-title">🚀 Getting Started</h2>
          <p className="feature-subtitle">Follow these steps to launch your first campaign</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="guide-step">
            <div className="guide-icon bg-gradient-to-br from-blue-50 to-cyan-50">
              <EnvelopeIcon className="h-8 w-8 text-blue-600" />
              <div className="guide-number">1</div>
            </div>
            <h3 className="guide-title">Add SMTP Account</h3>
            <p className="guide-description">
              Configure your email sending account with SMTP credentials to start sending emails
            </p>
          </div>
          
          <div className="guide-step">
            <div className="guide-icon bg-gradient-to-br from-green-50 to-emerald-50">
              <DocumentTextIcon className="h-8 w-8 text-green-600" />
              <div className="guide-number">2</div>
            </div>
            <h3 className="guide-title">Create Template</h3>
            <p className="guide-description">
              Design beautiful email templates with dynamic variables for personalization
            </p>
          </div>
          
          <div className="guide-step">
            <div className="guide-icon bg-gradient-to-br from-purple-50 to-pink-50">
              <MegaphoneIcon className="h-8 w-8 text-purple-600" />
              <div className="guide-number">3</div>
            </div>
            <h3 className="guide-title">Launch Campaign</h3>
            <p className="guide-description">
              Upload recipients and start your automated email campaign with scheduling
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};