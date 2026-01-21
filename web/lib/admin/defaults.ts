import { SettingType } from '@prisma/client';

export interface DefaultSetting {
  key: string;
  value: string;
  type: SettingType;
  category: string;
  description: string;
}

export const DEFAULT_SETTINGS: DefaultSetting[] = [
  // Session settings
  {
    key: 'SESSION_CODE',
    value: '89R',
    type: 'STRING',
    category: 'session',
    description: 'Texas Legislature session code (e.g., 89R for 89th Regular)',
  },
  {
    key: 'SESSION_NAME',
    value: '89th Regular Session',
    type: 'STRING',
    category: 'session',
    description: 'Full name of the legislative session',
  },

  // Sync settings
  {
    key: 'MAX_BILLS_PER_SYNC',
    value: '100',
    type: 'NUMBER',
    category: 'sync',
    description: 'Maximum number of bills to sync per operation',
  },
  {
    key: 'BATCH_DELAY_MS',
    value: '500',
    type: 'NUMBER',
    category: 'sync',
    description: 'Delay between batch requests in milliseconds',
  },
  {
    key: 'SYNC_ENABLED',
    value: 'true',
    type: 'BOOLEAN',
    category: 'sync',
    description: 'Enable or disable automatic bill syncing',
  },

  // AI settings
  {
    key: 'AI_MODEL',
    value: 'gpt-4o',
    type: 'STRING',
    category: 'ai',
    description: 'AI model used for bill analysis and chat',
  },
  {
    key: 'MAX_CONTEXT_LENGTH',
    value: '15000',
    type: 'NUMBER',
    category: 'ai',
    description: 'Maximum context length for AI requests',
  },

  // Feature flags
  {
    key: 'CHAT_ENABLED',
    value: 'true',
    type: 'BOOLEAN',
    category: 'features',
    description: 'Enable or disable the chat feature',
  },
  {
    key: 'REGISTRATION_ENABLED',
    value: 'true',
    type: 'BOOLEAN',
    category: 'features',
    description: 'Enable or disable user registration',
  },
];

export const SETTING_CATEGORIES = ['session', 'sync', 'ai', 'features'] as const;
export type SettingCategory = (typeof SETTING_CATEGORIES)[number];
