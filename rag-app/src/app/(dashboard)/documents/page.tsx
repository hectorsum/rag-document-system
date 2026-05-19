'use client';

import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentList } from '@/components/DocumentList';

export default function DocumentsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Document Library</h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload PDFs to make them searchable by the AI.
      </p>
      <DocumentUpload />
      <DocumentList />
    </div>
  );
}
