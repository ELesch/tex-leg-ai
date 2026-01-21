import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillCard } from './bill-card';
import type { BillSummary } from '@/types';

const mockBill: BillSummary = {
  id: '1',
  billId: 'HB 123',
  billType: 'HB',
  billNumber: 123,
  description: 'An act relating to education funding for public schools in Texas.',
  status: 'Filed',
  lastAction: 'Referred to Education Committee',
  lastActionDate: '2024-03-15T12:00:00',
};

describe('BillCard', () => {
  it('renders bill ID', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText('HB 123')).toBeInTheDocument();
  });

  it('renders bill type badge', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText('HB')).toBeInTheDocument();
  });

  it('renders bill description', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText(/An act relating to education funding/)).toBeInTheDocument();
  });

  it('renders status badge when status is provided', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText('Filed')).toBeInTheDocument();
  });

  it('does not render status badge when status is undefined', () => {
    const billWithoutStatus = { ...mockBill, status: undefined };
    render(<BillCard bill={billWithoutStatus} />);
    expect(screen.queryByText('Filed')).not.toBeInTheDocument();
  });

  it('renders last action when provided', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText(/Referred to Education/)).toBeInTheDocument();
  });

  it('does not render last action when not provided', () => {
    const billWithoutAction = { ...mockBill, lastAction: undefined };
    render(<BillCard bill={billWithoutAction} />);
    expect(screen.queryByText('Last action:')).not.toBeInTheDocument();
  });

  it('renders last action date when provided', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText(/Mar 15, 2024/)).toBeInTheDocument();
  });

  it('truncates long descriptions', () => {
    const billWithLongDescription = {
      ...mockBill,
      description: 'A'.repeat(200),
    };
    render(<BillCard bill={billWithLongDescription} />);
    const description = screen.getByText(/A+\.\.\./);
    expect(description).toBeInTheDocument();
  });

  it('renders SB badge variant for Senate bills', () => {
    const senateBill = { ...mockBill, billType: 'SB' as const, billId: 'SB 456' };
    render(<BillCard bill={senateBill} />);
    expect(screen.getByText('SB')).toBeInTheDocument();
  });
});
