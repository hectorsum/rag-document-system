'use client';

import { useState } from 'react';
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDocuments } from '@/hooks/useDocuments';
import type { Document, DocumentStatus } from '@/types';

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  pulse?: boolean;
}

const STATUS: Record<DocumentStatus, StatusConfig> = {
  uploading: { label: 'Uploading', icon: Loader2, color: 'text-yellow-500', pulse: true },
  processing: { label: 'Processing', icon: Loader2, color: 'text-blue-500', pulse: true },
  ready: { label: 'Ready', icon: CheckCircle, color: 'text-green-500' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-500' },
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = STATUS[status] ?? STATUS.error;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`}>
      <Icon size={12} className={cfg.pulse ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

type SortKey = 'createdAt' | 'fileName';
type FilterKey = 'all' | DocumentStatus;

export function DocumentList() {
  const { documents, isLoading, deleteDoc, isDeleting } = useDocuments();
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    await toast.promise(deleteDoc(doc.id), {
      loading: 'Deleting…',
      success: 'Document deleted',
      error: 'Delete failed',
    });
  };

  const handleRetry = async (doc: Document) => {
    setRetrying(doc.id);
    try {
      // Re-trigger upload by fetching the file from supabase isn't possible from client,
      // so we just notify the user to re-upload
      toast.error('Please re-upload the file to retry processing.');
    } finally {
      setRetrying(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const filtered = documents
    .filter(d => filter === 'all' || d.status === filter)
    .sort((a, b) =>
      sort === 'fileName'
        ? a.fileName.localeCompare(b.fileName)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <div>
      {/* Controls */}
      {documents.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FilterKey)}
            className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="uploading">Uploading</option>
            <option value="error">Error</option>
          </select>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="createdAt">Most recent</option>
            <option value="fileName">Name</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {documents.length === 0
            ? 'No documents yet — upload a PDF above to get started.'
            : 'No documents match the selected filter.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((doc: Document) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:shadow-sm transition-shadow"
            >
              <FileText size={18} className="text-blue-500 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">{doc.fileName}</p>
                <p className="text-xs text-gray-400">
                  {formatBytes(doc.fileSize)}
                  {doc.totalChunks != null && ` · ${doc.totalChunks} chunks`}
                </p>
                {doc.errorMessage && (
                  <p className="text-xs text-red-500 mt-0.5 truncate">{doc.errorMessage}</p>
                )}
              </div>

              <StatusBadge status={doc.status} />

              {doc.status === 'error' && (
                <button
                  onClick={() => handleRetry(doc)}
                  disabled={retrying === doc.id}
                  title="Retry"
                  className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                >
                  <RotateCcw size={14} />
                </button>
              )}

              <button
                onClick={() => handleDelete(doc)}
                disabled={isDeleting}
                title="Delete document"
                className="text-gray-400 hover:text-red-500 transition-colors ml-1 disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
