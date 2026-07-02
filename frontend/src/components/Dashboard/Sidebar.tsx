import { useState } from 'react';
import type { User } from '../../services/api';
import { 
  FileText, 
  Key, 
  MessageSquare, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Command,
  MoreHorizontal,
  User as UserIcon,
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: 'documents' | 'api_keys' | 'sandbox';
  setActiveTab: (tab: 'documents' | 'api_keys' | 'sandbox') => void;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ 
  user, 
  activeTab, 
  setActiveTab, 
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}: SidebarProps) {
  
  const [isFooterMenuOpen, setIsFooterMenuOpen] = useState(false);

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
    <div 
      className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}
      style={{ 
        width: isCollapsed ? '64px' : '240px', 
        background: 'var(--bg-surface)', 
        borderRight: '1px solid var(--border-default)', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: isCollapsed ? '16px 8px' : '24px 16px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width var(--transition-normal), padding var(--transition-normal), transform var(--transition-normal)',
        zIndex: 1000,
        justifyContent: 'space-between'
      }}
    >
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
            
            const buttonMarkup = (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onCloseMobile();
                }} 
                className={`btn sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{ 
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  width: '100%', 
                  padding: '8px 12px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  boxShadow: 'none',
                  background: 'transparent'
                }}
              >
                <Icon 
                  size={16} 
                  strokeWidth={isActive ? 2 : 1.75} 
                  fill={isActive && item.id !== 'api_keys' ? 'currentColor' : 'none'}
                  style={{ 
                    color: 'inherit',
                    flexShrink: 0
                  }} 
                />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );

            if (isCollapsed) {
              return (
                <div key={item.id} className="tooltip-container tooltip-right" style={{ width: '100%' }}>
                  {buttonMarkup}
                  <div className="tooltip-content">{item.label}</div>
                </div>
              );
            }

            return buttonMarkup;
          })}
        </nav>
      </div>

      {/* Bottom Section: Profile & Collapse Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
        
        {/* User Card */}
        <div style={{ 
          paddingTop: '16px', 
          borderTop: '1px solid var(--border-default)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
                  color: 'var(--text-primary)',
                  flexShrink: 0
                }}>
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                </div>
                
                <div style={{ overflow: 'hidden', minWidth: 0 }}>
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
                </div>
              </div>

              {/* Popup trigger */}
              <button
                onClick={() => setIsFooterMenuOpen(!isFooterMenuOpen)}
                className="btn btn-ghost"
                style={{ padding: 0, width: '24px', height: '24px', borderRadius: 'var(--radius-sm)' }}
                aria-label="User account settings"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div 
                onClick={() => setIsFooterMenuOpen(!isFooterMenuOpen)}
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
                title={user?.email || 'User settings'}
              >
                {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
              </div>
            </div>
          )}

          {/* Unified Popup Footer Menu */}
          {isFooterMenuOpen && (
            <>
              <div onClick={() => setIsFooterMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
              <div style={{
                position: 'absolute',
                left: isCollapsed ? '52px' : '0',
                bottom: '48px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-popover)',
                width: '180px',
                padding: '4px',
                zIndex: 99,
                animation: 'modal-enter 120ms ease-out',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default)', marginBottom: '4px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </p>
                  <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    Org ID: {user?.organization_id}
                  </p>
                </div>

                <button
                  onClick={() => { setIsFooterMenuOpen(false); alert('Profile settings opened'); }}
                  className="btn btn-ghost"
                  style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'flex-start', padding: '0 8px', border: 'none' }}
                >
                  <UserIcon size={12} />
                  Profile Settings
                </button>

                <button
                  onClick={() => { setIsFooterMenuOpen(false); alert('Help resources opened'); }}
                  className="btn btn-ghost"
                  style={{ height: '30px', width: '100%', fontSize: '12px', justifyContent: 'flex-start', padding: '0 8px', border: 'none' }}
                >
                  <HelpCircle size={12} />
                  Help & Support
                </button>

                <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />

                <button
                  onClick={() => { setIsFooterMenuOpen(false); onLogout(); }}
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
