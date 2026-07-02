import { API_BASE } from '../../services/api';
import type { Organization } from '../../services/api';

interface ApiKeyManagerProps {
  org: Organization | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function ApiKeyManager({ org, showToast }: ApiKeyManagerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '6px', color: 'var(--text-primary)' }}>
          Public API Key
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Use this key to authenticate queries originating from public web chat widgets. Keep it confidential.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            className="form-input" 
            readOnly 
            value={org?.api_key || ''} 
            style={{ fontFamily: 'var(--font-mono)', background: '#09090b', fontSize: '13px', border: '1px solid var(--panel-border)' }}
          />
          <button 
            onClick={() => {
              if (org?.api_key) {
                navigator.clipboard.writeText(org.api_key);
                showToast('API Key copied to clipboard');
              }
            }} 
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', fontSize: '13px', padding: '8px 16px' }}
          >
            Copy Key
          </button>
        </div>
      </div>

      {/* Embedding guide */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '12px', color: 'var(--text-primary)' }}>
          Widget Integration
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          To query the chatbot programmatically, perform an HTTP POST request to the chat query API route:
        </p>

        <pre style={{
          background: '#09090b',
          padding: '16px',
          borderRadius: '6px',
          border: '1px solid var(--panel-border)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--text-primary)',
          overflowX: 'auto',
          lineHeight: '1.6'
        }}>
{`curl -X POST "${API_BASE}/api/v1/chat/query" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${org?.api_key || 'YOUR_API_KEY'}" \\
  -d '{"query": "How do I install the CLI?"}'`}
        </pre>
      </div>
    </div>
  );
}
