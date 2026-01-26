'use client';

import { useState, useEffect } from 'react';
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

export default function StatutesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCode = searchParams.get('code');
  const selectedSection = searchParams.get('section');

  const [codeFilter, setCodeFilter] = useState('');
  const [codes, setCodes] = useState<CodeStats[]>([]);
  const [sections, setSections] = useState<SectionStats[]>([]);
  const [bills, setBills] = useState<BillReference[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
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

  // Fetch sections when a code is selected
  useEffect(() => {
    if (!selectedCode) {
      setSections([]);
      return;
    }

    async function fetchSections() {
      setIsLoadingSections(true);
      try {
        const response = await fetch(`/api/codes/${encodeURIComponent(selectedCode!)}/sections`);
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
  }, [selectedCode]);

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

  const handleSelectCode = (code: string) => {
    router.push(`/statutes?code=${encodeURIComponent(code)}`);
  };

  const handleSelectSection = (section: string) => {
    if (selectedCode) {
      router.push(
        `/statutes?code=${encodeURIComponent(selectedCode)}&section=${encodeURIComponent(section)}`
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

      {/* Main content - 3 columns */}
      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
        {/* Column 1: Code List */}
        <Card className="flex w-72 flex-col">
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

        {/* Column 2: Sections */}
        <Card className="flex w-80 flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedCode ? `${selectedCode} Sections` : 'Select a Code'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {!selectedCode ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
                  Select a code to view its sections
                </div>
              ) : isLoadingSections ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : sections.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No sections found for this code.
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {sections.map((section) => (
                    <Button
                      key={section.section}
                      variant={selectedSection === section.section ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleSelectSection(section.section)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-sm">{section.section}</div>
                        <div className="text-xs text-muted-foreground">
                          {section.chapter && `${section.chapter} · `}
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

        {/* Column 3: Bills */}
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
