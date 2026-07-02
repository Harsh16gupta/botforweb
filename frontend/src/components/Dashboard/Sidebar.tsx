import type { User } from '../../services/api';
import { 
  FileText, 
  Key, 
  MessageSquare, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Command 
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: 'documents' | 'api_keys' | 'sandbox';
  setActiveTab: (tab: 'documents' | 'api_keys' | 'sandbox') => void;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ 
  user, 
  activeTab, 
  setActiveTab, 
  onLogout,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  
  const navItems = [
    {
      id: 'documents' as const,
      label: 'Documents',
      icon: FileText
    },
    {
      id: 'api_keys' as const,
      label: 'API Keys & Script',
      icon: Key
    },
    {
      id: 'sandbox' as const,
      label: 'Chat Sandbox',
      icon: MessageSquare
    }
  ];

  return (
    <div style={{ 
      width: isCollapsed ? '64px' : '240px', 
      background: 'var(--bg-surface)', 
      borderRight: '1px solid var(--border-default)', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: isCollapsed ? '16px 8px' : '24px 16px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      transition: 'width 180ms ease, padding 180ms ease',
      zIndex: 100,
      justifyContent: 'space-between'
    }}>
      {/* Top Section: Logo & Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Brand Logo */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          paddingLeft: isCollapsed ? '8px' : '6px',
          height: '32px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg-surface)',
            flexShrink: 0
          }}>
            <Command size={15} strokeWidth={2.2} />
          </div>
          {!isCollapsed && (
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              letterSpacing: '-0.02em', 
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}>
              botforweb
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)} 
                className="btn"
                style={{ 
                  background: isActive ? 'var(--bg-subtle)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  width: '100%', 
                  padding: '8px 12px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'background 120ms ease, color 120ms ease',
                  border: 'none',
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(244, 244, 245, 0.6)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon 
                  size={16} 
                  strokeWidth={isActive ? 2 : 1.75} 
                  fill={isActive && item.id !== 'api_keys' ? 'currentColor' : 'none'}
                  style={{ 
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    flexShrink: 0
                  }} 
                />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Profile & Collapse Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* User Card */}
        <div style={{ 
          paddingTop: '16px', 
          borderTop: '1px solid var(--border-default)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
          {!isCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Avatar circle */}
                <div style={{
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
                  color: 'var(--text-primary)'
                }}>
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                </div>
                
                <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 500, 
                    color: 'var(--text-primary)', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}>
                    {user?.email}
                  </div>
                  <div style={{ 
                    fontSize: '10px', 
                    color: 'var(--text-tertiary)', 
                    fontFamily: 'var(--font-mono)',
                    marginTop: '1px'
                  }}>
                    Org ID: {user?.organization_id}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={onLogout} 
                className="btn btn-secondary btn-sm" 
                style={{ width: '100%', height: '32px' }}
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div 
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
                  cursor: 'pointer'
                }}
                title={`${user?.email} (Org: ${user?.organization_id})`}
              >
                {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
              </div>
              
              <button 
                onClick={onLogout} 
                className="btn btn-secondary btn-sm" 
                style={{ width: '32px', height: '32px', padding: 0 }}
                title="Logout"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Collapsible toggle chevron button */}
        <button 
          onClick={onToggleCollapse}
          className="btn btn-secondary"
          style={{
            height: '24px',
            width: '100%',
            padding: 0,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-surface)'
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

    </div>
  );
}
