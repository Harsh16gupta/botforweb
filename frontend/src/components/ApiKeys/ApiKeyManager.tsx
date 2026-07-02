import { useState } from 'react';
import { API_BASE } from '../../services/api';
import type { Organization } from '../../services/api';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  RotateCw, 
  Check, 
  Sparkles,
  MessageSquare,
  Send
} from 'lucide-react';

interface ApiKeyManagerProps {
  org: Organization | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function ApiKeyManager({ org, showToast }: ApiKeyManagerProps) {
  // Key masking
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  
  // Snippet tabs
  const [activeTab, setActiveTab] = useState<'curl' | 'js' | 'python' | 'html'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Widget customizer variables
  const [primaryColor, setPrimaryColor] = useState('#111111');
  const [assistantName, setAssistantName] = useState('Docs Assistant');
  const [logoUrl, setLogoUrl] = useState('');
  const [isWidgetPreviewOpen, setIsWidgetPreviewOpen] = useState(true);
  const [isConfirmRegenOpen, setIsConfirmRegenOpen] = useState(false);

  const presetColors = ['#111111', '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

  const apiKey = org?.api_key || 'bfw_live_mockkey_xxxxxx_999a';

  const maskedKey = showKey 
    ? apiKey 
    : `${apiKey.slice(0, 9)}••••••••••••${apiKey.slice(-4)}`;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    showToast('API Key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Snippets content builder
  const snippets = {
    curl: `curl -X POST "${API_BASE}/api/v1/chat/query" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{"query": "How do I install the CLI?"}'`,
    
    js: `fetch("${API_BASE}/api/v1/chat/query", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}"
  },
  body: JSON.stringify({ query: "How do I install the CLI?" })
})
.then(res => res.json())
.then(data => console.log(data.answer));`,

    python: `import requests

url = "${API_BASE}/api/v1/chat/query"
headers = {
    "X-API-Key": "${apiKey}",
    "Content-Type": "application/json"
}
payload = {"query": "How do I install the CLI?"}

response = requests.post(url, headers=headers, json=payload)
print(response.json()["answer"])`,

    html: `<!-- Add this script before the closing </body> tag -->
<script 
  src="https://cdn.jsdelivr.net/npm/@botforweb/widget@1"
  data-api-key="${apiKey}"
  data-name="${assistantName}"
  data-color="${primaryColor}"
  ${logoUrl ? `data-logo="${logoUrl}"` : ''}
  defer
></script>`
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopiedSnippet(true);
    showToast('Snippet copied to clipboard');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 6.1 API Key Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Public API Key</h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
              Authenticate documentation chatbot widget queries originating from client websites.
            </p>
          </div>
          <button 
            onClick={() => setIsConfirmRegenOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', height: '28px', color: 'var(--danger)' }}
          >
            <RotateCw size={11} />
            Regenerate key
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-input font-mono" 
              readOnly 
              value={maskedKey}
              style={{ 
                background: 'var(--bg-subtle)', 
                border: '1px solid var(--border-default)',
                paddingRight: '40px',
                fontSize: '12px'
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="btn btn-ghost"
              style={{
                position: 'absolute',
                right: '8px',
                padding: 0,
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)'
              }}
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button 
            onClick={handleCopyKey} 
            className="btn btn-secondary"
            style={{ minWidth: '100px', position: 'relative' }}
          >
            {copiedKey ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
          </button>
        </div>
      </div>

      {/* 6.2 Tabbed Integration Snippet Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Developer Integration</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
            Query the API endpoints programmatically or embed the client chat widget directly.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-default)', 
          gap: '16px'
        }}>
          {(['curl', 'js', 'python', 'html'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels = { curl: 'cURL', js: 'JavaScript', python: 'Python', html: 'HTML Widget' };
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 4px 12px 4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 120ms ease'
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Code block container */}
        <div style={{ position: 'relative', width: '100%' }}>
          <pre style={{
            background: '#18181b',
            color: '#e4e4e7',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            overflowX: 'auto',
            lineHeight: '1.6',
            margin: 0,
            border: '1px solid var(--border-default)'
          }}>
            <code>{snippets[activeTab]}</code>
          </pre>

          <button
            onClick={handleCopySnippet}
            className="btn btn-secondary btn-sm"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              height: '28px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          >
            {copiedSnippet ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
            <span>Copy</span>
          </button>
        </div>
      </div>

      {/* 6.3 Widget Preview Card */}
      <div className="card">
        <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
          Widget Customizer
        </h3>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '320px 1fr', 
          gap: '24px' 
        }}>
          {/* Left: Customizer controls */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            borderRight: '1px solid var(--border-default)',
            paddingRight: '24px'
          }}>
            
            {/* Color Swatch Picker */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Primary Color Theme</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPrimaryColor(color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      border: primaryColor === color ? '2px solid var(--text-primary)' : '1px solid var(--border-default)',
                      cursor: 'pointer',
                      boxShadow: 'inset 0 0 0 2px var(--bg-surface)'
                    }}
                  />
                ))}
              </div>
              <input
                type="text"
                className="form-input font-mono"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#111111"
              />
            </div>

            {/* Assistant Name input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assistant Title Name</label>
              <input
                type="text"
                className="form-input"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="e.g. Chat Support"
              />
            </div>

            {/* Logo Image URL */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Logo Icon URL (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>

          </div>

          {/* Right: Mock Browser Widget Preview */}
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            height: '320px',
            overflow: 'hidden'
          }}>
            {/* Mock website content sketch */}
            <div style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexGrow: 1
            }}>
              {/* Fake web header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ width: '60px', height: '12px', background: 'var(--border-strong)', borderRadius: 'var(--radius-sm)' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ width: '32px', height: '8px', background: 'var(--border-default)', borderRadius: 'var(--radius-sm)' }} />
                  <span style={{ width: '32px', height: '8px', background: 'var(--border-default)', borderRadius: 'var(--radius-sm)' }} />
                </div>
              </div>
              {/* Fake web body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '20px' }}>
                <span style={{ width: '80%', height: '16px', background: 'var(--border-strong)', borderRadius: 'var(--radius-sm)' }} />
                <span style={{ width: '95%', height: '8px', background: 'var(--border-default)', borderRadius: 'var(--radius-sm)' }} />
                <span style={{ width: '90%', height: '8px', background: 'var(--border-default)', borderRadius: 'var(--radius-sm)' }} />
                <span style={{ width: '40%', height: '8px', background: 'var(--border-default)', borderRadius: 'var(--radius-sm)' }} />
              </div>
            </div>

            {/* Simulated Float Chat bubble */}
            <button
              onClick={() => setIsWidgetPreviewOpen(!isWidgetPreviewOpen)}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: primaryColor,
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)',
                zIndex: 20,
                transition: 'transform 120ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <MessageSquare size={18} />
            </button>

            {/* Simulated Widget Panel Popup */}
            {isWidgetPreviewOpen && (
              <div style={{
                position: 'absolute',
                bottom: '72px',
                right: '16px',
                width: '240px',
                height: '230px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-popover)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 19,
                animation: 'modal-enter 150ms ease-out'
              }}>
                {/* Widget header */}
                <div style={{
                  background: primaryColor,
                  color: '#ffffff',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={10} />
                    </div>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{assistantName}</span>
                </div>

                {/* Widget Messages */}
                <div style={{ flexGrow: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface)' }}>
                  <div style={{
                    alignSelf: 'flex-start',
                    background: 'var(--bg-subtle)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '10px',
                    color: 'var(--text-primary)',
                    maxWidth: '85%'
                  }}>
                    Hi! Ask me anything about our docs.
                  </div>
                </div>

                {/* Widget Input */}
                <div style={{
                  padding: '8px',
                  borderTop: '1px solid var(--border-default)',
                  display: 'flex',
                  gap: '6px',
                  background: 'var(--bg-surface)'
                }}>
                  <div style={{
                    flexGrow: 1,
                    height: '24px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-subtle)',
                    fontSize: '10px',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-tertiary)'
                  }}>
                    Ask a question...
                  </div>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: 'var(--radius-sm)',
                    background: primaryColor,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.8
                  }}>
                    <Send size={10} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Key Regeneration Warning Modal */}
      {isConfirmRegenOpen && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RotateCw size={20} />
              </div>
              
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Regenerate API Key
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.5' }}>
                  Are you sure you want to regenerate your API Key? All existing client widgets and integrations using this key will fail immediately. This action cannot be undone.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => setIsConfirmRegenOpen(false)}
                  className="btn btn-secondary"
                  style={{ height: '34px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsConfirmRegenOpen(false);
                    showToast('API key regeneration is restricted in preview mode.', 'error');
                  }}
                  className="btn btn-danger"
                  style={{ 
                    height: '34px', 
                    fontSize: '12px', 
                    background: 'var(--danger)', 
                    borderColor: 'var(--danger)',
                    color: 'var(--text-inverse)'
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
