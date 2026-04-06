// src/lib/model-provider.ts
export type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'mistral'
  | 'cohere'
  | 'perplexity'
  | 'ollama'
  | 'qwen'
  | 'zhipu'
  | 'baidu'
  | 'tencent'
  | 'alibaba'
  | 'custom'

/**
 * Map a model ID to its provider key.
 * Uses prefix matching for known providers.
 */
export function getProviderFromModelId(modelId: string): ProviderKey {
  const id = modelId.toLowerCase()

  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3')) return 'openai'
  if (id.startsWith('claude')) return 'anthropic'
  if (id.startsWith('gemini')) return 'google'
  if (id.startsWith('deepseek')) return 'deepseek'
  if (id.startsWith('mistral') || id.startsWith('mixtral')) return 'mistral'
  if (id.startsWith('command')) return 'cohere'
  if (id.startsWith('llama') || id.startsWith('codellama') || id.startsWith('phi')) return 'ollama'
  if (id.startsWith('qwen')) return 'qwen'
  if (id.startsWith('glm')) return 'zhipu'
  if (id.startsWith('ernie')) return 'baidu'
  if (id.startsWith('hunyuan')) return 'tencent'
  if (id.startsWith('tongyi')) return 'alibaba'

  return 'custom'
}
