// Core components
export { StatuteTree } from './statute-tree';
export { StatuteViewer } from './statute-viewer';
export { TreeNode, type TreeNodeData, type NodeType, type MarkerColor, type MarkerData, getMarkerColorClass } from './tree-node';

// Workspace layout
export { StatuteWorkspaceLayout } from './statute-workspace-layout';

// Panel components
export { StatuteMarkersPanel } from './statute-markers-panel';
export { StatuteNotesPanel } from './statute-notes-panel';
export { AffectingBillPane } from './affecting-bill-pane';

// Text and annotation components
export { AnnotatableStatuteText, type StatuteAnnotation, type SearchMatch } from './annotatable-statute-text';
export { StatuteAnnotationPopover, type AnnotationType } from './statute-annotation-popover';

// Search components
export { StatuteSearchBar } from './statute-search-bar';
export { StatuteSearchResults, type SearchResult } from './statute-search-results';
export { StatuteScrollbarMarkers, type ScrollbarMarker, calculateMarkerPositions, calculateAnnotationMarkerPositions } from './statute-scrollbar-markers';

// View components
export { ChapterFullView } from './chapter-full-view';
export { ViewPreferencesToggle } from './view-preferences-toggle';
