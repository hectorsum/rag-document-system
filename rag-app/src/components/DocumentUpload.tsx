'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { getDocumentStatus } from '@/lib/api';

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

interface Props {
  onSuccess?: () => void;
}

export function DocumentUpload({ onSuccess }: Props) {
  const { upload } = useDocuments();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const pollStatus = useCallback((documentId: string) => {
    const check = async () => {
      try {
        const res = await getDocumentStatus(documentId);
        const { status, errorMessage } = res.data;

        if (status === 'ready') {
          setState('ready');
          onSuccess?.();
          setTimeout(() => setState('idle'), 2500);
        } else if (status === 'error') {
          setState('error');
          setError(errorMessage ?? 'Processing failed');
        } else {
          setState(status as UploadState);
          pollRef.current = setTimeout(check, 3000);
        }
      } catch {
        pollRef.current = setTimeout(check, 3000);
      }
    };
    check();
  }, [onSuccess]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported');
        return;
      }
      setError('');
      setProgress(0);
      setState('uploading');

      try {
        const res = await upload(file, pct => setProgress(pct));
        // mutateAsync resolves to the axios AxiosResponse; data is nested under .data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = res as any;
        const documentId: string | undefined =
          raw?.data?.documentId ?? raw?.documentId;
        if (!documentId) throw new Error('Server did not return a documentId');
        pollStatus(documentId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
        setState('error');
      }
    },
    [upload, pollStatus],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const busy = state === 'uploading' || state === 'processing';

  const borderClass =
    isDragging ? 'border-blue-500 bg-blue-50'
    : busy ? 'border-blue-300 bg-blue-50 cursor-default'
    : state === 'ready' ? 'border-green-400 bg-green-50'
    : state === 'error' ? 'border-red-300'
    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50';

  return (
    <div className="mb-6">
      <label
        className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${borderClass}`}
        onDragOver={e => { e.preventDefault(); if (!busy) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onInputChange}
          disabled={busy}
        />

        {state === 'uploading' && (
          <div className="text-center w-full px-8">
            <FileText size={28} className="mx-auto mb-2 text-blue-500 animate-pulse" />
            <p className="text-sm text-blue-600 font-medium mb-1">Uploading… {progress}%</p>
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="text-center">
            <Loader2 size={28} className="mx-auto mb-2 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-600 font-medium">Processing PDF…</p>
            <p className="text-xs text-gray-400 mt-1">Extracting text and building index</p>
          </div>
        )}

        {state === 'ready' && (
          <div className="text-center">
            <CheckCircle size={28} className="mx-auto mb-2 text-green-500" />
            <p className="text-sm text-green-600 font-medium">Ready!</p>
          </div>
        )}

        {(state === 'idle' || state === 'error') && (
          <div className="text-center">
            <Upload size={28} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Click to upload</span>{' '}
              or drag and drop
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF files up to 50 MB</p>
          </div>
        )}
      </label>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-600 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
