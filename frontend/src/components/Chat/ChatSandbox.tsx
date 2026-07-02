import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../services/api';
import type { Organization, ConversationResponse, Message, Citation } from '../../services/api';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Clock, 
  Send, 
  AlertTriangle, 
  BookOpen, 
  HelpCircle,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatSandboxProps {
  token: string;
  org: Organization | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
  initialActiveConvId?: number | null;
  clearInitialActiveConvId?: () => void;
}

export default function ChatSandbox({ 
  token, 
  org, 
  showToast,
  initialActiveConvId,
  clearInitialActiveConvId
}: ChatSandboxProps) {
  // Conversations list state
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [searchThreadQuery, setSearchThreadQuery] = useState('');
  
  // Selected conversation
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Chat query state
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Custom tracking for citations and warnings of the active turn
  const [lastTurnCitations, setLastTurnCitations] = useState<Record<number, Citation[]>>({});
  
  // Active selected citation for slide drawer panel
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading]);

  // initialActiveConvId effect router hook
  useEffect(() => {
    if (initialActiveConvId !== undefined && initialActiveConvId !== null) {
      selectConversation(initialActiveConvId);
      if (clearInitialActiveConvId) clearInitialActiveConvId();
    }
  }, [initialActiveConvId]);

  // Load conversations list
  const loadConversations = async (silent = false) => {
    if (!silent) setConversationsLoading(true);
    try {
      const data = await api.getConversations(token);
      setConversations(data);
    } catch (err: any) {
      console.error(err);
      showToast('Failed to load conversations list', 'error');
    } finally {
      if (!silent) setConversationsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token]);

  // Load conversation detail
  const selectConversation = async (conversationId: number) => {
    setActiveConversationId(conversationId);
    setMessagesLoading(true);
    setActiveCitation(null);
    try {
      const data = await api.getConversation(token, conversationId);
      setMessages(data.messages || []);
      setLastTurnCitations({});
    } catch (err: any) {
      showToast(err.message || 'Failed to load messages', 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Start new conversation
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setChatInput('');
    setLastTurnCitations({});
    setActiveCitation(null);
    showToast('Started new test sandbox conversation');
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userQuery = chatInput;
    setChatInput('');
    setActiveCitation(null);
    
    // Optimistic local state update for user message
    const tempUserMsg: Message = {
      id: Math.random(),
      conversation_id: activeConversationId || 0,
      role: 'user',
      content: userQuery,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMsg]);
    setChatLoading(true);

    try {
      if (!org?.api_key) {
        throw new Error('API Key missing. Load your organization settings.');
      }

      const res = await api.queryChatbot(org.api_key, userQuery, activeConversationId);
      
      // Update active thread ID if it was a new conversation
      const returnedConvId = res.conversation_id;
      if (!activeConversationId && returnedConvId) {
        setActiveConversationId(returnedConvId);
        loadConversations(true);
      }

      // Create message objects for local rendering
      const assistantMsg: Message = {
        id: Math.random(),
        conversation_id: returnedConvId,
        role: 'assistant',
        content: res.answer,
        latency_ms: res.latency_ms,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Store citations locally mapped by message ID
      if (res.citations && res.citations.length > 0) {
        setLastTurnCitations(prev => ({
          ...prev,
          [assistantMsg.id]: res.citations
        }));
      }

    } catch (err: any) {
      showToast(err.message || 'Sandbox query failed', 'error');
      // Remove optimistic user message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setChatLoading(false);
    }
  };

  // Filter conversations list
  const filteredConversations = useMemo(() => {
    if (!searchThreadQuery.trim()) return conversations;
    const q = searchThreadQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, searchThreadQuery]);

  // Relative timestamp parsing helper
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Custom code blocks renderer for markdown (permanently themed code background variables)
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      return inline ? (
        <code className="font-mono text-xs" style={{ background: 'var(--bg-muted)', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-primary)' }} {...props}>
          {children}
        </code>
      ) : (
        <pre style={{
          background: 'var(--bg-code-block)',
          color: 'var(--text-code-block)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          overflowX: 'auto',
          margin: '8px 0',
          border: '1px solid var(--border-code-block)'
        }}>
          <code className="font-mono" style={{ fontSize: '12px' }} {...props}>
            {children}
          </code>
        </pre>
      );
    }
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '260px 1fr', 
      gap: 0, 
      flexGrow: 1, 
      height: '620px', 
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }}>
      
      {/* 7.1 Left Column: Conversations List */}
      <div style={{
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        height: '100%'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Conversations
          </span>
          <button 
            onClick={handleNewConversation}
            className="btn btn-secondary btn-sm"
            style={{ width: '26px', height: '26px', padding: 0, borderRadius: 'var(--radius-sm)' }}
            title="New Chat"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '20px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search threads..."
            value={searchThreadQuery}
            onChange={(e) => setSearchThreadQuery(e.target.value)}
            style={{ 
              height: '30px', 
              paddingLeft: '26px', 
              fontSize: '11px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: 'none'
            }}
          />
        </div>

        {/* Threads List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {conversationsLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
              Loading threads...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
              {searchThreadQuery.trim() ? (
                <>No threads match &ldquo;{searchThreadQuery}&rdquo;</>
              ) : (
                <>No conversations yet</>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`thread-list-item ${isActive ? 'active' : ''}`}
                  style={{
                    background: isActive ? 'var(--bg-subtle)' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <span 
                    className="text-xs font-medium" 
                    style={{ 
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}
                  >
                    {conv.title}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(conv.created_at).toLocaleDateString()}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 7.2 Right Column: Chat Pane */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Chat Pane Header */}
        <div style={{
          height: '49px',
          borderBottom: '1px solid var(--border-default)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {activeConversationId 
                ? conversations.find(c => c.id === activeConversationId)?.title || 'Test Thread' 
                : 'Sandbox Simulator'}
            </span>
          </div>
          <button 
            onClick={handleNewConversation}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', height: '28px' }}
          >
            Clear playground
          </button>
        </div>

        {/* Message Container Turn list */}
        <div style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {messagesLoading ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <div className="animate-pulse-opacity">Loading thread history...</div>
            </div>
          ) : messages.length === 0 && !chatLoading ? (
            <div style={{ 
              margin: 'auto', 
              textAlign: 'center', 
              maxWidth: '360px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}>
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Interact with the RAG Bot
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Ask questions about the documents in your index. You'll see real-time generation times, source documents, and trust flags.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const msgCitations = lastTurnCitations[msg.id] || [];
                const isHallucinating = msg.content.includes('WARNING:');
                
                // Clean content helper to strip warning if we display a banner
                let displayContent = msg.content;
                if (isHallucinating) {
                  displayContent = msg.content.replace(/^WARNING:\s*/i, '').replace(/This answer may contain unsupported details\.\s*/i, '');
                }

                return (
                  <div 
                    key={msg.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: '6px'
                    }}
                  >
                    {/* User turns */}
                    {isUser ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', maxWidth: '75%' }}>
                        <div style={{
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '10px 14px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          boxShadow: 'var(--shadow-xs)',
                          wordBreak: 'break-word'
                        }}>
                          {msg.content}
                        </div>
                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    ) : (
                      /* Assistant turns */
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        
                        {/* Redesigned Hallucination Warning Banner */}
                        {isHallucinating && (
                          <div style={{
                            background: 'linear-gradient(90deg, var(--warning-bg), var(--bg-surface))',
                            border: '1px solid rgba(202, 138, 4, 0.25)',
                            borderLeft: '3px solid var(--warning)',
                            color: 'var(--warning)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '6px',
                            boxShadow: 'var(--shadow-xs)',
                            animation: 'pulse-opacity 3.5s ease-in-out infinite'
                          }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zero-Hallucination Guard Warning</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>This answer contains details not cited in the indexed knowledge base. Verify carefully.</span>
                            </div>
                          </div>
                        )}

                        {/* Heading */}
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <MessageSquare size={12} />
                          <span>Assistant</span>
                          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
                            · {formatTime(msg.created_at)}
                          </span>
                        </div>

                        {/* Rich Text Response */}
                        <div style={{ 
                          fontSize: '13px', 
                          lineHeight: '1.6', 
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          wordBreak: 'break-word'
                        }} className="markdown-body">
                          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                            {displayContent}
                          </ReactMarkdown>
                        </div>

                        {/* Metadata row */}
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          alignItems: 'center', 
                          gap: '10px', 
                          marginTop: '6px',
                          borderTop: '1px solid var(--border-default)',
                          paddingTop: '6px'
                        }}>
                          {msg.latency_ms && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                              <Clock size={11} />
                              {msg.latency_ms}ms
                            </span>
                          )}

                          {msgCitations.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginRight: '2px' }}>·</span>
                              {msgCitations.map((citation, idx) => {
                                const isSelected = activeCitation?.text === citation.text;
                                return (
                                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setActiveCitation(isSelected ? null : citation)}
                                      className="btn btn-secondary"
                                      style={{
                                        height: '20px',
                                        padding: '0 8px',
                                        fontSize: '10px',
                                        borderRadius: 'var(--radius-full)',
                                        background: isSelected ? 'var(--bg-selected)' : 'var(--bg-muted)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-secondary)',
                                        gap: '3px',
                                        transition: 'background var(--transition-fast)'
                                      }}
                                    >
                                      <BookOpen size={10} />
                                      {citation.filename}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Thinking State */}
          {chatLoading && (
            <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-start' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={12} />
                Assistant
              </div>
              <div style={{ display: 'flex', gap: '4px', padding: '6px 12px', alignItems: 'center', height: '24px' }}>
                <span className="thinking-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse-opacity 1.2s infinite ease-in-out', animationDelay: '0ms' }} />
                <span className="thinking-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse-opacity 1.2s infinite ease-in-out', animationDelay: '200ms' }} />
                <span className="thinking-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse-opacity 1.2s infinite ease-in-out', animationDelay: '400ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Textarea Send form */}
        <form 
          onSubmit={handleSendMessage}
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xs)',
            overflow: 'hidden',
            padding: '4px'
          }}>
            <textarea
              className="form-textarea"
              rows={1}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Ask a question about the uploaded documents..."
              disabled={chatLoading}
              style={{
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                resize: 'none',
                height: '36px',
                padding: '8px 48px 8px 12px',
                fontSize: '13px',
                lineHeight: '1.4'
              }}
            />
            
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="btn btn-primary"
              style={{
                position: 'absolute',
                right: '8px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: chatInput.trim() ? 'var(--accent)' : 'var(--bg-muted)',
                borderColor: 'transparent',
                color: 'var(--bg-surface)'
              }}
            >
              <Send size={12} />
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {chatInput.length} characters {chatInput.length > 0 && `(approx. ${Math.ceil(chatInput.length / 4)} tokens)`}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              Press Shift + Enter for new line
            </span>
          </div>
        </form>

        {/* Right-side Citation Slide-out Panel */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-popover)',
          transform: activeCitation ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--transition-normal)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Drawer Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-app)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={14} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Citation Source
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveCitation(null)}
              className="btn btn-ghost"
              style={{ padding: '4px', height: '24px', width: '24px', borderRadius: 'var(--radius-sm)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '16px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Document Filename</span>
              <h4 className="text-xs font-medium" style={{ color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-all' }}>
                {activeCitation?.filename}
              </h4>
            </div>
            
            <div style={{ height: '1px', background: 'var(--border-default)' }} />
            
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>Source Excerpt Content</span>
              <pre style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
                overflowX: 'auto',
                margin: 0,
                flexGrow: 1
              }}>
                <code>{activeCitation?.text}</code>
              </pre>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
