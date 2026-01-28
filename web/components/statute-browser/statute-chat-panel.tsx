'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useChat, Message } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Send,
  Loader2,
  ChevronDown,
  MessageSquare,
  FileText,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatuteBillSelector } from './statute-bill-selector';
import { StatuteChatSessionList, ChatSessionSummary } from './statute-chat-session-list';

interface AffectingBill {
  id: string;
  billId: string;
  description: string;
  status: string | null;
  authors: string[];
  action: string;
}

interface StatuteChatPanelProps {
  codeAbbr: string;
  chapterNum: string;
  subchapter?: string | null;
  className?: string;
}

export function StatuteChatPanel({
  codeAbbr,
  chapterNum,
  subchapter,
  className,
}: StatuteChatPanelProps) {
  const { data: session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track previous context to detect changes
  const prevContextRef = useRef({ codeAbbr, chapterNum, subchapter });

  // Sessions state
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Bill selector state
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<AffectingBill | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // Chat state
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: submitChat,
    isLoading: isChatLoading,
    setMessages,
    error: chatError,
  } = useChat({
    api: '/api/statute-chat',
    body: {
      codeAbbr,
      chapterNum,
      subchapter,
      billId: selectedBillId,
      sessionId: currentSessionId,
    },
    onFinish: () => {
      // Refresh sessions to update message count
      fetchSessions();
    },
  });

  // Fetch sessions for this context
  const fetchSessions = useCallback(async () => {
    if (!session?.user) return;

    setIsLoadingSessions(true);
    try {
      const params = new URLSearchParams({
        codeAbbr,
        chapterNum,
        ...(subchapter ? { subchapter } : {}),
      });
      const response = await fetch(`/api/statute-chat/sessions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [session?.user, codeAbbr, chapterNum, subchapter]);

  // Handle context changes - reset state FIRST, then fetch
  useEffect(() => {
    const prevContext = prevContextRef.current;
    const contextChanged =
      prevContext.codeAbbr !== codeAbbr ||
      prevContext.chapterNum !== chapterNum ||
      prevContext.subchapter !== subchapter;

    if (contextChanged) {
      // Reset state immediately when context changes
      setCurrentSessionId(null);
      setMessages([]);
      setSelectedBillId(null);
      setSelectedBill(null);
      setSessions([]);
      prevContextRef.current = { codeAbbr, chapterNum, subchapter };
    }

    // Then fetch sessions for the new context
    fetchSessions();
  }, [fetchSessions, codeAbbr, chapterNum, subchapter, setMessages]);

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/statute-chat/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentSessionId(sessionId);
        // Convert messages to chat format
        const loadedMessages: Message[] = data.messages.map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(loadedMessages);

        // Set bill if session has one
        if (data.session.bill) {
          setSelectedBillId(data.session.bill.id);
          setSelectedBill({
            id: data.session.bill.id,
            billId: data.session.bill.billId,
            description: data.session.bill.description,
            status: data.session.bill.status,
            authors: data.session.bill.authors,
            action: 'AMEND',
          });
        } else {
          setSelectedBillId(null);
          setSelectedBill(null);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, [setMessages]);

  // Rename session
  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/statute-chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (response.ok) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title: newTitle } : s
        ));
      }
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/statute-chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [currentSessionId, setMessages]);

  // Start new chat
  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
  }, [setMessages]);

  // Handle bill selection
  const handleBillSelect = useCallback((billId: string | null, bill: AffectingBill | null) => {
    setSelectedBillId(billId);
    setSelectedBill(bill);
    // If changing bill during an existing session, start a new one
    if (currentSessionId && billId !== selectedBillId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId, selectedBillId, setMessages]);

  // Handle form submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    submitChat(e);
  }, [input, isChatLoading, submitChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Not logged in
  if (!session?.user) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-4 text-center', className)}>
        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Sign in to chat about statutes
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with new chat button */}
      <div className="flex-shrink-0 p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Statute Chat</h3>
          <Button size="sm" variant="outline" onClick={startNewChat} className="h-7 gap-1">
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>

        {/* Bill selector */}
        <StatuteBillSelector
          codeAbbr={codeAbbr}
          chapterNum={chapterNum}
          subchapter={subchapter}
          selectedBillId={selectedBillId}
          onBillSelect={handleBillSelect}
        />

        {/* Show selected bill info */}
        {selectedBill && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <div className="flex items-center gap-1 font-medium">
              <FileText className="h-3 w-3" />
              {selectedBill.billId}
            </div>
            <p className="line-clamp-2 mt-1">{selectedBill.description}</p>
          </div>
        )}
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {messages.length === 0 && !isChatLoading && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ask questions about this statute</p>
              {selectedBill && (
                <p className="text-xs mt-1">
                  Including context from {selectedBill.billId}
                </p>
              )}
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex flex-col gap-1',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <Badge variant={message.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                {message.role === 'user' ? 'You' : 'AI'}
              </Badge>
              <div
                className={cn(
                  'rounded-lg px-3 py-2 text-sm max-w-[90%]',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {isChatLoading && (
            <div className="flex flex-col gap-1 items-start">
              <Badge variant="secondary" className="text-xs">AI</Badge>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {chatError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              Error: {chatError.message}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about this statute..."
            className="min-h-[60px] max-h-[120px] resize-none text-sm"
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
            className="h-[60px] w-10"
            disabled={!input.trim() || isChatLoading}
          >
            {isChatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Chat history collapsible */}
      <Collapsible
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        className="flex-shrink-0 border-t"
      >
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors text-sm">
            <span className="font-medium">Chat History</span>
            <div className="flex items-center gap-2">
              {sessions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {sessions.length}
                </Badge>
              )}
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                isHistoryOpen && 'rotate-180'
              )} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-48 border-t">
            <StatuteChatSessionList
              sessions={sessions}
              isLoading={isLoadingSessions}
              selectedSessionId={currentSessionId}
              onSelectSession={loadSession}
              onRenameSession={renameSession}
              onDeleteSession={deleteSession}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
