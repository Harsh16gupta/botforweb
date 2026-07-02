import { useState, useEffect, useMemo } from 'react';
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
  HelpCircle,
  Menu,
  Monitor,
  Check,
  CornerDownLeft,
  FileText,
  MessageSquare,
  Key,
  Laptop,
  Plus
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Notification Toast Stack
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Advanced Notification Center State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    created_at: string;
    read: boolean;
  }>>([
    {
      id: 'welcome',
      title: 'Console Initialized',
      message: 'Welcome to botforweb RAG dashboard!',
      type: 'info',
      created_at: new Date().toISOString(),
      read: false
    }
  ]);

  // 3-way Theme Selection State (Light / Dark / System)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('bfw_theme') as 'light' | 'dark' | 'system') || 'system';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Command Palette (⌘K) State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [commandPaletteSelectedIndex, setCommandPaletteSelectedIndex] = useState(0);

  // Cross-tab search and selection triggers
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedSandboxConvId, setSelectedSandboxConvId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  // Apply 3-way theme to document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateTheme();
    localStorage.setItem('bfw_theme', theme);

    if (theme === 'system') {
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  // Command palette hotkey listener (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => {
          if (!prev) {
            setCommandPaletteQuery('');
            setCommandPaletteSelectedIndex(0);
          }
          return !prev;
        });
      }
      
      // Close on escape
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsNotificationsOpen(false);
        setIsThemeMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  useEffect(() => {
    if (token) {
      fetchUserData();
      fetchOrgData();
      fetchDocuments();
      fetchConversations();
    } else {
      setUser(null);
      setOrg(null);
      setDocuments([]);
      setConversations([]);
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

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations(token!);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const fetchDocuments = async (silent = false) => {
    if (!silent) setDocsLoading(true);
    try {
      const data = await api.getDocuments(token!);
      
      // Compare status changes to trigger notifications
      if (documents.length > 0) {
        data.forEach(newDoc => {
          const oldDoc = documents.find(d => d.id === newDoc.id);
          if (oldDoc && oldDoc.status === 'processing' && newDoc.status !== 'processing') {
            const isSuccess = newDoc.status === 'active';
            const notificationTitle = isSuccess ? 'Ingestion Complete' : 'Ingestion Failed';
            const notificationMsg = isSuccess 
              ? `Document '${newDoc.filename}' was successfully indexed into vectors.`
              : `Failed to index document '${newDoc.filename}'.`;
            
            // Add notification
            setNotifications(prev => [
              {
                id: Math.random().toString(36).substring(2, 9),
                title: notificationTitle,
                message: notificationMsg,
                type: isSuccess ? 'success' : 'error',
                created_at: new Date().toISOString(),
                read: false
              },
              ...prev
            ]);
            showToast(`${newDoc.filename} processed: ${newDoc.status}`, isSuccess ? 'success' : 'error');
          }
        });
      }
      
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

  const getPageTitle = () => {
    switch (activeTab) {
      case 'documents': return 'Knowledge Base';
      case 'api_keys': return 'Keys & Integrations';
      case 'sandbox': return 'Chat Sandbox';
      default: return 'Console';
    }
  };

  // Computed command palette options
  const filteredItems = useMemo(() => {
    const q = commandPaletteQuery.toLowerCase().trim();
    const items: Array<{
      category: 'Navigation' | 'Actions' | 'Documents' | 'Conversations';
      title: string;
      subtitle: string;
      icon: any;
      action: () => void;
    }> = [
      { category: 'Navigation', title: 'Go to Knowledge Base', subtitle: 'Manage documents and vector embeddings', icon: FileText, action: () => { setActiveTab('documents'); setIsCommandPaletteOpen(false); } },
      { category: 'Navigation', title: 'Go to Keys & Script', subtitle: 'Manage API keys and widget installation snippet', icon: Key, action: () => { setActiveTab('api_keys'); setIsCommandPaletteOpen(false); } },
      { category: 'Navigation', title: 'Go to Chat Sandbox', subtitle: 'Interact with the RAG assistant', icon: MessageSquare, action: () => { setActiveTab('sandbox'); setIsCommandPaletteOpen(false); } },
      
      { category: 'Actions', title: 'Set Theme to Light', subtitle: 'Switch console to light mode', icon: Sun, action: () => { setTheme('light'); setIsCommandPaletteOpen(false); } },
      { category: 'Actions', title: 'Set Theme to Dark', subtitle: 'Switch console to dark mode', icon: Moon, action: () => { setTheme('dark'); setIsCommandPaletteOpen(false); } },
      { category: 'Actions', title: 'Set Theme to System', subtitle: 'Use operating system preferences', icon: Monitor, action: () => { setTheme('system'); setIsCommandPaletteOpen(false); } },
      { category: 'Actions', title: 'Start New Conversation', subtitle: 'Clear sandbox chat playground', icon: Plus, action: () => { setActiveTab('sandbox'); setSelectedSandboxConvId(null); setIsCommandPaletteOpen(false); } },
      { category: 'Actions', title: 'Log Out', subtitle: 'Sign out of your session', icon: LogOut, action: () => { handleLogout(); setIsCommandPaletteOpen(false); } }
    ];

    // Add documents
    documents.forEach(doc => {
      items.push({
        category: 'Documents',
        title: doc.filename,
        subtitle: `Document · ${doc.file_type.toUpperCase()} · Status: ${doc.status}`,
        icon: FileText,
        action: () => {
          setActiveTab('documents');
          setDocSearchQuery(doc.filename);
          setIsCommandPaletteOpen(false);
        }
      });
    });

    // Add conversations
    conversations.forEach(conv => {
      items.push({
        category: 'Conversations',
        title: conv.title,
        subtitle: `Sandbox Thread · ${new Date(conv.created_at).toLocaleDateString()}`,
        icon: MessageSquare,
        action: () => {
          setActiveTab('sandbox');
          setSelectedSandboxConvId(conv.id);
          setIsCommandPaletteOpen(false);
        }
      });
    });

    if (!q) return items;
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [commandPaletteQuery, documents, conversations]);

  // Render Login Card if not authenticated
  if (!token) {
    return <AuthCard onAuthSuccess={setToken} showToast={showToast} />;
  }

  // Handle Command Palette keyboard navigation
  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCommandPaletteSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCommandPaletteSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[commandPaletteSelectedIndex]) {
        filteredItems[commandPaletteSelectedIndex].action();
      }
    }
  };

  const activeThemeIcon = () => {
    if (theme === 'light') return <Sun size={15} />;
    if (theme === 'dark') return <Moon size={15} />;
    return <Laptop size={15} />;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      
      {/* ⌘K Command Palette Modal Overlay */}
      {isCommandPaletteOpen && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 2000, alignItems: 'flex-start', paddingTop: '10vh' }} 
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div 
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-popover)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '380px',
              animation: 'modal-enter 120ms ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handlePaletteKeyDown}
          >
            {/* Search Input Bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-default)', gap: '12px' }}>
              <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search documents, threads, actions..."
                value={commandPaletteQuery}
                onChange={(e) => {
                  setCommandPaletteQuery(e.target.value);
                  setCommandPaletteSelectedIndex(0);
                }}
                autoFocus
                style={{
                  flexGrow: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  padding: 0
                }}
              />
              <span style={{
                fontSize: '9px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-tertiary)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)'
              }}>ESC</span>
            </div>

            {/* Scrollable list */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '6px' }}>
              {filteredItems.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                  No matching results found.
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === commandPaletteSelectedIndex;
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      onClick={item.action}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--bg-subtle)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={14} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{item.subtitle}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>Select</span>
                          <CornerDownLeft size={10} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* 2. Mobile Sidebar Overlay Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(1px)',
            zIndex: 990,
            animation: 'modal-enter 150ms ease-out'
          }}
        />
      )}

      {/* 2. Collapsible Navigation Sidebar */}
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
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
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="btn btn-ghost hamburger-btn"
              style={{ padding: 0, width: '32px', height: '32px', borderRadius: 'var(--radius-sm)' }}
              aria-label="Open sidebar menu"
            >
              <Menu size={16} />
            </button>
            <span 
              className="text-xs org-breadcrumb" 
              onClick={() => showToast(`Organization configuration settings for '${org?.name}'`)}
              style={{ 
                color: 'var(--text-tertiary)', 
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              {org?.name || 'Organization'}
            </span>
            <span className="breadcrumb-separator" style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {getPageTitle()}
            </span>
          </div>

          {/* Right: Search, Theme Toggle, Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Search command bar trigger button */}
            <button
              onClick={() => { setIsCommandPaletteOpen(true); setCommandPaletteQuery(''); setCommandPaletteSelectedIndex(0); }}
              className="btn btn-secondary search-trigger-btn topbar-search"
              style={{
                height: '32px',
                padding: '0 12px 0 32px',
                width: '210px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-secondary)',
                position: 'relative',
                boxShadow: 'none'
              }}
            >
              <Search size={13} style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }} />
              <span>Search console...</span>
              <span style={{
                fontSize: '9px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '3px',
                padding: '1px 5px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)'
              }}>⌘K</span>
            </button>

            {/* 3-way Theme Toggle Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="btn btn-ghost"
                style={{ padding: 0, width: '32px', height: '32px', borderRadius: 'var(--radius-sm)' }}
                title="Theme Settings"
              >
                {activeThemeIcon()}
              </button>

              {isThemeMenuOpen && (
                <>
                  <div onClick={() => setIsThemeMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-popover)',
                    width: '130px',
                    padding: '4px',
                    zIndex: 99,
                    animation: 'modal-enter 120ms ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'space-between', padding: '0 8px', border: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sun size={13} />
                        <span>Light</span>
                      </div>
                      {theme === 'light' && <Check size={12} style={{ color: 'var(--success)' }} />}
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'space-between', padding: '0 8px', border: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Moon size={13} />
                        <span>Dark</span>
                      </div>
                      {theme === 'dark' && <Check size={12} style={{ color: 'var(--success)' }} />}
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                      className="btn btn-ghost"
                      style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'space-between', padding: '0 8px', border: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Monitor size={13} />
                        <span>System</span>
                      </div>
                      {theme === 'system' && <Check size={12} style={{ color: 'var(--success)' }} />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Notifications Dropdown bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="btn btn-ghost"
                style={{ padding: 0, width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', position: 'relative' }}
              >
                <Bell size={15} />
                {notifications.some(n => !n.read) && (
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

              {isNotificationsOpen && (
                <>
                  <div onClick={() => setIsNotificationsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-popover)',
                    width: '320px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    zIndex: 99,
                    animation: 'modal-enter 120ms ease-out',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                      <button
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                          showToast('All notifications marked as read');
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: '10px', height: '20px', padding: '0 4px', border: 'none' }}
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            style={{ 
                              padding: '10px 14px', 
                              borderBottom: '1px solid var(--border-default)',
                              background: notif.read ? 'transparent' : 'var(--bg-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              position: 'relative'
                            }}
                          >
                            {!notif.read && (
                              <span style={{
                                position: 'absolute',
                                left: '5px',
                                top: '15px',
                                width: '5px',
                                height: '5px',
                                background: 'var(--info)',
                                borderRadius: '50%'
                              }} />
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{notif.title}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{notif.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

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
          <StatsCards documents={documents} org={org} docsLoading={docsLoading} />

          {/* Core Routing Router */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'documents' && (
              <DocumentManager 
                token={token} 
                documents={documents} 
                docsLoading={docsLoading} 
                fetchDocuments={fetchDocuments} 
                showToast={showToast} 
                initialSearchQuery={docSearchQuery}
                clearInitialSearchQuery={() => setDocSearchQuery('')}
              />
            )}

            {activeTab === 'api_keys' && (
              <ApiKeyManager org={org} showToast={showToast} />
            )}

            {activeTab === 'sandbox' && (
              <ChatSandbox 
                token={token} 
                org={org} 
                showToast={showToast} 
                initialActiveConvId={selectedSandboxConvId}
                clearInitialActiveConvId={() => setSelectedSandboxConvId(null)}
              />
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
