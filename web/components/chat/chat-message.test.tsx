import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './chat-message';
import type { Message } from 'ai';

describe('ChatMessage', () => {
  const userMessage: Message = {
    id: '1',
    role: 'user',
    content: 'What is this bill about?',
  };

  const assistantMessage: Message = {
    id: '2',
    role: 'assistant',
    content: 'This bill is about education funding.',
  };

  describe('user messages', () => {
    it('renders user message content', () => {
      render(<ChatMessage message={userMessage} />);
      expect(screen.getByText('What is this bill about?')).toBeInTheDocument();
    });

    it('displays user icon for user messages', () => {
      const { container } = render(<ChatMessage message={userMessage} />);
      // User messages should have the User icon (svg)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('applies correct styling for user messages', () => {
      const { container } = render(<ChatMessage message={userMessage} />);
      const messageContainer = container.firstChild as HTMLElement;
      expect(messageContainer.className).toContain('flex-row-reverse');
    });
  });

  describe('assistant messages', () => {
    it('renders assistant message content', () => {
      render(<ChatMessage message={assistantMessage} />);
      expect(screen.getByText('This bill is about education funding.')).toBeInTheDocument();
    });

    it('displays bot icon for assistant messages', () => {
      const { container } = render(<ChatMessage message={assistantMessage} />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('applies correct styling for assistant messages', () => {
      const { container } = render(<ChatMessage message={assistantMessage} />);
      const messageContainer = container.firstChild as HTMLElement;
      expect(messageContainer.className).toContain('flex-row');
      expect(messageContainer.className).not.toContain('flex-row-reverse');
    });
  });

  it('preserves whitespace in message content', () => {
    const messageWithNewlines: Message = {
      id: '3',
      role: 'assistant',
      content: 'Line 1\nLine 2\nLine 3',
    };
    render(<ChatMessage message={messageWithNewlines} />);
    const contentDiv = screen.getByText(/Line 1/);
    expect(contentDiv.className).toContain('whitespace-pre-wrap');
  });

  it('handles empty message content', () => {
    const emptyMessage: Message = {
      id: '4',
      role: 'user',
      content: '',
    };
    const { container } = render(<ChatMessage message={emptyMessage} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles long message content', () => {
    const longMessage: Message = {
      id: '5',
      role: 'assistant',
      content: 'A'.repeat(1000),
    };
    render(<ChatMessage message={longMessage} />);
    expect(screen.getByText(/A+/)).toBeInTheDocument();
  });
});
