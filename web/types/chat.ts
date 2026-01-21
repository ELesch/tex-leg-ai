/**
 * Message role enum
 */
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/**
 * Chat session
 */
export interface ChatSession {
  id: string;
  userId: string;
  billId: string;
  title?: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat request payload
 */
export interface ChatRequest {
  billId: string;
  message: string;
}

/**
 * Chat history response
 */
export interface ChatHistoryResponse {
  history: ChatMessage[];
  billId: string;
}
