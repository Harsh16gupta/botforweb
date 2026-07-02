import React, { useRef, useState } from 'react';
import { api } from '../../services/api';
import type { DocumentItem } from '../../services/api';

interface DocumentManagerProps {
  token: string;
  documents: DocumentItem[];
  docsLoading: boolean;
  fetchDocuments: (silent?: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function DocumentManager({ token, documents, docsLoading, fetchDocuments, showToast }: DocumentManagerProps) {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadLoading(true);
    setUploadError('');
    
    const file = files[0];

    try {
      await api.uploadDocument(token, file);
      showToast('Document uploaded successfully. Processing started.');
      fetchDocuments(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document? This will also remove all associated vector embeddings.')) return;

    try {
      await api.deleteDocument(token, docId);
      showToast('Document deleted successfully');
      fetchDocuments(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
      
      {/* File Dropzone / Uploader */}
      <div className="uploader-area">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
          accept=".pdf,.md,.zip"
        />
        
        <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-primary)' }}>
              Upload documentation files
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Drag and drop or click to choose PDF, Markdown, or ZIP files
            </p>
          </div>
          
          {uploadError && (
            <div style={{ color: 'var(--danger-color)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{uploadError}</div>
          )}

          <button 
            onClick={() => fileInputRef.current?.click()} 
            className={`btn btn-secondary ${uploadLoading ? 'btn-disabled' : ''}`}
            disabled={uploadLoading}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {uploadLoading ? 'Uploading...' : 'Select File'}
          </button>
        </div>
      </div>

      {/* Document List Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--panel-border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Indexed Knowledge</h3>
        </div>
        
        {docsLoading && documents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            No documents indexed yet. Upload markdown or PDF files to feed the chatbot.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Type</th>
                <th>Status</th>
                <th>Uploaded At</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{doc.filename}</td>
                  <td>
                    <code style={{ 
                      textTransform: 'uppercase', 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      border: '1px solid var(--panel-border)',
                      padding: '2px 6px', 
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '3px',
                      color: 'var(--text-secondary)'
                    }}>
                      {doc.file_type}
                    </code>
                  </td>
                  <td>
                    <span className={`badge badge-${doc.status}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(doc.created_at).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDeleteDocument(doc.id)} 
                      style={{ padding: '6px', color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }}
                      title="Delete document"
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger-color)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
