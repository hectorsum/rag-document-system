'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  sendMessage,
} from '@/lib/api';
import type { ChatSession, SourceDocument } from '@/types';

export function useChatSessions() {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery<ChatSession[]>({
    queryKey: ['chatSessions'],
    queryFn: async () => {
      const res = await getChatSessions();
      return res.data as ChatSession[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (title?: string) => createChatSession(title),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] }),
  });

  return {
    sessions,
    isLoading,
    createSession: (title?: string) => createMutation.mutateAsync(title),
    isCreating: createMutation.isPending,
  };
}

export function useChatSession(sessionId: string) {
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery<ChatSession>({
    queryKey: ['chatSession', sessionId],
    queryFn: async () => {
      const res = await getChatSession(sessionId);
      return res.data as ChatSession;
    },
    enabled: Boolean(sessionId),
  });

  const send = useCallback(
    async (question: string) => {
      setIsStreaming(true);
      setStreamingMessage('');
      try {
        await sendMessage(
          sessionId,
          question,
          chunk => setStreamingMessage(prev => prev + chunk),
          doneSources => {
            setSources(doneSources as SourceDocument[]);
            setIsStreaming(false);
            queryClient.invalidateQueries({
              queryKey: ['chatSession', sessionId],
            });
          },
        );
      } catch (err) {
        setIsStreaming(false);
        throw err;
      }
    },
    [sessionId, queryClient],
  );

  return {
    session,
    isLoading,
    streamingMessage,
    isStreaming,
    sources,
    sendMessage: send,
  };
}
