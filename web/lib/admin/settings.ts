import { prisma } from '@/lib/db/prisma';
import { SettingType } from '@prisma/client';
import { DEFAULT_SETTINGS } from './defaults';

/**
 * Get a setting value by key with optional default fallback
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.adminSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  if (setting) {
    return setting.value;
  }

  // Fall back to default settings
  const defaultSetting = DEFAULT_SETTINGS.find((s) => s.key === key);
  return defaultSetting?.value ?? null;
}

/**
 * Get a setting value parsed as the correct type
 */
export async function getSettingTyped<T = string>(key: string): Promise<T | null> {
  const setting = await prisma.adminSetting.findUnique({
    where: { key },
    select: { value: true, type: true },
  });

  if (setting) {
    return parseSettingValue<T>(setting.value, setting.type);
  }

  // Fall back to default settings
  const defaultSetting = DEFAULT_SETTINGS.find((s) => s.key === key);
  if (defaultSetting) {
    return parseSettingValue<T>(defaultSetting.value, defaultSetting.type);
  }

  return null;
}

/**
 * Parse a setting value based on its type
 */
function parseSettingValue<T>(value: string, type: SettingType): T {
  switch (type) {
    case 'NUMBER':
      return Number(value) as T;
    case 'BOOLEAN':
      return (value === 'true') as T;
    case 'JSON':
      return JSON.parse(value) as T;
    case 'STRING':
    default:
      return value as T;
  }
}

/**
 * Update or create a setting with audit trail
 */
export async function setSetting(
  key: string,
  value: string,
  userId?: string
): Promise<void> {
  const existingSetting = await prisma.adminSetting.findUnique({
    where: { key },
  });

  if (existingSetting) {
    await prisma.adminSetting.update({
      where: { key },
      data: {
        value,
        updatedBy: userId,
      },
    });
  } else {
    // Get default setting info if available
    const defaultSetting = DEFAULT_SETTINGS.find((s) => s.key === key);

    await prisma.adminSetting.create({
      data: {
        key,
        value,
        type: defaultSetting?.type ?? 'STRING',
        category: defaultSetting?.category ?? 'general',
        description: defaultSetting?.description,
        updatedBy: userId,
      },
    });
  }
}

/**
 * Get all settings grouped by category
 */
export async function getSettingsByCategory(category?: string) {
  const where = category ? { category } : {};

  const dbSettings = await prisma.adminSetting.findMany({
    where,
    orderBy: { key: 'asc' },
  });

  // Merge with defaults (defaults that aren't in DB yet)
  const settingsMap = new Map(dbSettings.map((s) => [s.key, s]));

  const relevantDefaults = category
    ? DEFAULT_SETTINGS.filter((d) => d.category === category)
    : DEFAULT_SETTINGS;

  const allSettings = relevantDefaults.map((defaultSetting) => {
    const dbSetting = settingsMap.get(defaultSetting.key);
    if (dbSetting) {
      return {
        ...dbSetting,
        isDefault: false,
      };
    }
    return {
      id: `default-${defaultSetting.key}`,
      key: defaultSetting.key,
      value: defaultSetting.value,
      type: defaultSetting.type,
      category: defaultSetting.category,
      description: defaultSetting.description,
      updatedBy: null,
      updatedByUser: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    };
  });

  // Group by category
  const grouped = allSettings.reduce(
    (acc, setting) => {
      const cat = setting.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(setting);
      return acc;
    },
    {} as Record<string, typeof allSettings>
  );

  return grouped;
}

/**
 * Get all settings as a flat list
 */
export async function getAllSettings() {
  const dbSettings = await prisma.adminSetting.findMany({
    orderBy: { key: 'asc' },
  });

  const settingsMap = new Map(dbSettings.map((s) => [s.key, s]));

  return DEFAULT_SETTINGS.map((defaultSetting) => {
    const dbSetting = settingsMap.get(defaultSetting.key);
    if (dbSetting) {
      return {
        ...dbSetting,
        isDefault: false,
      };
    }
    return {
      id: `default-${defaultSetting.key}`,
      key: defaultSetting.key,
      value: defaultSetting.value,
      type: defaultSetting.type,
      category: defaultSetting.category,
      description: defaultSetting.description,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    };
  });
}

/**
 * Initialize default settings in the database
 */
export async function initializeDefaultSettings(): Promise<{
  created: number;
  skipped: number;
}> {
  let created = 0;
  let skipped = 0;

  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.adminSetting.findUnique({
      where: { key: setting.key },
    });

    if (!existing) {
      await prisma.adminSetting.create({
        data: {
          key: setting.key,
          value: setting.value,
          type: setting.type,
          category: setting.category,
          description: setting.description,
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  return { created, skipped };
}
