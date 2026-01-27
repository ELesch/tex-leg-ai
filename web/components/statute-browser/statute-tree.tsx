'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, BookOpen } from 'lucide-react';
import { TreeNode, TreeNodeData, NodeType } from './tree-node';

interface CodeData {
  id: string;
  abbreviation: string;
  name: string;
  sectionCount: number;
  hasChildren: boolean;
}

interface ChapterData {
  chapterNum: string;
  chapterTitle: string | null;
  sectionCount: number;
  hasSubchapters: boolean;
}

interface SubchapterData {
  subchapter: string;
  subchapterTitle: string | null;
  sectionCount: number;
}

interface SectionData {
  id: string;
  sectionNum: string;
  heading: string | null;
}

type ExpandedNodes = Set<string>;
type LoadedChildren = Map<string, TreeNodeData[]>;

interface StatuteTreeProps {
  onSelectSection: (codeAbbr: string, sectionNum: string) => void;
  selectedSection: string | null; // Format: "CODE-sectionNum"
}

export function StatuteTree({ onSelectSection, selectedSection }: StatuteTreeProps) {
  const [codes, setCodes] = useState<CodeData[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<ExpandedNodes>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<LoadedChildren>(new Map());
  const [filter, setFilter] = useState('');

  // Fetch top-level codes on mount
  useEffect(() => {
    async function fetchCodes() {
      try {
        const response = await fetch('/api/statute-browser/tree');
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

  // Generate a unique key for a node
  const getNodeKey = useCallback((type: NodeType, ...parts: string[]) => {
    return `${type}:${parts.join(':')}`;
  }, []);

  // Fetch children for a node
  const fetchChildren = useCallback(async (
    nodeKey: string,
    type: NodeType,
    codeAbbr: string,
    chapterNum?: string,
    subchapter?: string
  ) => {
    if (loadedChildren.has(nodeKey)) return;

    setLoadingNodes(prev => new Set(prev).add(nodeKey));

    try {
      let url = `/api/statute-browser/tree/${encodeURIComponent(codeAbbr)}`;
      if (chapterNum) {
        url += `/${encodeURIComponent(chapterNum)}`;
      }
      if (subchapter) {
        url += `/${encodeURIComponent(subchapter)}`;
      }

      const response = await fetch(url);
      if (!response.ok) return;

      const data = await response.json();
      const children: TreeNodeData[] = [];

      if (type === 'code') {
        // Fetched chapters
        for (const ch of data.chapters as ChapterData[]) {
          children.push({
            id: getNodeKey('chapter', codeAbbr, ch.chapterNum),
            type: 'chapter',
            label: `Ch. ${ch.chapterNum}`,
            sublabel: ch.chapterTitle || undefined,
            hasChildren: true,
            codeAbbr,
          });
        }
      } else if (type === 'chapter') {
        // Fetched subchapters and sections
        for (const sc of (data.subchapters as SubchapterData[]) || []) {
          if (sc.subchapter) {
            children.push({
              id: getNodeKey('subchapter', codeAbbr, chapterNum!, sc.subchapter),
              type: 'subchapter',
              label: `Subch. ${sc.subchapter}`,
              sublabel: sc.subchapterTitle || undefined,
              hasChildren: true,
              codeAbbr,
            });
          }
        }
        for (const s of (data.sections as SectionData[]) || []) {
          children.push({
            id: getNodeKey('section', codeAbbr, s.sectionNum),
            type: 'section',
            label: `§ ${s.sectionNum}`,
            sublabel: s.heading || undefined,
            hasChildren: false,
            sectionNum: s.sectionNum,
            codeAbbr,
          });
        }
      } else if (type === 'subchapter') {
        // Fetched sections for subchapter
        for (const s of (data.sections as SectionData[]) || []) {
          children.push({
            id: getNodeKey('section', codeAbbr, s.sectionNum),
            type: 'section',
            label: `§ ${s.sectionNum}`,
            sublabel: s.heading || undefined,
            hasChildren: false,
            sectionNum: s.sectionNum,
            codeAbbr,
          });
        }
      }

      setLoadedChildren(prev => new Map(prev).set(nodeKey, children));
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeKey);
        return next;
      });
    }
  }, [loadedChildren, getNodeKey]);

  // Toggle expand/collapse
  const toggleNode = useCallback((nodeKey: string, type: NodeType, codeAbbr: string, chapterNum?: string, subchapter?: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
        // Fetch children if not already loaded
        fetchChildren(nodeKey, type, codeAbbr, chapterNum, subchapter);
      }
      return next;
    });
  }, [fetchChildren]);

  // Handle section selection
  const handleSelectSection = useCallback((codeAbbr: string, sectionNum: string) => {
    onSelectSection(codeAbbr, sectionNum);
  }, [onSelectSection]);

  // Filter codes
  const filteredCodes = codes.filter(code =>
    filter === '' ||
    code.abbreviation.toLowerCase().includes(filter.toLowerCase()) ||
    code.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Render children recursively
  const renderChildren = (parentKey: string) => {
    const children = loadedChildren.get(parentKey);
    if (!children) return null;

    return children.map(child => {
      const isExpanded = expandedNodes.has(child.id);
      const isLoading = loadingNodes.has(child.id);
      const isSelected = selectedSection === `${child.codeAbbr}-${child.sectionNum}`;

      // Determine what to pass for toggle
      const parts = child.id.split(':');
      const type = parts[0] as NodeType;
      const codeAbbr = child.codeAbbr || parts[1];
      let chapterNum: string | undefined;
      let subchapter: string | undefined;

      if (type === 'chapter') {
        chapterNum = parts[2];
      } else if (type === 'subchapter') {
        chapterNum = parts[2];
        subchapter = parts[3];
      }

      const level = type === 'chapter' ? 1 : type === 'subchapter' ? 2 : type === 'section' && parts.length > 3 ? 3 : 2;

      return (
        <TreeNode
          key={child.id}
          node={child}
          level={level}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isLoading={isLoading}
          onToggle={() => toggleNode(child.id, type, codeAbbr, chapterNum, subchapter)}
          onSelect={() => child.sectionNum && child.codeAbbr && handleSelectSection(child.codeAbbr, child.sectionNum)}
        >
          {isExpanded && renderChildren(child.id)}
        </TreeNode>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Texas Codes</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter codes..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* Tree content */}
      <ScrollArea className="flex-1">
        <div role="tree" aria-label="Statute tree" className="p-2">
          {isLoadingCodes ? (
            <div className="space-y-2 p-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {codes.length === 0
                ? 'No statutes found. Run the statute sync first.'
                : 'No codes match your filter.'}
            </div>
          ) : (
            filteredCodes.map(code => {
              const nodeKey = getNodeKey('code', code.abbreviation);
              const isExpanded = expandedNodes.has(nodeKey);
              const isLoading = loadingNodes.has(nodeKey);

              const nodeData: TreeNodeData = {
                id: nodeKey,
                type: 'code',
                label: code.abbreviation,
                sublabel: code.name,
                hasChildren: code.hasChildren,
                codeAbbr: code.abbreviation,
              };

              return (
                <TreeNode
                  key={code.id}
                  node={nodeData}
                  level={0}
                  isExpanded={isExpanded}
                  isSelected={false}
                  isLoading={isLoading}
                  onToggle={() => toggleNode(nodeKey, 'code', code.abbreviation)}
                  onSelect={() => {}}
                >
                  {isExpanded && renderChildren(nodeKey)}
                </TreeNode>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
