import type { DocumentItem, Organization } from '../../services/api';
import { FileText, Hourglass, CreditCard } from 'lucide-react';

interface StatsCardsProps {
  documents: DocumentItem[];
  org: Organization | null;
  docsLoading?: boolean;
}

export default function StatsCards({ documents, org, docsLoading = false }: StatsCardsProps) {
  const activeCount = documents.filter(d => d.status === 'active').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;

  if (docsLoading && documents.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div className="grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '90px', height: '12px', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
              </div>
              <div className="skeleton" style={{ width: '50px', height: '28px', borderRadius: 'var(--radius-sm)', marginTop: '4px' }} />
              <div className="skeleton" style={{ width: '120px', height: '10px', borderRadius: 'var(--radius-sm)', marginTop: '2px' }} />
            </div>
          ))}
        </div>

        {/* Sparkline placeholder */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ width: '180px', height: '12px', borderRadius: 'var(--radius-sm)' }} />
            <div className="skeleton" style={{ width: '100px', height: '12px', borderRadius: 'var(--radius-sm)' }} />
          </div>
          <div className="skeleton" style={{ height: '40px', width: '100%', borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      
      {/* Metric Cards Row */}
      <div className="grid-cols-3">
        
        {/* Active Documents */}
        <div className="card card-hover">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '8px' 
          }}>
            <span className="text-xs" style={{ 
              color: 'var(--text-secondary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em' 
            }}>
              Active Documents
            </span>
            <FileText size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)'
          }}>
            {activeCount}
          </div>
          <div className="text-xs" style={{ 
            color: 'var(--text-secondary)', 
            marginTop: '4px'
          }}>
            Available for search queries
          </div>
        </div>

        {/* Ingestion Queue */}
        <div className="card card-hover">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '8px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="text-xs" style={{ 
                color: 'var(--text-secondary)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em' 
              }}>
                Ingestion Queue
              </span>
              {processingCount > 0 && (
                <span 
                  className="badge-dot" 
                  style={{ 
                    background: 'var(--warning)', 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%',
                    animation: 'pulse-opacity 2s ease-in-out infinite' 
                  }} 
                />
              )}
            </div>
            <Hourglass size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)'
          }}>
            {processingCount}
          </div>
          <div className="text-xs" style={{ 
            color: 'var(--text-secondary)', 
            marginTop: '4px' 
          }}>
            {processingCount > 0 ? 'Workers processing files' : 'All systems synchronized'}
          </div>
        </div>

        {/* Subscription / Plan info */}
        <div className="card card-hover">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '8px' 
          }}>
            <span className="text-xs" style={{ 
              color: 'var(--text-secondary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em' 
            }}>
              Tenant Workspace
            </span>
            <CreditCard size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            lineHeight: '28px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {org?.name || 'Loading organization...'}
          </div>
          <div className="text-xs" style={{ 
            color: 'var(--text-secondary)', 
            marginTop: '4px' 
          }}>
            Starter Tier · Up to 5k queries
          </div>
        </div>

      </div>

      {/* 7-day ingestion activity sparkline */}
      <div className="card" style={{ 
        padding: '16px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-xs" style={{ 
            color: 'var(--text-secondary)', 
            fontWeight: 500, 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em' 
          }}>
            7-Day Ingestion Activity
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            daily volume metrics
          </span>
        </div>
        
        {/* Custom SVG Sparkline path */}
        <div style={{ 
          height: '40px', 
          width: '100%', 
          display: 'flex', 
          alignItems: 'flex-end', 
          position: 'relative' 
        }}>
          <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--border-strong)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--border-strong)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Sparkline line */}
            <path 
              d="M0,32 Q60,18 120,28 T240,12 T360,25 T480,5 T600,18 T720,28 T840,15 T960,30 T1080,8" 
              fill="none" 
              stroke="var(--text-tertiary)" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
            {/* Soft gradient fill under sparkline */}
            <path 
              d="M0,32 Q60,18 120,28 T240,12 T360,25 T480,5 T600,18 T720,28 T840,15 T960,30 T1080,8 L1080,40 L0,40 Z" 
              fill="url(#sparklineGrad)" 
              style={{ transition: 'fill var(--transition-normal)' }}
            />
            {/* Soft dot on end of sparkline */}
            <circle cx="1080" cy="8" r="3" fill="var(--text-secondary)" />
          </svg>
        </div>
      </div>

    </div>
  );
}
