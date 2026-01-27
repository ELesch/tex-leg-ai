'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Scale,
  Search,
  ChevronRight,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface CodeStats {
  code: string;
  referenceCount: number;
  billCount: number;
}

interface ChapterStats {
  chapter: string;
  referenceCount: number;
  billCount: number;
  sectionCount: number;
}

interface SectionStats {
  section: string;
  chapter: string;
  referenceCount: number;
  billCount: number;
}

interface BillReference {
  id: string;
  code: string;
  section: string;
  action: 'ADD' | 'AMEND' | 'REPEAL';
  billSection: string;
  bill: {
    id: string;
    billId: string;
    billType: string;
    billNumber: number;
    description: string;
    status: string | null;
    authors: string[];
    lastAction: string | null;
    lastActionDate: string | null;
  };
}

function getActionVariant(action: string): 'add' | 'amend' | 'repeal' {
  switch (action) {
    case 'ADD':
      return 'add';
    case 'REPEAL':
      return 'repeal';
    default:
      return 'amend';
  }
}

function StatutesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get('code');
  const selectedChapter = searchParams.get('chapter');
  const selectedSection = searchParams.get('section');

  const [codeFilter, setCodeFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [codes, setCodes] = useState<CodeStats[]>([]);
  const [chapters, setChapters] = useState<ChapterStats[]>([]);
  const [sections, setSections] = useState<SectionStats[]>([]);
  const [bills, setBills] = useState<BillReference[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

  // Fetch codes on mount
  useEffect(() => {
    async function fetchCodes() {
      try {
        const response = await fetch('/api/codes');
        if (response.ok) {
          const data = await response.json();
          setCodes(data.codes);
        }
      } catch (error) {
        console.error('Error fetching codes:', error);
      } finally {
        setIsLoadingCodes(false);
      }
    }
    fetchCodes();
  }, []);

  // Fetch chapters when a code is selected
  useEffect(() => {
    if (!selectedCode) {
      setChapters([]);
      return;
    }

    async function fetchChapters() {
      setIsLoadingChapters(true);
      try {
        const response = await fetch(`/api/codes/${encodeURIComponent(selectedCode!)}/chapters`);
        if (response.ok) {
          const data = await response.json();
          setChapters(data.chapters);
        }
      } catch (error) {
        console.error('Error fetching chapters:', error);
      } finally {
        setIsLoadingChapters(false);
      }
    }
    fetchChapters();
  }, [selectedCode]);

  // Fetch sections when a chapter is selected
  useEffect(() => {
    if (!selectedCode || !selectedChapter) {
      setSections([]);
      return;
    }

    async function fetchSections() {
      setIsLoadingSections(true);
      try {
        const response = await fetch(
          `/api/codes/${encodeURIComponent(selectedCode!)}/sections?chapter=${encodeURIComponent(selectedChapter!)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSections(data.sections);
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
      } finally {
        setIsLoadingSections(false);
      }
    }
    fetchSections();
  }, [selectedCode, selectedChapter]);

  // Fetch bills when a section is selected
  useEffect(() => {
    if (!selectedCode || !selectedSection) {
      setBills([]);
      return;
    }

    async function fetchBills() {
      setIsLoadingBills(true);
      try {
        const response = await fetch(
          `/api/codes/${encodeURIComponent(selectedCode!)}/sections/${encodeURIComponent(selectedSection!)}/bills`
        );
        if (response.ok) {
          const data = await response.json();
          setBills(data.references);
        }
      } catch (error) {
        console.error('Error fetching bills:', error);
      } finally {
        setIsLoadingBills(false);
      }
    }
    fetchBills();
  }, [selectedCode, selectedSection]);

  const filteredCodes = codes.filter((code) =>
    code.code.toLowerCase().includes(codeFilter.toLowerCase())
  );

  const filteredChapters = chapters.filter((chapter) =>
    chapter.chapter.toLowerCase().includes(chapterFilter.toLowerCase())
  );

  const filteredSections = sections.filter((section) =>
    section.section.toLowerCase().includes(sectionFilter.toLowerCase())
  );

  const handleSelectCode = (code: string) => {
    setChapterFilter('');
    setSectionFilter('');
    router.push(`/statutes?code=${encodeURIComponent(code)}`);
  };

  const handleSelectChapter = (chapter: string) => {
    if (selectedCode) {
      setSectionFilter('');
      router.push(
        `/statutes?code=${encodeURIComponent(selectedCode)}&chapter=${encodeURIComponent(chapter)}`
      );
    }
  };

  const handleSelectSection = (section: string) => {
    if (selectedCode && selectedChapter) {
      router.push(
        `/statutes?code=${encodeURIComponent(selectedCode)}&chapter=${encodeURIComponent(selectedChapter)}&section=${encodeURIComponent(section)}`
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Texas Statutes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas codes and see which bills affect each section
        </p>
      </div>

      {/* Main content - 4 columns */}
      <div className="flex min-h-0 flex-1 gap-3 px-6 pb-6">
        {/* Column 1: Code List */}
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">Texas Codes</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter codes..."
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {isLoadingCodes ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredCodes.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {codes.length === 0
                    ? 'No statute references found. Run the populate script first.'
                    : 'No codes match your filter.'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredCodes.map((code) => (
                    <Button
                      key={code.code}
                      variant={selectedCode === code.code ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleSelectCode(code.code)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-sm">{code.code}</div>
                        <div className="text-xs text-muted-foreground">
                          {code.billCount} {code.billCount === 1 ? 'bill' : 'bills'}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 2: Chapters */}
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedCode ? 'Chapters' : 'Select a Code'}
            </CardTitle>
            {selectedCode && (
              <div className="relative mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter chapters..."
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {!selectedCode ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
                  Select a code to view chapters
                </div>
              ) : isLoadingChapters ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredChapters.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {chapters.length === 0
                    ? 'No chapters found for this code.'
                    : 'No chapters match your filter.'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredChapters.map((chapter) => (
                    <Button
                      key={chapter.chapter}
                      variant={selectedChapter === chapter.chapter ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleSelectChapter(chapter.chapter)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-sm">{chapter.chapter}</div>
                        <div className="text-xs text-muted-foreground">
                          {chapter.sectionCount} {chapter.sectionCount === 1 ? 'section' : 'sections'} · {chapter.billCount} {chapter.billCount === 1 ? 'bill' : 'bills'}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 3: Sections */}
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedChapter ? 'Sections' : 'Select a Chapter'}
            </CardTitle>
            {selectedChapter && (
              <div className="relative mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter sections..."
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {!selectedChapter ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
                  Select a chapter to view sections
                </div>
              ) : isLoadingSections ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredSections.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {sections.length === 0
                    ? 'No sections found for this chapter.'
                    : 'No sections match your filter.'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredSections.map((section) => (
                    <Button
                      key={section.section}
                      variant={selectedSection === section.section ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleSelectSection(section.section)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-sm">{section.section}</div>
                        <div className="text-xs text-muted-foreground">
                          {section.billCount} {section.billCount === 1 ? 'bill' : 'bills'}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 4: Bills */}
        <Card className="flex flex-1 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              {selectedSection
                ? `Bills affecting ${selectedSection}`
                : 'Select a Section'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {!selectedSection ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
                  Select a section to view affecting bills
                </div>
              ) : isLoadingBills ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : bills.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No bills found for this section.
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {bills.map((ref) => (
                    <Link
                      key={ref.id}
                      href={`/bills/${ref.bill.billId.replace(' ', '-')}`}
                      className="block rounded-lg border p-3 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={ref.bill.billType === 'HB' ? 'hb' : 'sb'}
                              className="text-xs"
                            >
                              {ref.bill.billType}
                            </Badge>
                            <span className="font-medium">{ref.bill.billId}</span>
                            <Badge variant={getActionVariant(ref.action)} className="text-xs">
                              {ref.action}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {ref.bill.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{ref.billSection}</span>
                            {ref.bill.status && (
                              <>
                                <span>·</span>
                                <span>{ref.bill.status}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatutesPageFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Texas Statutes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas codes and see which bills affect each section
        </p>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 px-6 pb-6">
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">Texas Codes</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">Select a Code</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card className="flex w-56 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">Select a Chapter</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card className="flex flex-1 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">Select a Section</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function StatutesPage() {
  return (
    <Suspense fallback={<StatutesPageFallback />}>
      <StatutesPageContent />
    </Suspense>
  );
}
