import React, { useState } from 'react';
import { api } from '../../services/api';
import type { Organization } from '../../services/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  latency_ms?: number;
}

interface ChatSandboxProps {
  org: Organization | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function ChatSandbox({ org, showToast }: ChatSandboxProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    setChatError('');

    try {
      if (!org?.api_key) {
        throw new Error('API Key missing. Make sure your organization is loaded.');
      }

      const res = await api.queryChatbot(org.api_key, userMsg);
      setChatMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: res.answer,
          sources: res.sources || [],
          latency_ms: res.latency_ms
        }
      ]);
    } catch (err: any) {
      setChatError(err.message || 'Chat query failed.');
      showToast(err.message || 'Query failed', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', flexGrow: 1 }}>
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '600px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>RAG Chat Sandbox</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Simulating client widget queries</div>
          </div>
          <button 
            onClick={() => setChatMessages([])} 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Clear History
          </button>
        </div>

        {/* Message list */}
        <div style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {chatMessages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '380px' }}>
              Type a question below to test how the RAG model queries your indexed documentation and cites its sources.
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}>
                <div style={{
                  background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid',
                  borderColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--panel-border)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
                
                {/* Message Metadata */}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {msg.latency_ms && <span>Latency: {msg.latency_ms}ms</span>}
                    {msg.sources && msg.sources.length > 0 && (
                      <span style={{ color: 'var(--accent-color)' }}>
                        Sources: {msg.sources.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Thinking...
            </div>
          )}
          {chatError && (
            <div style={{ alignSelf: 'center', color: 'var(--danger-color)', fontSize: '13px' }}>
              {chatError}
            </div>
          )}
        </div>

        {/* Query Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '20px 24px', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            className="form-input" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a question about the uploaded documents..."
            disabled={chatLoading}
          />
          <button 
            type="submit" 
            className={`btn btn-primary ${chatLoading ? 'btn-disabled' : ''}`}
            disabled={chatLoading}
          >
            Send
          </button>
        </form>

      </div>
    </div>
  );
}
