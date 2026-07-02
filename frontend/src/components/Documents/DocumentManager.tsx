import React, { useRef, useState, useMemo } from 'react';
import { api } from '../../services/api';
import type { DocumentItem } from '../../services/api';
import { 
  Search, 
  Plus, 
  UploadCloud, 
  X, 
  MoreVertical, 
  Trash2, 
  FileText, 
  Archive,
  Check, 
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DocumentManagerProps {
  token: string;
  documents: DocumentItem[];
  docsLoading: boolean;
  fetchDocuments: (silent?: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'success' | 'failed';
  error?: string;
}

export default function DocumentManager({ 
  token, 
  documents, 
  docsLoading, 
  fetchDocuments, 
  showToast 
}: DocumentManagerProps) {
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'md' | 'zip'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'processing' | 'failed'>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof DocumentItem>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Dropdown menu state per row
  const [activeKebabDocId, setActiveKebabDocId] = useState<number | null>(null);

  // Uploader queue state
  const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time formatter helper
  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    
    if (isNaN(date.getTime())) return 'Unknown date';
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  // Sort & Filter documents
  const filteredAndSortedDocs = useMemo(() => {
    let result = [...documents];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(doc => doc.filename.toLowerCase().includes(q));
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(doc => doc.file_type.toLowerCase() === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(doc => doc.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [documents, searchQuery, typeFilter, statusFilter, sortField, sortDirection]);

  // Paginated docs
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedDocs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedDocs, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedDocs.length / itemsPerPage);

  // File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
  };

  const addFilesToQueue = (files: File[]) => {
    const validExtensions = ['.pdf', '.md', '.zip'];
    const newQueued: QueuedFile[] = [];

    files.forEach(file => {
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (validExtensions.includes(extension)) {
        newQueued.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          progress: 0,
          status: 'queued'
        });
      } else {
        showToast(`Skipped ${file.name}: Only .pdf, .md, and .zip files supported.`, 'error');
      }
    });

    setUploadQueue(prev => [...prev, ...newQueued]);
  };

  const removeQueueFile = (id: string) => {
    setUploadQueue(prev => prev.filter(f => f.id !== id));
  };

  const executeUploadQueue = async () => {
    const pending = uploadQueue.filter(f => f.status === 'queued' || f.status === 'failed');
    if (pending.length === 0) return;

    // Set status to uploading
    setUploadQueue(prev => prev.map(f => {
      if (f.status === 'queued' || f.status === 'failed') {
        return { ...f, status: 'uploading', progress: 10 };
      }
      return f;
    }));

    for (const item of pending) {
      try {
        // Simulate linear progress up to 80% quickly
        const progressInterval = setInterval(() => {
          setUploadQueue(prev => prev.map(f => {
            if (f.id === item.id && f.status === 'uploading' && f.progress < 80) {
              return { ...f, progress: f.progress + 15 };
            }
            return f;
          }));
        }, 150);

        await api.uploadDocument(token, item.file);

        clearInterval(progressInterval);
        setUploadQueue(prev => prev.map(f => {
          if (f.id === item.id) {
            return { ...f, status: 'success', progress: 100 };
          }
          return f;
        }));
      } catch (err: any) {
        setUploadQueue(prev => prev.map(f => {
          if (f.id === item.id) {
            return { 
              ...f, 
              status: 'failed', 
              progress: 0, 
              error: err.message || 'Upload failed' 
            };
          }
          return f;
        }));
      }
    }

    showToast('Ingestion pipeline triggered for uploaded files');
    fetchDocuments(true);
  };

  const handleSingleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document? This will remove all associated vector embeddings.')) return;
    try {
      await api.deleteDocument(token, docId);
      showToast('Document deleted');
      setSelectedDocIds(prev => prev.filter(id => id !== docId));
      fetchDocuments(true);
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedDocIds.length} selected documents?`)) return;

    const idsToDelete = [...selectedDocIds];
    setSelectedDocIds([]); // Clear selection
    showToast(`Deleting ${idsToDelete.length} documents...`);

    let successCount = 0;
    for (const docId of idsToDelete) {
      try {
        await api.deleteDocument(token, docId);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete document ${docId}`, err);
      }
    }

    showToast(`Successfully deleted ${successCount} documents`);
    fetchDocuments(true);
  };

  const toggleSelectAll = () => {
    const currentDocIds = paginatedDocs.map(doc => doc.id);
    const allSelected = currentDocIds.every(id => selectedDocIds.includes(id));
    
    if (allSelected) {
      // Unselect all on the current page
      setSelectedDocIds(prev => prev.filter(id => !currentDocIds.includes(id)));
    } else {
      // Select all on the current page
      setSelectedDocIds(prev => [...new Set([...prev, ...currentDocIds])]);
    }
  };

  const handleRowCheckbox = (docId: number) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSort = (field: keyof DocumentItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
      
      {/* 5.1 Toolbar Row */}
      {selectedDocIds.length > 0 ? (
        /* Bulk Action Mode */
        <div style={{
          background: 'var(--danger-bg)',
          border: '1px solid rgba(220, 38, 38, 0.15)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'modal-enter 120ms ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              {selectedDocIds.length} files selected
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleBulkDelete}
              className="btn btn-danger btn-sm"
            >
              <Trash2 size={13} />
              Delete Selected
            </button>
            <button 
              onClick={() => setSelectedDocIds([])}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Standard Filter Mode */
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '8px', 
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  color: 'var(--text-tertiary)' 
                }} 
              />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search index..." 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ 
                  paddingLeft: '32px', 
                  width: '240px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'none',
                  height: '34px'
                }}
              />
            </div>

            {/* File Type Filter */}
            <select 
              className="form-select text-xs font-medium"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
              style={{ height: '34px', background: 'var(--bg-surface)' }}
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF Docs</option>
              <option value="md">Markdown</option>
              <option value="zip">ZIP Archives</option>
            </select>

            {/* Status Filter */}
            <select 
              className="form-select text-xs font-medium"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              style={{ height: '34px', background: 'var(--bg-surface)' }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <button 
            onClick={() => { setIsUploadModalOpen(true); setUploadQueue([]); }} 
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            Upload documents
          </button>
        </div>
      )}

      {/* 5.3 Data Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        
        {docsLoading && documents.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="animate-pulse-opacity text-sm font-medium">Loading indexed metadata...</div>
          </div>
        ) : filteredAndSortedDocs.length === 0 ? (
          /* Empty State */
          <div style={{ 
            padding: '64px 24px', 
            textAlign: 'center', 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)'
            }}>
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                No documents indexed
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 auto' }}>
                Upload PDF files or Markdown directories to bootstrap your RAG chat widgets.
              </p>
            </div>
            <button 
              onClick={() => { setIsUploadModalOpen(true); setUploadQueue([]); }} 
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '4px' }}
            >
              Select files
            </button>
          </div>
        ) : (
          /* Table Layout */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ 
                  background: 'var(--bg-app)', 
                  borderBottom: '1px solid var(--border-default)',
                  height: '38px'
                }}>
                  {/* Select Checkbox Column */}
                  <th style={{ width: '40px', padding: '0 16px' }}>
                    <input 
                      type="checkbox" 
                      onChange={toggleSelectAll}
                      checked={
                        paginatedDocs.length > 0 && 
                        paginatedDocs.every(doc => selectedDocIds.includes(doc.id))
                      }
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  
                  <th 
                    onClick={() => handleSort('filename')}
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: 500, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      padding: '10px 16px',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Filename
                  </th>
                  
                  <th style={{ 
                    fontSize: '11px', 
                    fontWeight: 500, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    padding: '10px 16px',
                    width: '100px'
                  }}>
                    Type
                  </th>
                  
                  <th 
                    onClick={() => handleSort('status')}
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: 500, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      padding: '10px 16px',
                      cursor: 'pointer',
                      width: '140px',
                      userSelect: 'none'
                    }}
                  >
                    Status
                  </th>
                  
                  <th 
                    onClick={() => handleSort('created_at')}
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: 500, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      padding: '10px 16px',
                      cursor: 'pointer',
                      width: '150px',
                      userSelect: 'none'
                    }}
                  >
                    Uploaded
                  </th>
                  
                  <th style={{ width: '60px', padding: '0 16px', textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {paginatedDocs.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  const isKebabOpen = activeKebabDocId === doc.id;
                  
                  return (
                    <tr 
                      key={doc.id}
                      style={{ 
                        height: '46px',
                        borderBottom: '1px solid var(--border-default)',
                        background: isChecked ? 'rgba(244, 244, 245, 0.4)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '0 16px' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleRowCheckbox(doc.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Filename */}
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {doc.file_type.toLowerCase() === 'zip' ? (
                            <Archive size={14} style={{ color: 'var(--text-secondary)' }} />
                          ) : (
                            <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                          )}
                          <span 
                            title={doc.filename}
                            style={{ 
                              maxWidth: '320px', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {doc.filename}
                          </span>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg-muted)',
                          color: 'var(--text-secondary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          textTransform: 'uppercase'
                        }}>
                          {doc.file_type}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 16px' }}>
                        <span className={`badge badge-${doc.status}`}>
                          <span className="badge-dot" />
                          <span style={{ textTransform: 'capitalize' }}>{doc.status}</span>
                        </span>
                      </td>

                      {/* Upload Relative Time */}
                      <td 
                        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}
                        title={new Date(doc.created_at).toLocaleString()}
                      >
                        {formatRelativeTime(doc.created_at)}
                      </td>

                      {/* Action Kebab */}
                      <td style={{ padding: '0 16px', textAlign: 'right', position: 'relative' }}>
                        <button
                          onClick={() => setActiveKebabDocId(isKebabOpen ? null : doc.id)}
                          className="btn btn-ghost"
                          style={{ padding: '4px', borderRadius: 'var(--radius-sm)', height: '28px', width: '28px' }}
                        >
                          <MoreVertical size={14} />
                        </button>

                        {/* Custom Context Menu Dropdown */}
                        {isKebabOpen && (
                          <>
                            {/* Overlay click-catcher to dismiss kebab menu */}
                            <div 
                              onClick={() => setActiveKebabDocId(null)}
                              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                            />
                            
                            <div style={{
                              position: 'absolute',
                              right: '16px',
                              top: '32px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-md)',
                              boxShadow: 'var(--shadow-popover)',
                              zIndex: 11,
                              width: '130px',
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '4px',
                              animation: 'modal-enter 100ms ease-out'
                            }}>
                              <button
                                onClick={() => {
                                  setActiveKebabDocId(null);
                                  showToast(`Viewing vector chunks for ${doc.filename}...`);
                                }}
                                className="btn btn-ghost"
                                style={{ 
                                  height: '28px', 
                                  justifyContent: 'flex-start', 
                                  fontSize: '12px', 
                                  padding: '4px 8px',
                                  color: 'var(--text-primary)',
                                  border: 'none'
                                }}
                              >
                                <ExternalLink size={12} />
                                View chunks
                              </button>
                              
                              <button
                                onClick={() => {
                                  setActiveKebabDocId(null);
                                  showToast(`Re-indexing trigger queued...`);
                                }}
                                className="btn btn-ghost"
                                style={{ 
                                  height: '28px', 
                                  justifyContent: 'flex-start', 
                                  fontSize: '12px', 
                                  padding: '4px 8px',
                                  color: 'var(--text-primary)',
                                  border: 'none'
                                }}
                              >
                                <RotateCcw size={12} />
                                Re-index
                              </button>
                              
                              <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />
                              
                              <button
                                onClick={() => {
                                  setActiveKebabDocId(null);
                                  handleSingleDelete(doc.id);
                                }}
                                className="btn btn-ghost"
                                style={{ 
                                  height: '28px', 
                                  justifyContent: 'flex-start', 
                                  fontSize: '12px', 
                                  padding: '4px 8px',
                                  color: 'var(--danger)',
                                  border: 'none'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger-bg)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Trash2 size={12} />
                                Delete file
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5.3 Pagination footer */}
        {filteredAndSortedDocs.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)'
          }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Showing {Math.min(filteredAndSortedDocs.length, (currentPage - 1) * itemsPerPage + 1)}–
              {Math.min(filteredAndSortedDocs.length, currentPage * itemsPerPage)} of {filteredAndSortedDocs.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '0 8px' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ padding: '0 8px' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 5.2 Upload Modal Dropzone */}
      {isUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', padding: '24px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Upload documentation</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Index documents into your vector workspace
                </p>
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(false)} 
                className="btn btn-ghost" 
                style={{ padding: '4px', height: '28px', width: '28px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Dropzone Container */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragOver ? '1.5px dashed var(--accent)' : '1.5px dashed var(--border-strong)',
                background: isDragOver ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                marginBottom: '16px'
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                style={{ display: 'none' }} 
                accept=".pdf,.md,.zip"
                multiple
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <UploadCloud size={28} style={{ color: 'var(--text-tertiary)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Drag files here or click to browse
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    PDF, Markdown, or ZIP — up to 25MB
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Queue Rows */}
            {uploadQueue.length > 0 && (
              <div style={{ 
                maxHeight: '160px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                marginBottom: '20px'
              }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)', paddingBottom: '4px', borderBottom: '1px solid var(--border-default)' }}>
                  Files ready to upload ({uploadQueue.length})
                </div>
                {uploadQueue.map((item) => (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span 
                        className="text-xs font-medium" 
                        style={{ color: 'var(--text-primary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>

                        {item.status === 'queued' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeQueueFile(item.id); }}
                            className="btn btn-ghost"
                            style={{ padding: '2px', height: '18px', width: '18px' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                        {item.status === 'success' && (
                          <span className="badge badge-active"><Check size={10} /></span>
                        )}
                        {item.status === 'failed' && (
                          <span className="badge badge-failed" title={item.error}><AlertTriangle size={10} /></span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {item.status === 'uploading' && (
                      <div style={{ width: '100%', height: '3px', background: 'var(--border-default)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 100ms ease' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
              <button 
                onClick={executeUploadQueue}
                className="btn btn-primary"
                disabled={uploadQueue.filter(f => f.status === 'queued' || f.status === 'failed').length === 0}
              >
                Upload {uploadQueue.filter(f => f.status === 'queued' || f.status === 'failed').length} files
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
