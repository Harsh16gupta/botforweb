import { useState, useEffect } from 'react';
import { api } from './services/api';
import type { User, Organization, DocumentItem } from './services/api';
import AuthCard from './components/Auth/AuthCard';
import Sidebar from './components/Dashboard/Sidebar';
import StatsCards from './components/Dashboard/StatsCards';
import DocumentManager from './components/Documents/DocumentManager';
import ApiKeyManager from './components/ApiKeys/ApiKeyManager';
import ChatSandbox from './components/Chat/ChatSandbox';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('bfw_token'));
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'api_keys' | 'sandbox'>('documents');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#09090b' }}>
      {/* Toast Notification alert */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000,
          background: '#18181b',
          border: `1px solid ${notification.type === 'success' ? '#27272a' : '#ef4444'}`,
          color: notification.type === 'success' ? '#fafafa' : '#ef4444',
          borderRadius: '6px',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {notification.type === 'success' ? (
            <svg style={{ width: '16px', height: '16px', color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg style={{ width: '16px', height: '16px', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {notification.message}
        </div>
      )}

      {/* Console Side Menu */}
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      {/* Main Workspace Frame */}
      <div style={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#09090b',
        overflowY: 'auto'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1
        }}>
          {/* Top metrics bar */}
          <StatsCards documents={documents} org={org} />

          {/* Tab content panel router */}
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
              <ChatSandbox org={org} showToast={showToast} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
