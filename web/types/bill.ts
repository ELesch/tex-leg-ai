/**
 * Bill type enum matching Prisma schema
 */
export type BillType = 'HB' | 'SB' | 'HJR' | 'SJR' | 'HCR' | 'SCR';

/**
 * Bill summary for list views
 */
export interface BillSummary {
  id: string;
  billId: string;
  billType: BillType;
  billNumber: number;
  description: string;
  status?: string | null;
  lastAction?: string | null;
  lastActionDate?: string | null;
}

/**
 * Full bill details
 */
export interface BillDetail extends BillSummary {
  content?: string | null;
  contentPath?: string | null;
  filename: string;
  authors: string[];
  subjects: string[];
  session: {
    code: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Bill list API response
 */
export interface BillListResponse {
  bills: BillSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Bill search parameters
 */
export interface BillSearchParams {
  search?: string;
  billType?: BillType | 'all';
  sortBy?: 'billNumber' | 'lastActionDate' | 'description';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  session?: string;
}

/**
 * AI filter request
 */
export interface AiFilterRequest {
  bills: string[]; // Bill IDs
  criteria: string;
}

/**
 * AI filter response
 */
export interface AiFilterResponse {
  filteredBills: BillSummary[];
  totalMatches: number;
}
