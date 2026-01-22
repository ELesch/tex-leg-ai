'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useChat, Message } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { Send, Loader2, MessageSquare, X, LogIn, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ChatPanelProps {
  billId: string;
  billContent?: string;
  className?: string;
  /** When true, renders as embedded component without floating button behavior */
  embedded?: boolean;
}

export function ChatPanel({ billId, className, embedded = false }: ChatPanelProps) {
  const { data: session, status } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } =
    useChat({
      api: '/api/chat',
      body: { billId },
      id: billId,
    });

  // Fetch chat history on mount when user is authenticated
  useEffect(() => {
    async function fetchHistory() {
      if (!session || (!isExpanded && !embedded)) return;

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetch(`/api/chat/history?billId=${encodeURIComponent(billId)}`);

        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }

        const data = await response.json();

        if (data.messages && Array.isArray(data.messages)) {
          // Convert API format to useChat format
          const formattedMessages: Message[] = data.messages.map((msg: { id: string; role: string; content: string; createdAt?: string }) => ({
            id: msg.id,
            role: msg.role.toLowerCase() as 'user' | 'assistant',
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
          }));

          setMessages(formattedMessages);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setHistoryError(err instanceof Error ? err.message : 'Failed to load chat history');
      } finally {
        setIsLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [session, billId, isExpanded, embedded, setMessages]);

  // Clear conversation handler
  const handleClearConversation = useCallback(async () => {
    if (isClearing) return;

    setIsClearing(true);

    try {
      const response = await fetch(`/api/chat/session?billId=${encodeURIComponent(billId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear conversation');
      }

      // Reset messages locally
      setMessages([]);
    } catch (err) {
      console.error('Error clearing conversation:', err);
      // Optionally show error to user
    } finally {
      setIsClearing(false);
    }
  }, [billId, isClearing, setMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when expanded or embedded
  useEffect(() => {
    if ((isExpanded || embedded) && inputRef.current && session) {
      inputRef.current.focus();
    }
  }, [isExpanded, embedded, session]);

  // Collapsed button (only shown in non-embedded mode)
  if (!embedded && !isExpanded) {
    return (
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-6 right-6 h-14 gap-2 rounded-full px-6 shadow-lg"
        onClick={() => setIsExpanded(true)}
      >
        <MessageSquare className="h-5 w-5" />
        Ask AI about this bill
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-background',
        embedded
          ? 'h-full flex-1'
          : 'fixed bottom-6 right-6 h-[600px] w-96 shadow-xl',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h3 className="font-semibold">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask about {billId}</p>
        </div>
        <div className="flex items-center gap-1">
          {session && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearConversation}
              disabled={isClearing}
              title="Clear conversation"
            >
              {isClearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
          {!embedded && (
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Auth check */}
      {status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !session ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <LogIn className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Sign in to chat</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an account or sign in to ask questions about this bill
            </p>
          </div>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading conversation history...
                </p>
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {historyError}
                </div>
                <p className="text-sm text-muted-foreground">
                  You can still start a new conversation
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Ask questions about this bill
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Example: &quot;What are the main provisions?&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            )}
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Error: {error.message}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about this bill..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="h-[60px]"
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
