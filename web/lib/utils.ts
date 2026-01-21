import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse bill ID into type and number
 * e.g., "HB 123" -> { type: "HB", number: 123 }
 */
export function parseBillId(billId: string): { type: string; number: number } | null {
  const match = billId.match(/^(HB|SB|HJR|SJR|HCR|SCR)\s*(\d+)$/i);
  if (!match) return null;
  return {
    type: match[1].toUpperCase(),
    number: parseInt(match[2], 10),
  };
}

/**
 * Format bill ID consistently
 * e.g., "hb123" -> "HB 123"
 */
export function formatBillId(billId: string): string {
  const parsed = parseBillId(billId);
  if (!parsed) return billId;
  return `${parsed.type} ${parsed.number}`;
}

/**
 * Get bill type display name
 */
export function getBillTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    HB: 'House Bill',
    SB: 'Senate Bill',
    HJR: 'House Joint Resolution',
    SJR: 'Senate Joint Resolution',
    HCR: 'House Concurrent Resolution',
    SCR: 'Senate Concurrent Resolution',
  };
  return labels[type.toUpperCase()] || type;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
