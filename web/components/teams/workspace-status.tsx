'use client';

import { WorkspaceStatus, WorkspacePriority } from '@prisma/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface WorkspaceStatusSelectProps {
  value: WorkspaceStatus;
  onChange: (value: WorkspaceStatus) => void;
  disabled?: boolean;
}

const statusOptions: { value: WorkspaceStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'NEEDS_DISCUSSION', label: 'Needs Discussion' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

export function WorkspaceStatusSelect({
  value,
  onChange,
  disabled,
}: WorkspaceStatusSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Status</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as WorkspaceStatus)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface WorkspacePrioritySelectProps {
  value: WorkspacePriority;
  onChange: (value: WorkspacePriority) => void;
  disabled?: boolean;
}

const priorityOptions: { value: WorkspacePriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export function WorkspacePrioritySelect({
  value,
  onChange,
  disabled,
}: WorkspacePrioritySelectProps) {
  return (
    <div className="space-y-2">
      <Label>Priority</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as WorkspacePriority)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {priorityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
