'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  Bookmark,
  Share2,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
} from 'lucide-react';
import { formatDate, getBillTypeLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AddToTeamDialog } from '@/components/teams/add-to-team-dialog';
import { BillProgress } from '@/components/bills/bill-progress';
import { BillWorkspaceLayout } from '@/components/bills/bill-workspace-layout';
import { ChatPanel } from '@/components/chat/chat-panel';
import { PersonalNotesPanel } from '@/components/bills/personal-notes-panel';

interface BillDetailWorkspaceProps {
  bill: {
    id: string;
    billId: string;
    billType: string;
    billNumber: number;
    description: string;
    content?: string | null;
    status?: string | null;
    authors: string[];
    subjects: string[];
    lastAction?: string | null;
    lastActionDate?: Date | null;
    session: {
      code: string;
      name: string;
    };
  };
}

export function BillDetailWorkspace({ bill }: BillDetailWorkspaceProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [showFullContent, setShowFullContent] = useState(false);
  const [showBillInfo, setShowBillInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!session) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save bills',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: bill.billId }),
      });

      if (response.ok) {
        toast({
          title: 'Bill saved',
          description: `${bill.billId} has been added to your saved bills`,
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save bill. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied',
        description: 'Bill link has been copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  // Header section - back link, title, badges, and action buttons
  const billHeader = (
    <div className="space-y-4">
      {/* Back navigation */}
      <Link
        href="/bills"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Bills
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Badge
              variant={bill.billType === 'HB' ? 'hb' : 'sb'}
              className="text-sm"
            >
              {bill.billType}
            </Badge>
            <h1 className="text-3xl font-bold">{bill.billId}</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            {getBillTypeLabel(bill.billType)} | {bill.session.name}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            <Bookmark className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {session && (
            <AddToTeamDialog
              billId={bill.billId}
              billDescription={bill.description}
              trigger={
                <Button variant="outline" size="sm">
                  <Users className="mr-2 h-4 w-4" />
                  Add to Team
                </Button>
              }
            />
          )}
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://capitol.texas.gov/BillLookup/History.aspx?LegSess=${bill.session.code}&Bill=${bill.billId.replace(' ', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Capitol.gov
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://capitol.texas.gov/BillLookup/Companions.aspx?LegSess=${bill.session.code}&Bill=${bill.billId.replace(' ', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Companions
            </a>
          </Button>
        </div>
      </div>
    </div>
  );

  // Content section - bill info, subjects, and full text
  const billContent = (
    <div className="space-y-6">
      {/* Bill Info - Collapsible panel combining Status, Authors, Description */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowBillInfo(!showBillInfo)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex flex-1 flex-col gap-1 text-sm font-normal">
              <div className="flex items-center gap-4">
                <span>
                  <span className="font-medium">Status:</span>{' '}
                  <span className="text-muted-foreground">{bill.status || 'Unknown'}</span>
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span>
                  <span className="font-medium">Authors:</span>{' '}
                  <span className="text-muted-foreground">
                    {bill.authors.length > 0 ? bill.authors.join(', ') : 'Not listed'}
                  </span>
                </span>
              </div>
              {!showBillInfo && (
                <p className="line-clamp-1 text-muted-foreground">
                  {bill.description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="ml-2 shrink-0">
              {showBillInfo ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Expand
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        {showBillInfo && (
          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {bill.description}
              </p>
            </div>

            <Separator />

            {/* Progress indicator */}
            <BillProgress status={bill.status} billType={bill.billType} />

            <Separator />

            {/* Bill details grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Authors</p>
                <p className="mt-1 font-semibold">
                  {bill.authors.length > 0 ? bill.authors.join(', ') : 'Not listed'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Session</p>
                <p className="mt-1 font-semibold">{bill.session.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Action</p>
                <p className="mt-1 font-semibold">
                  {bill.lastAction || 'No action recorded'}
                </p>
                {bill.lastActionDate && (
                  <p className="text-sm text-muted-foreground">
                    {formatDate(bill.lastActionDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Subjects */}
      {bill.subjects.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {bill.subjects.map((subject, i) => (
                <Badge key={i} variant="secondary">
                  {subject}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full content */}
      {bill.content && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowFullContent(!showFullContent)}
          >
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Full Bill Text
              </span>
              <Button variant="ghost" size="sm" className="ml-2 shrink-0">
                {showFullContent ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Expand
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showFullContent ? (
              <div className="max-h-[600px] overflow-y-auto rounded-md bg-muted p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {bill.content}
                </pre>
              </div>
            ) : (
              <div className="relative">
                <div className="max-h-32 overflow-hidden rounded-md bg-muted p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {bill.content}
                  </pre>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <BillWorkspaceLayout
      billHeader={billHeader}
      billContent={billContent}
      chatPanel={<ChatPanel billId={bill.billId} embedded />}
      notesPanel={<PersonalNotesPanel billId={bill.billId} />}
    />
  );
}
