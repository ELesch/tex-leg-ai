'use client';

import { SettingType } from '@prisma/client';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SettingInputProps {
  settingKey: string;
  value: string;
  type: SettingType;
  description?: string | null;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

export function SettingInput({
  settingKey,
  value,
  type,
  description,
  onChange,
  disabled = false,
}: SettingInputProps) {
  const handleChange = (newValue: string) => {
    onChange(settingKey, newValue);
  };

  const renderInput = () => {
    switch (type) {
      case 'BOOLEAN':
        return (
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => handleChange(checked ? 'true' : 'false')}
            disabled={disabled}
          />
        );

      case 'NUMBER':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="max-w-xs"
          />
        );

      case 'JSON':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="font-mono text-sm"
            rows={4}
          />
        );

      case 'STRING':
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="max-w-md"
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={settingKey} className="font-mono text-sm">
          {settingKey}
        </Label>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-2">{renderInput()}</div>
    </div>
  );
}
