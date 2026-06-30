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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Toast Notification alert */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          borderRadius: '8px',
          padding: '12px 20px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          fontSize: '14px',
          fontWeight: 500
        }}>
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
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '40px', background: 'radial-gradient(circle at 100% 100%, #1e1b4b 0%, #030303 50%)' }}>
        
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
  );
}
