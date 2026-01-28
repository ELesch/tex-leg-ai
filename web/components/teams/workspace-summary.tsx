'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Loader2,
  Check,
  X,
} from 'lucide-react';

interface WorkspaceSummaryProps {
  summary: string | null;
  canEdit: boolean;
  onSave: (summary: string) => Promise<void>;
  isLoading?: boolean;
}

export function WorkspaceSummary({
  summary,
  canEdit,
  onSave,
  isLoading = false,
}: WorkspaceSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(summary || '');
  const [isSaving, setIsSaving] = useState(false);

  const hasSummary = summary && summary.trim().length > 0;
  const displayText = hasSummary ? summary : 'No summary added yet';
  const isLong = hasSummary && summary.length > 150;
  const truncatedText = isLong ? summary.substring(0, 150) + '...' : displayText;

  const handleStartEdit = () => {
    setEditValue(summary || '');
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleCancel = () => {
    setEditValue(summary || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-2">
          <div className="h-12 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <Collapsible open={isExpanded || isEditing} onOpenChange={setIsExpanded}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleStartEdit}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {hasSummary ? 'Edit' : 'Add'}
                </Button>
              )}
              {isLong && !isEditing && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 mr-1" />
                        More
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-2 pt-0">
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Add a summary of this bill and your team's analysis..."
                rows={4}
                className="resize-none text-sm"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Collapsed view */}
              {!isExpanded && (
                <p
                  className={cn(
                    'text-sm leading-relaxed',
                    !hasSummary && 'text-muted-foreground italic'
                  )}
                >
                  {truncatedText}
                </p>
              )}
              {/* Expanded view */}
              <CollapsibleContent>
                <p
                  className={cn(
                    'text-sm leading-relaxed whitespace-pre-wrap',
                    !hasSummary && 'text-muted-foreground italic'
                  )}
                >
                  {displayText}
                </p>
              </CollapsibleContent>
            </>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}
