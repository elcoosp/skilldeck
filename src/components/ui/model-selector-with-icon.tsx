// src/components/ui/model-selector-with-icon.tsx

import { ModelIcon } from '@/components/ui/model-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ModelSelectorWithIconProps {
  value: string
  onValueChange: (value: string) => void
  models: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function ModelSelectorWithIcon({
  value,
  onValueChange,
  models,
  placeholder = 'Select model',
  className,
  disabled
}: ModelSelectorWithIconProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('h-7 text-xs', className)}>
        <div className="flex items-center gap-1.5 truncate">
          <ModelIcon colored modelId={value} size={14} className="shrink-0" />
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
        </div>

        <div className="sr-only">
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>

      <SelectContent>
        {models.map((modelId) => (
          <SelectItem key={modelId} value={modelId} className="text-xs">
            <div className="flex items-center gap-2">
              <ModelIcon
                colored
                modelId={modelId}
                size={14}
                className="shrink-0"
              />
              <span className="truncate">{modelId}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
