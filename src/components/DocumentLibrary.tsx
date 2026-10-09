'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
  Lock,
  Layers
} from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { DocumentRecord, IngestionJob } from '@/lib/types';

interface DocumentLibraryProps {
  session: ActiveSession | null;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({ session }) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploadScope, setUploadScope] = useState<'organization' | 'restricted' | 'confidential'>('organization');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Permissions modal state
  const [selectedDocForRules, setSelectedDocForRules] = useState<DocumentRecord | null>(null);
  const [newScope, setNewScope] = useState<'organization' | 'restricted' | 'confidential'>('organization');

  const isAdmin = session?.role === 'admin' || session?.role === 'owner';

  useEffect(() => {
    loadDocuments();
  }, [session?.user.id]);

  const loadDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setJobs(data.jobs || []);
        setCanUpload(data.canUpload || false);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle || uploadFile.name);
    formData.append('category', uploadCategory);
    formData.append('accessScope', uploadScope);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadMessage(`Document indexed successfully into ${data.chunkCount} vector chunks.`);
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadTitle('');
        loadDocuments();
      } else {
        const err = await res.json();
        setUploadMessage(`Upload failed: ${err.error}`);
      }
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleRetire = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/retire`, {
        method: 'POST',
      });
      if (res.ok) {
        loadDocuments();
      }
    } catch (err) {
      console.error('Failed to toggle retire:', err);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedDocForRules) return;
    try {
      const res = await fetch(`/api/documents/${selectedDocForRules.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessScope: newScope,
          accessRules: newScope === 'restricted' ? [
            { targetType: 'role', targetValue: 'admin', canView: true, canEdit: true }
          ] : [],
        }),
      });
      if (res.ok) {
        setSelectedDocForRules(null);
        loadDocuments();
      }
    } catch (err) {
      console.error('Failed to update rules:', err);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(documents.map(d => d.category)));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span>Document Library & Ingestion Lifecycle</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage enterprise documentation, indexing jobs, versioning, and access scope rules.
          </p>
        </div>

        {canUpload && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title or category..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="ready">Ready (Indexed)</option>
          <option value="processing">Processing</option>
          <option value="retired">Retired (Unsearchable)</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Documents Table */}
      <div className="mt-6 flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0">
            <tr>
              <th className="px-4 py-3">Document Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Access Scope</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No documents found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{doc.category}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      v{doc.currentVersionNumber || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 w-fit ${
                        doc.accessScope === 'organization'
                          ? 'bg-blue-950 text-blue-400 border-blue-800'
                          : 'bg-amber-950 text-amber-400 border-amber-800'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      <span className="capitalize">{doc.accessScope}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase flex items-center gap-1 w-fit ${
                        doc.status === 'ready'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : doc.status === 'retired'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {doc.status === 'ready' && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status === 'retired' && <Clock className="w-3 h-3" />}
                      {doc.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                      <span>{doc.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedDocForRules(doc);
                            setNewScope(doc.accessScope);
                          }}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          Permissions
                        </button>
                        <button
                          onClick={() => handleToggleRetire(doc.id)}
                          className={`px-2.5 py-1 text-[11px] rounded font-medium transition-colors ${
                            doc.status === 'retired'
                              ? 'bg-emerald-800/80 hover:bg-emerald-700 text-white'
                              : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {doc.status === 'retired' ? 'Reactivate' : 'Retire'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-500" />
              <span>Upload & Index Document</span>
            </h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Document File (.pdf, .docx, .txt, .md)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. SOC2 Incident Response Policy"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Access Scope</label>
                  <select
                    value={uploadScope}
                    onChange={(e) => setUploadScope(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                  >
                    <option value="organization">Organization (All Staff)</option>
                    <option value="restricted">Restricted (Admins Only)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {isUploading ? 'Extracting & Indexing...' : 'Start Ingestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Rules Modal */}
      {selectedDocForRules && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <span>Document Permissions</span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure access boundary for: <strong className="text-slate-200">{selectedDocForRules.title}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <label className="block font-medium text-slate-300">Access Scope</label>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
              >
                <option value="organization">Organization-wide (All Members)</option>
                <option value="restricted">Restricted (Admins & Owners)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Restricted documents will be strictly excluded from vector retrieval for regular members.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800 text-xs">
              <button
                onClick={() => setSelectedDocForRules(null)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
