import React, { useState } from 'react';
import { api } from '../../services/api';

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
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#09090b' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '6px', color: '#fafafa' }}>
            botforweb
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {isLogin ? 'Sign in to manage your RAG chatbot' : 'Create an account for your organization'}
          </p>
        </div>

        {authError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', borderRadius: '6px', padding: '12px', fontSize: '13px', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Dev Corp"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className={`btn btn-primary ${authLoading ? 'btn-disabled' : ''}`}
            style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 500 }}
            disabled={authLoading}
          >
            {authLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setIsLogin(false); setAuthError(''); }} 
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 500, padding: 0, textDecoration: 'none' }}
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
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 500, padding: 0, textDecoration: 'none' }}
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
  );
}
