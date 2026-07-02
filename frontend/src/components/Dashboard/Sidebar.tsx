import type { User } from '../../services/api';

interface SidebarProps {
  user: User | null;
  activeTab: 'documents' | 'api_keys' | 'sandbox';
  setActiveTab: (tab: 'documents' | 'api_keys' | 'sandbox') => void;
  onLogout: () => void;
}

export default function Sidebar({ user, activeTab, setActiveTab, onLogout }: SidebarProps) {
  return (
    <div style={{ 
      width: '240px', 
      minWidth: '240px', 
      background: '#18181b', 
      borderRight: '1px solid #27272a', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '24px',
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      <div style={{ paddingBottom: '24px', borderBottom: '1px solid #27272a', marginBottom: '24px' }}>
        <h2 style={{ 
          fontFamily: 'var(--font-heading)', 
          fontSize: '20px', 
          fontWeight: 600, 
          letterSpacing: '-0.02em',
          color: '#fafafa'
        }}>
          botforweb
        </h2>
        <div style={{ 
          fontSize: '12px', 
          color: '#71717a', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em', 
          marginTop: '4px',
          fontWeight: 400
        }}>
          Console
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
        <button 
          onClick={() => setActiveTab('documents')} 
          className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', outline: 'none' }}
        >
          <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Documents
        </button>
        
        <button 
          onClick={() => setActiveTab('api_keys')} 
          className={`nav-item ${activeTab === 'api_keys' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', outline: 'none' }}
        >
          <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m-2 4a2 2 0 012 2m-2-4a2 2 0 01-2-2m2 4a2 2 0 01-2 2m-2-4h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          API Keys & Script
        </button>

        <button 
          onClick={() => setActiveTab('sandbox')} 
          className={`nav-item ${activeTab === 'sandbox' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', outline: 'none' }}
        >
          <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Chat Sandbox
        </button>
      </nav>

      {/* User profile bottom bar */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <div style={{ fontSize: '12px', color: '#71717a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            ID: {user?.organization_id}
          </div>
        </div>
        <button onClick={onLogout} className="btn btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '13px' }}>
          Logout
        </button>
      </div>
    </div>
  );
}
