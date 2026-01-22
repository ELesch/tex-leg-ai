'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquare, StickyNote, Users, PanelRightOpen } from 'lucide-react';

interface BillWorkspaceLayoutProps {
  billHeader: React.ReactNode;
  billContent: React.ReactNode;
  chatPanel: React.ReactNode;
  notesPanel?: React.ReactNode;
  teamPanel?: React.ReactNode;
}

export function BillWorkspaceLayout({
  billHeader,
  billContent,
  chatPanel,
  notesPanel,
  teamPanel,
}: BillWorkspaceLayoutProps) {
  const [activeTab, setActiveTab] = useState('chat');
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Bill Header - always visible */}
      <div className="shrink-0 border-b bg-background px-4 py-4 lg:px-6">
        {billHeader}
      </div>

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Bill Content (~55% on desktop) */}
        <div className="flex-1 overflow-hidden lg:w-[55%] lg:flex-none">
          <ScrollArea className="h-full">
            <div className="p-4 lg:p-6">{billContent}</div>
          </ScrollArea>
        </div>

        {/* Right Panel - Tabbed Sidebar (~45% on desktop, hidden on mobile) */}
        <div className="hidden border-l bg-muted/30 lg:flex lg:w-[45%] lg:flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col"
          >
            <div className="shrink-0 border-b bg-background px-4 pt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden xl:inline">AI Chat</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2">
                  <StickyNote className="h-4 w-4" />
                  <span className="hidden xl:inline">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden xl:inline">Team</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="chat"
              className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex h-full flex-col">{chatPanel}</div>
            </TabsContent>

            <TabsContent
              value="notes"
              className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex h-full flex-col">
                {notesPanel || <NotesPlaceholder />}
              </div>
            </TabsContent>

            <TabsContent
              value="team"
              className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex h-full flex-col">
                {teamPanel || <TeamPlaceholder />}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Mobile Floating Button and Dialog */}
      <div className="lg:hidden">
        <Dialog open={mobileDialogOpen} onOpenChange={setMobileDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="default"
              size="lg"
              className="fixed bottom-6 right-6 z-50 h-14 gap-2 rounded-full px-6 shadow-lg"
            >
              <PanelRightOpen className="h-5 w-5" />
              Open Panel
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[85vh] max-h-[85vh] flex-col p-0 sm:max-w-[500px]">
            <DialogHeader className="sr-only">
              <DialogTitle>Workspace Panel</DialogTitle>
            </DialogHeader>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex h-full flex-col"
            >
              <div className="shrink-0 border-b px-4 pt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    AI Chat
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="team" className="gap-2">
                    <Users className="h-4 w-4" />
                    Team
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="chat"
                className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
              >
                <div className="flex h-full flex-col">{chatPanel}</div>
              </TabsContent>

              <TabsContent
                value="notes"
                className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
              >
                <div className="flex h-full flex-col">
                  {notesPanel || <NotesPlaceholder />}
                </div>
              </TabsContent>

              <TabsContent
                value="team"
                className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
              >
                <div className="flex h-full flex-col">
                  {teamPanel || <TeamPlaceholder />}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/**
 * Placeholder component for the Notes tab when no notesPanel is provided
 */
function NotesPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <StickyNote className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
      <p className="font-medium">Personal Notes</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your personal notes for this bill will appear here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
    </div>
  );
}

/**
 * Placeholder component for the Team tab when no teamPanel is provided
 */
function TeamPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Users className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
      <p className="font-medium">Team Discussion</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Collaborate with your team on this bill
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
    </div>
  );
}
