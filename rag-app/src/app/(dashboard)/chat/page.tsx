'use client';

import { useRouter } from 'next/navigation';
import { MessageSquarePlus } from 'lucide-react';
import { useChatSessions } from '@/hooks/useChat';

export default function ChatPage() {
  const router = useRouter();
  const { createSession, isCreating } = useChatSessions();

  const handleNewChat = async () => {
    const res = await createSession();
    router.push(`/chat/${res.data.id}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <MessageSquarePlus size={48} className="text-blue-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Chat with your documents</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        Ask questions about any uploaded PDF. The AI will find relevant passages
        and answer using only your documents.
      </p>
      <button
        onClick={handleNewChat}
        disabled={isCreating}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isCreating ? 'Creating…' : 'Start new chat'}
      </button>
    </div>
  );
}
