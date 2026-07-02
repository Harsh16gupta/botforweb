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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', flexGrow: 1 }}>
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '600px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>RAG Chat Sandbox</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Simulating client widget queries</div>
          </div>
          <button 
            onClick={() => setChatMessages([])} 
            className="btn btn-secondary" 
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            Clear History
          </button>
        </div>

        {/* Message list */}
        <div style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {chatMessages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '380px' }}>
              Type a question below to test how the RAG model queries your indexed documentation and cites its sources.
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignSelf: 'stretch'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  color: msg.role === 'user' ? 'var(--accent-color)' : 'var(--text-primary)' 
                }}>
                  {msg.role === 'user' ? 'User' : 'Assistant'}
                </div>
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)'
                }}>
                  {msg.content}
                </div>
                
                {/* Message Metadata & Citations */}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {msg.latency_ms && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Latency: {msg.latency_ms}ms
                      </span>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {msg.sources.map((src, idx) => (
                          <span key={idx} style={{ 
                            background: '#27272a', 
                            color: 'var(--text-secondary)', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            border: '1px solid rgba(255,255,255,0.02)'
                          }}>
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {chatLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'stretch' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Assistant</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Thinking...</div>
            </div>
          )}
          {chatError && (
            <div style={{ alignSelf: 'center', color: 'var(--danger-color)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
              {chatError}
            </div>
          )}
        </div>

        {/* Query Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '16px 24px', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            className="form-input" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a question about the uploaded documents..."
            disabled={chatLoading}
            style={{ fontSize: '14px' }}
          />
          <button 
            type="submit" 
            className={`btn btn-primary ${chatLoading ? 'btn-disabled' : ''}`}
            disabled={chatLoading}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Send
          </button>
        </form>

      </div>
    </div>
  );
}
