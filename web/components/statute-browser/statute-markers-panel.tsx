'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Flag, Trash2, Edit2, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MarkerColor, getMarkerColorClass } from './tree-node';

interface Marker {
  id: string;
  codeAbbr: string;
  chapterNum: string | null;
  subchapter: string | null;
  color: MarkerColor;
  label: string | null;
  createdAt: string;
}

interface StatuteMarkersPanelProps {
  onNavigateToMarker?: (codeAbbr: string, chapterNum?: string, subchapter?: string) => void;
}

const MARKER_COLORS: { color: MarkerColor; label: string; className: string }[] = [
  { color: 'RED', label: 'Red', className: 'bg-red-500' },
  { color: 'ORANGE', label: 'Orange', className: 'bg-orange-500' },
  { color: 'YELLOW', label: 'Yellow', className: 'bg-yellow-500' },
  { color: 'GREEN', label: 'Green', className: 'bg-green-500' },
  { color: 'BLUE', label: 'Blue', className: 'bg-blue-500' },
  { color: 'PURPLE', label: 'Purple', className: 'bg-purple-500' },
];

export function StatuteMarkersPanel({ onNavigateToMarker }: StatuteMarkersPanelProps) {
  const { data: session } = useSession();
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMarker, setEditingMarker] = useState<Marker | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState<MarkerColor>('YELLOW');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch markers
  const fetchMarkers = useCallback(async () => {
    if (!session?.user) {
      setMarkers([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/statutes/markers');
      if (response.ok) {
        const data = await response.json();
        setMarkers(data.markers);
      }
    } catch (error) {
      console.error('Error fetching markers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  // Delete a marker
  const handleDelete = async (marker: Marker) => {
    try {
      const response = await fetch(`/api/statutes/markers/${marker.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMarkers(prev => prev.filter(m => m.id !== marker.id));
      }
    } catch (error) {
      console.error('Error deleting marker:', error);
    }
  };

  // Update a marker
  const handleSaveEdit = async () => {
    if (!editingMarker) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/statutes/markers/${editingMarker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: editColor,
          label: editLabel || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMarkers(prev => prev.map(m =>
          m.id === editingMarker.id ? data.marker : m
        ));
        setEditingMarker(null);
      }
    } catch (error) {
      console.error('Error updating marker:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (marker: Marker) => {
    setEditingMarker(marker);
    setEditLabel(marker.label || '');
    setEditColor(marker.color);
  };

  // Get display location for a marker
  const getMarkerLocation = (marker: Marker): string => {
    let location = marker.codeAbbr;
    if (marker.chapterNum) {
      location += ` Ch. ${marker.chapterNum}`;
    }
    if (marker.subchapter) {
      location += ` Subch. ${marker.subchapter}`;
    }
    return location;
  };

  // Group markers by code
  const markersByCode = markers.reduce((acc, marker) => {
    const code = marker.codeAbbr;
    if (!acc[code]) {
      acc[code] = [];
    }
    acc[code].push(marker);
    return acc;
  }, {} as Record<string, Marker[]>);

  if (!session?.user) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Flag className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>Sign in to save markers</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Flag className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>No markers yet</p>
        <p className="text-xs mt-1">
          Right-click on a code, chapter, or subchapter in the tree to add a marker
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-3 border-b">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Markers</h2>
          <span className="text-xs text-muted-foreground">({markers.length})</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {Object.entries(markersByCode).map(([code, codeMarkers]) => (
            <div key={code}>
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                {code}
              </div>
              <div className="space-y-1">
                {codeMarkers.map(marker => (
                  <div
                    key={marker.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 group cursor-pointer"
                    onClick={() => onNavigateToMarker?.(
                      marker.codeAbbr,
                      marker.chapterNum || undefined,
                      marker.subchapter || undefined
                    )}
                  >
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full shrink-0',
                        getMarkerColorClass(marker.color)
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {getMarkerLocation(marker)}
                      </div>
                      {marker.label && (
                        <div className="text-xs text-muted-foreground truncate">
                          {marker.label}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(marker);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(marker);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={!!editingMarker} onOpenChange={(open) => !open && setEditingMarker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Marker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <div className="text-sm text-muted-foreground">
                {editingMarker && getMarkerLocation(editingMarker)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {MARKER_COLORS.map(({ color, label, className }) => (
                  <button
                    key={color}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      className,
                      editColor === color && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    title={label}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label (optional)</label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Add a label..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMarker(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
