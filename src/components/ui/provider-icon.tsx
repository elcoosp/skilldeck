// src/components/ui/provider-icon.tsx
import { ProviderIcon as LobeProviderIcon } from '@lobehub/icons';
import { cn } from '@/lib/utils';

interface ProviderIconProps {
  provider: string;
  size?: number;
  type?: 'mono' | 'color' | 'brand' | 'brand-color';
  className?: string;
}

export function ProviderIcon({ provider, size = 16, type = 'mono', className }: ProviderIconProps) {
  // Normalize provider string to match lobe's expected keys
  const normalized = provider.toLowerCase();
  // Map common provider names to lobe's provider keys
  const providerMap: Record<string, string> = {
    openai: 'openai',
    anthropic: 'anthropic',
    claude: 'anthropic', // Claude uses Anthropic icon
    ollama: 'ollama',
    google: 'google',
    gemini: 'google',
    mistral: 'mistral',
    cohere: 'cohere',
    deepseek: 'deepseek',
    perplexity: 'perplexity',
    groq: 'groq',
    together: 'together.ai',
    replicate: 'replicate',
    huggingface: 'huggingface',
    azure: 'azure',
    aws: 'aws',
    bedrock: 'bedrock',
    vertexai: 'vertexai',
  };
  const lobeProvider = providerMap[normalized] || normalized;
  return (
    <LobeProviderIcon
      provider={lobeProvider}
      size={size}
      type={type}
      className={cn('shrink-0', className)}
    />
  );
}
