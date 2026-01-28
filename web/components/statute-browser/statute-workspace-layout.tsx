'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Flag,
  StickyNote,
  FileText,
  Search,
  Scale,
  ExternalLink,
  History,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Calendar,
  FilePenLine,
} from 'lucide-react';
import Link from 'next/link';

import { StatuteTree } from './statute-tree';
import { StatuteMarkersPanel } from './statute-markers-panel';
import { StatuteNotesPanel } from './statute-notes-panel';
import { StatuteSearchBar } from './statute-search-bar';
import { StatuteSearchResults, SearchResult } from './statute-search-results';
import { AffectingBillPane } from './affecting-bill-pane';
import { AnnotatableStatuteText, StatuteAnnotation, SearchMatch } from './annotatable-statute-text';
import { ViewPreferencesToggle } from './view-preferences-toggle';
import { ChapterFullView } from './chapter-full-view';
import { SubchapterFullView } from './subchapter-full-view';
import { StatuteChatPanel } from './statute-chat-panel';
import {
  StatuteScrollbarMarkers,
  ScrollbarMarker,
  calculateMarkerPositions,
  calculateAnnotationMarkerPositions,
} from './statute-scrollbar-markers';
import { cn } from '@/lib/utils';

interface StatuteData {
  id: string;
  sectionNum: string;
  heading: string | null;
  text: string;
  textHtml: string | null;
  chapterNum: string;
  chapterTitle: string | null;
  subchapter: string | null;
  subchapterTitle: string | null;
  version: number;
  effectiveDate: string | null;
  sourceUrl: string | null;
  changeType: string | null;
  changedByBill: {
    id: string;
    billId: string;
    description: string | null;
    status: string | null;
    lastActionDate: string | null;
  } | null;
}

interface CodeData {
  abbreviation: string;
  name: string;
}

type ViewMode = 'section' | 'chapter' | 'subchapter';

interface StatuteWorkspaceLayoutProps {
  className?: string;
}

export function StatuteWorkspaceLayout({ className }: StatuteWorkspaceLayoutProps) {
  const { data: session } = useSession();

  // Selection state
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedSubchapter, setSelectedSubchapter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('section');

  // Data state
  const [code, setCode] = useState<CodeData | null>(null);
  const [statute, setStatute] = useState<StatuteData | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Annotations state
  const [annotations, setAnnotations] = useState<StatuteAnnotation[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // UI state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'search' | 'markers' | 'notes' | 'bills' | 'chat'>('search');
  const [hideRevisionHistory, setHideRevisionHistory] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false); // Hidden by default

  // Scroll state for scrollbar markers
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: 0, height: 0, viewportHeight: 0 });

  // Tab badge counts
  const [tabCounts, setTabCounts] = useState({ bills: 0, notes: 0, chats: 0 });

  // Combined key for selection
  const selectionKey = selectedCode && selectedSection ? `${selectedCode}-${selectedSection}` : null;

  // Fetch statute when selection changes
  useEffect(() => {
    if (!selectedCode || !selectedSection || viewMode !== 'section') {
      return;
    }

    async function fetchStatute() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/statutes/${encodeURIComponent(selectedCode!)}/sections/${encodeURIComponent(selectedSection!)}`
        );

        if (!response.ok) {
          setError(response.status === 404 ? 'Section not found' : 'Failed to load statute');
          return;
        }

        const data = await response.json();
        setCode(data.code);
        setStatute(data.statute);
        setVersionCount(data.versionCount || 1);
      } catch (err) {
        console.error('Error fetching statute:', err);
        setError('Failed to load statute');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatute();
  }, [selectedCode, selectedSection, viewMode]);

  // Fetch tab counts when selection changes
  useEffect(() => {
    if (!selectedCode) {
      setTabCounts({ bills: 0, notes: 0, chats: 0 });
      return;
    }

    const fetchCounts = async () => {
      const params = new URLSearchParams({ code: selectedCode });
      if (viewMode === 'chapter' || viewMode === 'subchapter') {
        if (selectedChapter) params.set('chapter', selectedChapter);
      }
      if (viewMode === 'subchapter' && selectedSubchapter) {
        params.set('subchapter', selectedSubchapter);
      }
      if (viewMode === 'section' && selectedSection) {
        params.set('section', selectedSection);
        // Also get chapter from statute
        if (statute?.chapterNum) params.set('chapter', statute.chapterNum);
      }

      try {
        const response = await fetch(`/api/statutes/counts?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setTabCounts(data);
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();
  }, [selectedCode, selectedChapter, selectedSubchapter, selectedSection, viewMode, statute?.chapterNum]);

  // Fetch annotations when statute changes
  useEffect(() => {
    if (!session?.user || !selectedCode || !selectedSection || viewMode !== 'section') {
      setAnnotations([]);
      return;
    }

    async function fetchAnnotations() {
      try {
        const response = await fetch(
          `/api/statutes/${encodeURIComponent(selectedCode!)}/sections/${encodeURIComponent(selectedSection!)}/annotations`
        );
        if (response.ok) {
          const data = await response.json();
          setAnnotations(data.annotations || []);
        }
      } catch (error) {
        console.error('Error fetching annotations:', error);
      }
    }

    fetchAnnotations();
  }, [session?.user, selectedCode, selectedSection, viewMode]);

  // Handle section selection
  const handleSelectSection = useCallback((codeAbbr: string, sectionNum: string) => {
    setSelectedCode(codeAbbr);
    setSelectedSection(sectionNum);
    setSelectedChapter(null);
    setSelectedSubchapter(null);
    setViewMode('section');
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  // Handle chapter selection
  const handleSelectChapter = useCallback((codeAbbr: string, chapterNum: string) => {
    setSelectedCode(codeAbbr);
    setSelectedChapter(chapterNum);
    setSelectedSubchapter(null);
    setSelectedSection(null);
    setViewMode('chapter');
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  // Handle subchapter selection
  const handleSelectSubchapter = useCallback((codeAbbr: string, chapterNum: string, subchapter: string) => {
    setSelectedCode(codeAbbr);
    setSelectedChapter(chapterNum);
    setSelectedSubchapter(subchapter);
    setSelectedSection(null);
    setViewMode('subchapter');
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  // Handle search
  const handleSearch = useCallback(async (query: string, isSemantic: boolean) => {
    setSearchQuery(query);
    setIsSemanticSearch(isSemantic);
    setIsSearching(true);
    setSearchResults([]);

    try {
      if (isSemantic) {
        const response = await fetch('/api/statutes/semantic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            code: selectedCode,
            chapter: selectedChapter,
            limit: 10,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        }
      } else {
        const params = new URLSearchParams({ q: query });
        if (selectedCode) params.set('code', selectedCode);
        if (selectedChapter) params.set('chapter', selectedChapter);

        const response = await fetch(`/api/statutes/search?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);

          // If viewing a statute, calculate inline matches
          if (statute) {
            const currentResult = data.results?.find(
              (r: SearchResult) => r.id === statute.id
            );
            if (currentResult?.matches) {
              setSearchMatches(currentResult.matches);
              setCurrentMatchIndex(0);
            } else {
              setSearchMatches([]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  }, [selectedCode, selectedChapter, statute]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchMatches([]);
    setCurrentMatchIndex(0);
    setIsSemanticSearch(false);
  }, []);

  // Navigate between matches
  const handleNavigateMatch = useCallback((direction: 'prev' | 'next') => {
    if (searchMatches.length === 0) return;

    setCurrentMatchIndex(prev => {
      if (direction === 'next') {
        return prev < searchMatches.length - 1 ? prev + 1 : prev;
      } else {
        return prev > 0 ? prev - 1 : prev;
      }
    });
  }, [searchMatches.length]);

  // Handle search result click
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    handleSelectSection(result.codeAbbr, result.sectionNum);
  }, [handleSelectSection]);

  // Handle annotation create
  const handleAnnotationCreate = useCallback(async (annotation: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  }) => {
    if (!session?.user || !selectedCode || !selectedSection) return;

    // Show dialog to get annotation content and type
    const content = window.prompt('Enter your annotation:');
    if (!content) return;

    try {
      const response = await fetch(
        `/api/statutes/${encodeURIComponent(selectedCode)}/sections/${encodeURIComponent(selectedSection)}/annotations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...annotation,
            content,
            type: 'NOTE',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnnotations(prev => [...prev, data.annotation]);
      }
    } catch (error) {
      console.error('Error creating annotation:', error);
    }
  }, [session?.user, selectedCode, selectedSection]);

  // Handle annotation delete
  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    if (!session?.user) return;

    try {
      const response = await fetch(`/api/statutes/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  }, [session?.user]);

  // Calculate scrollbar markers
  const scrollbarMarkers: ScrollbarMarker[] = statute ? [
    ...calculateMarkerPositions(
      searchMatches.map(m => ({ ...m, isSemanticMatch: isSemanticSearch })),
      statute.text.length
    ),
    ...calculateAnnotationMarkerPositions(annotations, statute.text.length),
  ] : [];

  // Track panel sizes to detect collapse
  const handleLeftPanelResize = useCallback((size: { asPercentage: number }) => {
    setIsLeftPanelOpen(size.asPercentage > 5);
  }, []);

  const handleRightPanelResize = useCallback((size: { asPercentage: number }) => {
    setIsRightPanelOpen(size.asPercentage > 5);
  }, []);

  return (
    <div className={cn('h-full w-full overflow-hidden', className)}>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* Left panel - Tree */}
        <ResizablePanel
          id="left-panel"
          defaultSize={20}
          minSize={3}
          collapsible
          collapsedSize={3}
          onResize={handleLeftPanelResize}
          className="bg-muted/30"
        >
          <div className="h-full flex flex-col">
            {isLeftPanelOpen ? (
              <>
                <div className="flex items-center justify-between p-2 border-b">
                  <span className="text-sm font-medium">Statutes</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsLeftPanelOpen(false)}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <StatuteTree
                    onSelectSection={handleSelectSection}
                    onSelectChapter={handleSelectChapter}
                    onSelectSubchapter={handleSelectSubchapter}
                    selectedSection={selectionKey}
                  />
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setIsLeftPanelOpen(true)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main panel - Content */}
        <ResizablePanel id="main-panel" defaultSize={55} minSize={30} className="min-w-0">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Empty state */}
            {!selectedCode && !selectedSection && !selectedChapter && !selectedSubchapter && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Scale className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a statute section</p>
                <p className="text-sm">Click on a section in the tree to view its content</p>
              </div>
            )}

            {/* Loading state */}
            {isLoading && viewMode === 'section' && (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-64 w-full" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">{error}</p>
                <p className="text-sm">Try selecting a different section</p>
              </div>
            )}

            {/* Chapter view */}
            {viewMode === 'chapter' && selectedCode && selectedChapter && (
              <ChapterFullView
                codeAbbr={selectedCode}
                chapterNum={selectedChapter}
                hideRevisionHistory={hideRevisionHistory}
                onSectionClick={(sectionNum) => handleSelectSection(selectedCode, sectionNum)}
              />
            )}

            {/* Subchapter view */}
            {viewMode === 'subchapter' && selectedCode && selectedChapter && selectedSubchapter && (
              <SubchapterFullView
                codeAbbr={selectedCode}
                chapterNum={selectedChapter}
                subchapter={selectedSubchapter}
                hideRevisionHistory={hideRevisionHistory}
                onSectionClick={(sectionNum) => handleSelectSection(selectedCode, sectionNum)}
              />
            )}

            {/* Section view */}
            {viewMode === 'section' && statute && code && !isLoading && !error && (
              <>
                {/* Header */}
                <div className="flex-shrink-0 p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {code.abbreviation}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Ch. {statute.chapterNum}
                          {statute.subchapter && `, Subch. ${statute.subchapter}`}
                        </span>
                      </div>
                      <h1 className="text-xl font-bold">§ {statute.sectionNum}</h1>
                      {statute.heading && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {statute.heading}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ViewPreferencesToggle
                        hideRevisionHistory={hideRevisionHistory}
                        onHideRevisionHistoryChange={setHideRevisionHistory}
                      />
                      {versionCount > 1 && (
                        <Link
                          href={`/statutes/${code.abbreviation}/${statute.sectionNum}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <History className="h-3 w-3" />
                          {versionCount} versions
                        </Link>
                      )}
                      {statute.sourceUrl && (
                        <a
                          href={statute.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Source
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Metadata section - collapsible */}
                  {(statute.effectiveDate || statute.changeType || statute.changedByBill) && (
                    <div className="mt-3 pt-3 border-t">
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowMetadata(!showMetadata)}
                      >
                        {showMetadata ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Metadata
                      </button>
                      {showMetadata && (
                        <div className="mt-2 space-y-2 text-sm">
                          {statute.effectiveDate && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                Effective: {new Date(statute.effectiveDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {statute.changeType && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <FilePenLine className="h-3.5 w-3.5" />
                              <span>
                                Change type: {statute.changeType.charAt(0) + statute.changeType.slice(1).toLowerCase()}
                              </span>
                            </div>
                          )}
                          {statute.changedByBill && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                              <Link
                                href={`/bills/${statute.changedByBill.billId}`}
                                className="hover:text-foreground hover:underline"
                              >
                                Changed by: {statute.changedByBill.billId}
                                {statute.changedByBill.description && (
                                  <span className="text-xs ml-1">
                                    - {statute.changedByBill.description.substring(0, 50)}
                                    {statute.changedByBill.description.length > 50 && '...'}
                                  </span>
                                )}
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Content with scrollbar markers */}
                <div className="flex-1 relative min-h-0 overflow-hidden">
                  <ScrollArea
                    ref={scrollAreaRef}
                    className="h-full"
                    onScrollCapture={(e) => {
                      const target = e.target as HTMLElement;
                      setScrollState({
                        top: target.scrollTop,
                        height: target.scrollHeight,
                        viewportHeight: target.clientHeight,
                      });
                    }}
                  >
                    <div className="p-4 pr-6">
                      <AnnotatableStatuteText
                        content={statute.text}
                        statuteId={statute.id}
                        annotations={annotations}
                        searchMatches={searchMatches}
                        hideRevisionHistory={hideRevisionHistory}
                        onAnnotationCreate={session?.user ? handleAnnotationCreate : undefined}
                        onAnnotationDelete={session?.user ? handleAnnotationDelete : undefined}
                        onMatchClick={(index) => setCurrentMatchIndex(index)}
                      />
                    </div>
                  </ScrollArea>

                  {/* Scrollbar markers overlay */}
                  {scrollbarMarkers.length > 0 && (
                    <StatuteScrollbarMarkers
                      markers={scrollbarMarkers}
                      contentHeight={scrollState.height}
                      viewportHeight={scrollState.viewportHeight}
                      scrollTop={scrollState.top}
                      onMarkerClick={(marker) => {
                        // Scroll to marker position
                        const position = marker.position * scrollState.height;
                        scrollAreaRef.current?.scrollTo({ top: position, behavior: 'smooth' });
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel - Sidebar */}
        <ResizablePanel
          id="right-panel"
          defaultSize={25}
          minSize={3}
          collapsible
          collapsedSize={3}
          onResize={handleRightPanelResize}
          className="bg-muted/30"
        >
          <div className="h-full flex flex-col">
            {isRightPanelOpen ? (
              <>
                {/* Sidebar header */}
                <div className="flex-shrink-0 p-2 border-b flex items-center justify-between">
                  <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as typeof sidebarTab)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="search" className="h-7 px-2">
                        <Search className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="markers" className="h-7 px-2">
                        <Flag className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="h-7 px-2 relative">
                        <StickyNote className="h-4 w-4" />
                        {tabCounts.notes > 0 && (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center">
                            {tabCounts.notes}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="bills" className="h-7 px-2 relative">
                        <FileText className="h-4 w-4" />
                        {tabCounts.bills > 0 && (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center">
                            {tabCounts.bills}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="h-7 px-2 relative">
                        <MessageSquare className="h-4 w-4" />
                        {tabCounts.chats > 0 && (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center">
                            {tabCounts.chats}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsRightPanelOpen(false)}
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </Button>
                </div>

                {/* Sidebar content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {sidebarTab === 'search' && (
                    <div className="flex flex-col h-full">
                      <div className="p-3 border-b">
                        <StatuteSearchBar
                          codeAbbr={selectedCode || undefined}
                          chapterNum={selectedChapter || undefined}
                          onSearch={handleSearch}
                          onClear={handleClearSearch}
                          isSearching={isSearching}
                          resultCount={searchMatches.length || searchResults.length}
                          currentMatchIndex={currentMatchIndex}
                          onNavigateMatch={handleNavigateMatch}
                        />
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        {searchResults.length > 0 && (
                          <StatuteSearchResults
                            results={searchResults}
                            query={searchQuery}
                            isSemanticSearch={isSemanticSearch}
                            onResultClick={handleSearchResultClick}
                            selectedResultId={statute?.id}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {sidebarTab === 'markers' && (
                    <StatuteMarkersPanel
                      onNavigateToMarker={(codeAbbr, chapterNum) => {
                        setSelectedCode(codeAbbr);
                        if (chapterNum) {
                          setSelectedChapter(chapterNum);
                          setViewMode('chapter');
                        }
                      }}
                    />
                  )}

                  {sidebarTab === 'notes' && (
                    <StatuteNotesPanel
                      codeAbbr={selectedCode || undefined}
                      chapterNum={
                        viewMode === 'chapter' || viewMode === 'subchapter'
                          ? selectedChapter
                          : statute?.chapterNum
                      }
                      subchapter={
                        viewMode === 'subchapter'
                          ? selectedSubchapter
                          : statute?.subchapter
                      }
                      viewMode={viewMode}
                      onNavigateToNote={(codeAbbr, chapterNum, subchapter) => {
                        setSelectedCode(codeAbbr);
                        if (subchapter && chapterNum) {
                          setSelectedChapter(chapterNum);
                          setSelectedSubchapter(subchapter);
                          setViewMode('subchapter');
                        } else if (chapterNum) {
                          setSelectedChapter(chapterNum);
                          setViewMode('chapter');
                        }
                      }}
                    />
                  )}

                  {sidebarTab === 'bills' && selectedCode && (
                    <div className="p-3">
                      <AffectingBillPane
                        codeAbbr={selectedCode}
                        sectionNum={viewMode === 'section' ? selectedSection || undefined : undefined}
                        chapterNum={
                          viewMode === 'chapter' || viewMode === 'subchapter'
                            ? selectedChapter || undefined
                            : statute?.chapterNum
                        }
                        subchapter={viewMode === 'subchapter' ? selectedSubchapter || undefined : undefined}
                      />
                    </div>
                  )}

                  {sidebarTab === 'chat' && selectedCode && (viewMode === 'chapter' || viewMode === 'subchapter') && (
                    <StatuteChatPanel
                      codeAbbr={selectedCode}
                      chapterNum={selectedChapter || ''}
                      subchapter={viewMode === 'subchapter' ? selectedSubchapter : null}
                      className="h-full"
                    />
                  )}

                  {sidebarTab === 'chat' && (!selectedCode || (viewMode !== 'chapter' && viewMode !== 'subchapter')) && (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-sm">Select a chapter or subchapter to chat</p>
                      <p className="text-xs mt-1">Click on a chapter name in the tree</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setIsRightPanelOpen(true)}
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
