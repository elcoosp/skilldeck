// src/components/ui/provider-select.tsx
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderIcon } from './provider-icon';

interface ProviderSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { id: string; label: string }[];
}

export function ProviderSelect({ value, onValueChange, options }: ProviderSelectProps) {
  const selected = options.find(opt => opt.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <ProviderIcon provider={value} size={16} />
            <span>{selected?.label || value}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full min-w-[200px]">
        {options.map(opt => (
          <DropdownMenuItem key={opt.id} onClick={() => onValueChange(opt.id)}>
            <ProviderIcon provider={opt.id} size={16} className="mr-2" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
