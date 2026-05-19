'use client';

import { use } from 'react';
import { ChatInterface } from '@/components/ChatInterface';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ChatSessionPage({ params }: Props) {
  const { id } = use(params);
  return <ChatInterface sessionId={id} />;
}
