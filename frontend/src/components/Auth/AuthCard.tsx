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
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px' }}>
            botforweb <span style={{ color: 'var(--primary-color)' }}>SaaS</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isLogin ? 'Sign in to manage your RAG chatbot' : 'Create an account for your organization'}
          </p>
        </div>

        {authError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', borderRadius: '8px', padding: '12px', fontSize: '13px', marginBottom: '20px' }}>
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

          <div className="form-group" style={{ marginBottom: '28px' }}>
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
            style={{ width: '100%', padding: '12px' }}
            disabled={authLoading}
          >
            {authLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setIsLogin(false); setAuthError(''); }} 
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500, padding: 0 }}
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
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500, padding: 0 }}
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
