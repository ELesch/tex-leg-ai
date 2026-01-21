'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Loader2, Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  name: string | null;
  image: string | null;
}

interface ChatMessage {
  id: string;
  chatSessionId: string;
  userId: string | null;
  user: User | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

interface TeamChatPanelProps {
  teamId: string;
  billId: string;
  canChat: boolean;
  initialMessages?: ChatMessage[];
}

export function TeamChatPanel({
  teamId,
  billId,
  canChat,
  initialMessages = [],
}: TeamChatPanelProps) {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [historicalMessages, setHistoricalMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoadingHistory, setIsLoadingHistory] = useState(initialMessages.length === 0);

  // Fetch chat history
  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/workspaces/${billId}/chat`);
      if (!response.ok) throw new Error('Failed to fetch chat history');
      const data = await response.json();
      setHistoricalMessages(data.messages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (initialMessages.length === 0) {
      fetchHistory();
    }
  }, [teamId, billId]);

  // Convert historical messages to useChat format
  const convertedHistory = historicalMessages.map((msg) => ({
    id: msg.id,
    role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
  } = useChat({
    api: `/api/teams/${teamId}/workspaces/${billId}/chat`,
    initialMessages: convertedHistory,
    onError: (error) => {
      toast({
        title: 'Chat error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
    onFinish: () => {
      // Refresh history to get the saved messages with user info
      fetchHistory();
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Merge historical messages with new messages
  const displayMessages = messages.map((msg) => {
    const historical = historicalMessages.find((h) => h.id === msg.id);
    return {
      ...msg,
      user: historical?.user || null,
      createdAt: historical?.createdAt,
    };
  });

  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {displayMessages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">Team AI Chat</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ask questions about this bill. All team members can see this conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayMessages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className="flex gap-3">
                  {isUser ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.user?.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(message.user?.name || null)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {isUser ? message.user?.name || 'Team Member' : 'AI Assistant'}
                      </span>
                      {message.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-sm">AI Assistant</span>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Error state */}
      {error && (
        <div className="px-4 py-2 border-t bg-destructive/10 flex items-center justify-between">
          <span className="text-sm text-destructive">
            Failed to send message. Please try again.
          </span>
          <Button variant="ghost" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Input */}
      {canChat && (
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about this bill..."
              rows={2}
              className="resize-none"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      )}

      {!canChat && (
        <div className="border-t p-4 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to chat in this workspace.
        </div>
      )}
    </div>
  );
}
