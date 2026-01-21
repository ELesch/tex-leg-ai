'use client';

import { cn } from '@/lib/utils';
import { Check, Circle, FileText, Users, Vote, Send, PenTool } from 'lucide-react';

interface BillProgressProps {
  status: string | null | undefined;
  billType: string;
}

interface Stage {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const HOUSE_STAGES: Stage[] = [
  { id: 'filed', label: 'Filed', icon: <FileText className="h-4 w-4" /> },
  { id: 'house_committee', label: 'House Committee', icon: <Users className="h-4 w-4" /> },
  { id: 'passed_house', label: 'Passed House', icon: <Vote className="h-4 w-4" /> },
  { id: 'senate_committee', label: 'Senate Committee', icon: <Users className="h-4 w-4" /> },
  { id: 'passed_senate', label: 'Passed Senate', icon: <Vote className="h-4 w-4" /> },
  { id: 'to_governor', label: 'To Governor', icon: <Send className="h-4 w-4" /> },
  { id: 'signed', label: 'Signed', icon: <PenTool className="h-4 w-4" /> },
];

const SENATE_STAGES: Stage[] = [
  { id: 'filed', label: 'Filed', icon: <FileText className="h-4 w-4" /> },
  { id: 'senate_committee', label: 'Senate Committee', icon: <Users className="h-4 w-4" /> },
  { id: 'passed_senate', label: 'Passed Senate', icon: <Vote className="h-4 w-4" /> },
  { id: 'house_committee', label: 'House Committee', icon: <Users className="h-4 w-4" /> },
  { id: 'passed_house', label: 'Passed House', icon: <Vote className="h-4 w-4" /> },
  { id: 'to_governor', label: 'To Governor', icon: <Send className="h-4 w-4" /> },
  { id: 'signed', label: 'Signed', icon: <PenTool className="h-4 w-4" /> },
];

function getStageIndex(status: string | null | undefined, stages: Stage[]): number {
  if (!status) return 0;

  const statusLower = status.toLowerCase();

  if (statusLower.includes('signed') || statusLower.includes('effective')) {
    return stages.length - 1; // Signed
  }
  if (statusLower.includes('sent to governor') || statusLower.includes('to governor')) {
    return stages.findIndex((s) => s.id === 'to_governor');
  }
  if (statusLower.includes('enrolled')) {
    return stages.findIndex((s) => s.id === 'to_governor');
  }
  if (statusLower.includes('passed both')) {
    return stages.findIndex((s) => s.id === 'to_governor') - 1;
  }
  if (statusLower.includes('passed')) {
    // Check which chamber based on bill type origin
    const isHouseBill = stages[1].id === 'house_committee';
    if (isHouseBill) {
      return stages.findIndex((s) => s.id === 'passed_house');
    } else {
      return stages.findIndex((s) => s.id === 'passed_senate');
    }
  }
  if (statusLower.includes('committee') || statusLower.includes('referred')) {
    return 1; // First committee
  }
  if (statusLower.includes('filed') || statusLower.includes('read first')) {
    return 0;
  }

  return 0;
}

export function BillProgress({ status, billType }: BillProgressProps) {
  const isHouseBill = billType === 'HB' || billType === 'HJR' || billType === 'HCR';
  const stages = isHouseBill ? HOUSE_STAGES : SENATE_STAGES;
  const currentStageIndex = getStageIndex(status, stages);

  return (
    <div className="w-full py-4">
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{
            width: `${(currentStageIndex / (stages.length - 1)) * 100}%`,
          }}
        />

        {/* Stages */}
        <div className="relative flex justify-between">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;

            return (
              <div
                key={stage.id}
                className="flex flex-col items-center"
                style={{ width: `${100 / stages.length}%` }}
              >
                {/* Circle/Icon */}
                <div
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-background text-primary ring-4 ring-primary/20',
                    isPending && 'border-muted bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    stage.icon
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'mt-2 text-xs text-center font-medium',
                    isCompleted && 'text-primary',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status text */}
      <div className="mt-4 text-center">
        <span className="text-sm text-muted-foreground">Current Status: </span>
        <span className="text-sm font-medium">{status || 'Unknown'}</span>
      </div>
    </div>
  );
}
