import React, { useState } from 'react';
import { api } from '../../services/api';
import { AlertTriangle, Command, MessageSquare, Clock, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface AuthCardProps {
  onAuthSuccess: (token: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function AuthCard({ onAuthSuccess, showToast }: AuthCardProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isEmailError = authError.toLowerCase().includes('email') || authError.toLowerCase().includes('user');
  const isPasswordError = authError.toLowerCase().includes('password');
  const isOrgError = authError.toLowerCase().includes('organization') || authError.toLowerCase().includes('org');
  const genericError = !isEmailError && !isPasswordError && !isOrgError ? authError : '';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isLogin) {
        const token = await api.login(email, password);
        localStorage.setItem('bfw_token', token);
        onAuthSuccess(token);
        showToast('Login successful');
      } else {
        await api.signup(email, password, orgName);
        setIsLogin(true);
        showToast('Signup successful. Please sign in.');
        setPassword('');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
      showToast(err.message || 'Auth action failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      
      {/* Left Column (60%): Auth Forms */}
      <div style={{
        flex: '1 1 60%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 60px',
        maxWidth: '100%'
      }}>
        <div style={{ maxWidth: '360px', width: '100%', margin: '0 auto' }}>
          
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bg-surface)'
            }}>
              <Command size={16} strokeWidth={2} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              botforweb
            </span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="text-2xl" style={{ letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {isLogin ? 'Sign in to botforweb' : 'Create your organization'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? 'Enter your details to manage your RAG chatbot' : 'Set up your documentation knowledge base'}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {/* Keyframes style block for loading spinner */}
             <style>{`
               @keyframes auth-spin {
                 to { transform: rotate(360deg); }
               }
               .auth-spinner {
                 animation: auth-spin 0.8s linear infinite;
               }
             `}</style>

             {!isLogin && (
               <div className="form-group" style={{ marginBottom: 0 }}>
                 <label className="form-label">Organization Name</label>
                 <input 
                   type="text" 
                   className="form-input" 
                   value={orgName}
                   onChange={(e) => setOrgName(e.target.value)}
                   placeholder="Acme Corporation"
                   required
                 />
                 {isOrgError && (
                   <span style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
                     {authError}
                   </span>
                 )}
               </div>
             )}

             <div className="form-group" style={{ marginBottom: 0 }}>
               <label className="form-label">Email Address</label>
               <input 
                 type="email" 
                 className="form-input" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="you@work.com"
                 required
               />
               {isEmailError && (
                 <span style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
                   {authError}
                 </span>
               )}
             </div>

             <div className="form-group" style={{ marginBottom: 0 }}>
               <label className="form-label">Password</label>
               <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                 <input 
                   type={showPassword ? 'text' : 'password'} 
                   className="form-input" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   placeholder="••••••••"
                   required
                   style={{ paddingRight: '40px' }}
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className="btn btn-ghost"
                   style={{
                     position: 'absolute',
                     right: '6px',
                     padding: 0,
                     width: '28px',
                     height: '28px',
                     borderRadius: 'var(--radius-sm)'
                   }}
                   title={showPassword ? "Hide password" : "Show password"}
                 >
                   {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                 </button>
               </div>
               {isPasswordError && (
                 <span style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
                   {authError}
                 </span>
               )}
             </div>

             {/* Generic Error Banner */}
             {genericError && (
               <div style={{
                 display: 'flex',
                 alignItems: 'flex-start',
                 gap: '8px',
                 background: 'var(--danger-bg)',
                 color: 'var(--danger)',
                 border: '1px solid rgba(220, 38, 38, 0.15)',
                 borderRadius: 'var(--radius-md)',
                 padding: '10px 12px',
                 fontSize: '12px',
                 fontWeight: 500,
                 lineHeight: '1.4',
                 marginTop: '4px'
               }}>
                 <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                 <span>{genericError}</span>
               </div>
             )}

             <button 
               type="submit" 
               className="btn btn-primary btn-lg"
               style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
               disabled={authLoading}
             >
               {authLoading && (
                 <span className="auth-spinner" style={{ 
                   display: 'inline-block', 
                   width: '14px', 
                   height: '14px', 
                   border: '2px solid currentColor', 
                   borderTopColor: 'transparent', 
                   borderRadius: '50%' 
                 }} />
               )}
               <span>{authLoading ? (isLogin ? 'Signing in...' : 'Registering...') : isLogin ? 'Sign In' : 'Create Account'}</span>
             </button>
          </form>

          {/* Mode Switcher */}
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {isLogin ? (
              <>
                New to botforweb?{' '}
                <button 
                  type="button" 
                  onClick={() => { setIsLogin(false); setAuthError(''); }} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    padding: 0,
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  Register organization
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => { setIsLogin(true); setAuthError(''); }} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    padding: 0,
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column (40%): Product Feature Panel */}
      <div style={{
        flex: '1 1 40%',
        background: 'var(--bg-subtle)',
        borderLeft: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        overflow: 'hidden'
      }} className="auth-feature-panel">
        
        <div style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header text */}
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Answer every developer question.
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Connect your PDFs, Markdown directories, and ZIP archives. Let our hybrid dense/sparse RAG engine serve accurate, cited responses in milliseconds.
            </p>
          </div>

          {/* High Fidelity CSS Sandbox Mockup */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            width: '100%',
            height: '240px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Fake Browser Topbar */}
            <div style={{
              height: '32px',
              borderBottom: '1px solid var(--border-default)',
              background: 'var(--bg-app)',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)',
                padding: '1px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)'
              }}>
                sandbox.botforweb.io
              </div>
              <div style={{ width: '32px' }} />
            </div>

            {/* Chat Simulation Content */}
            <div style={{
              flexGrow: 1,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'var(--bg-surface)',
              overflowY: 'hidden'
            }}>
              {/* User Bubble */}
              <div style={{ alignSelf: 'flex-end', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: '11px', maxWidth: '80%' }}>
                How do I install the CLI?
              </div>

              {/* Bot response */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <MessageSquare size={10} />
                  Assistant
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Install the package globally via npm:
                  <div style={{
                    background: '#18181b',
                    color: '#e4e4e7',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    margin: '4px 0',
                    border: '1px solid var(--border-default)'
                  }}>
                    npm install -g @botforweb/cli
                  </div>
                </div>

                {/* Citations / Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: 'var(--text-tertiary)' }}>
                    <Clock size={8} /> 142ms
                  </span>
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--success)',
                    background: 'var(--success-bg)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 500
                  }}>
                    cli-setup.md
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Security stamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
            <span>Strict Row-Level Security & collection isolation.</span>
          </div>
        </div>
      </div>

      {/* Inline styles for media query hides */}
      <style>{`
        @media (max-width: 1024px) {
          .auth-feature-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
