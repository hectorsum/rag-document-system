'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, FileText, Loader2, Bot, User, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChatSession } from '@/hooks/useChat';
import type { ChatMessage, SourceDocument } from '@/types';

const SUGGESTIONS = [
  'What are the main topics in my documents?',
  'Summarize the key points from the uploaded files',
  'What specific information can I find in these documents?',
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 mb-5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-gray-600" />
        )}
      </div>

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>

        {!isUser && (
          <div className="flex items-center gap-2 mt-1">
            <CopyButton text={message.content} />
            {message.sourceDocuments && message.sourceDocuments.length > 0 && (
              <div className="flex items-center gap-2">
                {message.sourceDocuments.map((src: SourceDocument, i: number) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-gray-400">
                    <FileText size={9} />
                    {src.documentName}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  sessionId: string;
}

export function ChatInterface({ sessionId }: Props) {
  const { session, isLoading, streamingMessage, isStreaming, sendMessage } =
    useChatSession(sessionId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput('');
    try {
      await sendMessage(q);
    } catch {
      toast.error('Failed to send message');
    }
  }, [input, isStreaming, sendMessage]);

  const handleSuggestion = (s: string) => {
    setInput(s);
    textareaRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  const messages = session?.messages ?? [];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-400 mt-12">
            <Bot size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Ask about your documents</p>
            <p className="text-sm mt-1 mb-6">
              Upload PDFs first, then ask anything about their content.
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-left text-sm px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingMessage && (
          <div className="flex gap-3 mb-5">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-gray-600 dark:text-gray-400" />
            </div>
            <div className="max-w-[75%] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
              <span className="whitespace-pre-wrap">{streamingMessage}</span>
              <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        )}

        {isStreaming && !streamingMessage && (
          <div className="flex gap-3 mb-5">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-gray-600 dark:text-gray-400" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 size={14} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            disabled={isStreaming}
            rows={1}
            className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none overflow-hidden"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {isStreaming ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        {input.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            ~{Math.ceil(input.length / 4)} tokens
          </p>
        )}
      </div>
    </div>
  );
}
