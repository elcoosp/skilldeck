// src/components/ui/model-selector-with-icon.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProviderIcon } from '@/components/ui/provider-icon'
import { getProviderFromModelId } from '@/lib/model-provider'
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
  disabled,
}: ModelSelectorWithIconProps) {
  // Find the selected model's provider
  const selectedProvider = value ? getProviderFromModelId(value) : null

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('h-7 text-xs', className)}>
        <div className="flex items-center gap-1.5 truncate">
          {selectedProvider && (
            <ProviderIcon provider={selectedProvider} size={14} className="shrink-0" />
          )}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {models.map((modelId) => {
          const provider = getProviderFromModelId(modelId)
          return (
            <SelectItem key={modelId} value={modelId} className="text-xs">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={provider} size={14} className="shrink-0" />
                <span className="truncate">{modelId}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
