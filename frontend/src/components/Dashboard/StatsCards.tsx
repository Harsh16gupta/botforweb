import type { DocumentItem, Organization } from '../../services/api';

interface StatsCardsProps {
  documents: DocumentItem[];
  org: Organization | null;
}

export default function StatsCards({ documents, org }: StatsCardsProps) {
  const activeCount = documents.filter(d => d.status === 'active').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          Active Documents
        </div>
        <div style={{ fontSize: '24px', fontWeight: 600, marginTop: '8px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {activeCount}
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          Ingestion Queue
        </div>
        <div style={{ fontSize: '24px', fontWeight: 600, marginTop: '8px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {processingCount}
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          Organization Name
        </div>
        <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {org?.name || 'Loading...'}
        </div>
      </div>
    </div>
  );
}
