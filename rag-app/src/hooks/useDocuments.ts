'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocuments, uploadDocument, deleteDocument } from '@/lib/api';
import type { Document } from '@/types';

export function useDocuments() {
  const queryClient = useQueryClient();

  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await getDocuments();
      return res.data as Document[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) =>
      uploadDocument(file, onProgress),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  return {
    documents,
    isLoading,
    error,
    upload: (file: File, onProgress?: (pct: number) => void) =>
      uploadMutation.mutateAsync({ file, onProgress }),
    isUploading: uploadMutation.isPending,
    deleteDoc: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
