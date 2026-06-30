import type { DocumentItem, Organization } from '../../services/api';

interface StatsCardsProps {
  documents: DocumentItem[];
  org: Organization | null;
}

export default function StatsCards({ documents, org }: StatsCardsProps) {
  const activeCount = documents.filter(d => d.status === 'active').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Documents</div>
        <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', fontFamily: 'var(--font-heading)' }}>
          {activeCount}
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ingestion Queue</div>
        <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: 'var(--primary-color)', fontFamily: 'var(--font-heading)' }}>
          {processingCount}
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Organization Name</div>
        <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)' }}>
          {org?.name || 'Loading...'}
        </div>
      </div>
    </div>
  );
}
