import { useState, useEffect } from 'react';
import { api } from './services/api';
import type { User, Organization, DocumentItem } from './services/api';
import AuthCard from './components/Auth/AuthCard';
import Sidebar from './components/Dashboard/Sidebar';
import StatsCards from './components/Dashboard/StatsCards';
import DocumentManager from './components/Documents/DocumentManager';
import ApiKeyManager from './components/ApiKeys/ApiKeyManager';
import ChatSandbox from './components/Chat/ChatSandbox';
import { 
  Bell, 
  Search, 
  User as UserIcon, 
  LogOut, 
  Sun, 
  Moon, 
  HelpCircle
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('bfw_token'));
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  
  // Navigation & Shell
  const [activeTab, setActiveTab] = useState<'documents' | 'api_keys' | 'sandbox'>('documents');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem('bfw_sidebar_collapsed') === 'true');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Notification Toast Stack
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Theme support
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('bfw_theme') === 'dark'
  );

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('bfw_theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('bfw_theme', 'light');
    }
  }, [isDarkMode]);

  // Persist sidebar collapsed state
  const handleToggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('bfw_sidebar_collapsed', String(nextState));
  };

  // Auto-hide notification toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
  };

  // Load backend data upon authentication changes
  useEffect(() => {
    if (token) {
      fetchUserData();
      fetchOrgData();
      fetchDocuments();
    } else {
      setUser(null);
      setOrg(null);
      setDocuments([]);
    }
  }, [token]);

  // Poll for document status updates while "processing" is active
  useEffect(() => {
    if (!token) return;
    
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments(true); // silent query, no loading spinner
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, token]);

  const fetchUserData = async () => {
    try {
      const data = await api.getMe(token!);
      setUser(data);
    } catch {
      handleLogout();
    }
  };

  const fetchOrgData = async () => {
    try {
      const data = await api.getOrganization(token!);
      setOrg(data);
    } catch (err) {
      console.error('Failed to load organization info', err);
    }
  };

  const fetchDocuments = async (silent = false) => {
    if (!silent) setDocsLoading(true);
    try {
      const data = await api.getDocuments(token!);
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      if (!silent) setDocsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bfw_token');
    setToken(null);
    setUser(null);
    setOrg(null);
    setDocuments([]);
    showToast('Logged out successfully');
  };

  // Render Login Card if not authenticated
  if (!token) {
    return <AuthCard onAuthSuccess={setToken} showToast={showToast} />;
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'documents': return 'Knowledge Base';
      case 'api_keys': return 'Keys & Integrations';
      case 'sandbox': return 'Chat Sandbox';
      default: return 'Console';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      
      {/* Bottom Right Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderLeft: `3px solid ${notification.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: '280px',
          animation: 'modal-enter 150ms ease-out',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {notification.type === 'success' ? 'Success' : 'Error'}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {notification.message}
          </span>
          {/* Animated shrinking timeline progress bar */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '2px',
            width: '100%',
            background: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
            opacity: 0.3,
            animation: 'toast-timeline 4s linear forwards'
          }} />
        </div>
      )}

      {/* 2. Collapsible Navigation Sidebar */}
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Workspace frame */}
      <div style={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'var(--bg-app)',
        minWidth: 0,
        overflowX: 'hidden'
      }}>
        
        {/* 2. Top Navigation Bar */}
        <header style={{
          height: '56px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          {/* Left: Breadcrumbs Page Titles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {org?.name || 'Organization'}
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {getPageTitle()}
            </span>
          </div>

          {/* Right: Search, Theme Toggle, Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Search command bar mock */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} className="topbar-search">
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search console... ⌘K"
                readOnly
                onClick={() => showToast('Search keyboard shortcut triggered')}
                style={{ 
                  height: '32px', 
                  paddingLeft: '32px', 
                  width: '200px', 
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'none',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="btn btn-ghost"
              style={{ padding: 0, width: '32px', height: '32px', borderRadius: 'var(--radius-sm)' }}
              title="Toggle Light/Dark Theme"
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => showToast('No new notifications')}
              className="btn btn-ghost"
              style={{ padding: 0, width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', position: 'relative' }}
            >
              <Bell size={15} />
              {documents.some(d => d.status === 'processing') && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '5px',
                  height: '5px',
                  background: 'var(--warning)',
                  borderRadius: '50%'
                }} />
              )}
            </button>

            {/* User Profile Dropdown Avatar */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
              </button>

              {/* Profile drop popover panel */}
              {isProfileOpen && (
                <>
                  <div 
                    onClick={() => setIsProfileOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-popover)',
                    width: '180px',
                    padding: '4px',
                    zIndex: 99,
                    animation: 'modal-enter 120ms ease-out'
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-default)', marginBottom: '4px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.email}
                      </p>
                      <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        Org ID: {user?.organization_id}
                      </p>
                    </div>

                    <button
                      onClick={() => { setIsProfileOpen(false); showToast('Opened Profile settings'); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'flex-start', padding: '0 8px', border: 'none' }}
                    >
                      <UserIcon size={12} />
                      Profile Settings
                    </button>

                    <button
                      onClick={() => { setIsProfileOpen(false); showToast('Opened Help resources'); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'flex-start', padding: '0 8px', border: 'none' }}
                    >
                      <HelpCircle size={12} />
                      Help & Support
                    </button>

                    <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />

                    <button
                      onClick={() => { setIsProfileOpen(false); handleLogout(); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'flex-start', padding: '0 8px', color: 'var(--danger)', border: 'none' }}
                    >
                      <LogOut size={12} />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* Work Area Content */}
        <main style={{ 
          flexGrow: 1, 
          padding: '32px',
          maxWidth: '1120px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Top KPI Metrics sparkline */}
          <StatsCards documents={documents} org={org} />

          {/* Core Routing Router */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'documents' && (
              <DocumentManager 
                token={token} 
                documents={documents} 
                docsLoading={docsLoading} 
                fetchDocuments={fetchDocuments} 
                showToast={showToast} 
              />
            )}

            {activeTab === 'api_keys' && (
              <ApiKeyManager org={org} showToast={showToast} />
            )}

            {activeTab === 'sandbox' && (
              <ChatSandbox token={token} org={org} showToast={showToast} />
            )}
          </div>
        </main>
      </div>

      <style>{`
        /* Shrinking toast timelines */
        @keyframes toast-timeline {
          from { width: 100%; }
          to { width: 0%; }
        }
        
        @media (max-width: 768px) {
          .topbar-search {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
