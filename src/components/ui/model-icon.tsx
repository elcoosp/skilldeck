// src/components/ui/model-icon.tsx
import {
  Claude,
  Gemma,
  Gemini,
  DeepSeek,
  Mistral,
  Qwen,
  Zhipu,
  Doubao,
  Moonshot,
  Yi,
  Minimax,
  Stepfun,
  Spark,
  Wenxin,
  Baichuan,
  Hunyuan,
  Ollama,
  InternLM,
  Skywork,
  SenseNova,
  OpenAI,
  Dalle,
  Sora,
  Grok,
  Cohere,
  Google,
  Flux,
  LLaVA,
  CodeGeeX,
  CogVideo,
  CogView,
  Kolors,
  KwaiKAT,
  Dbrx,
  Rwkv,
} from '@lobehub/icons'

interface ModelIconProps {
  modelId: string
  size?: number
  className?: string
  colored?: boolean
}

const modelPrefixMap: Record<string, React.ComponentType<any>> = {
  'claude': Claude,
  'gemma': Gemma,
  'gemini': Gemini,
  'deepseek': DeepSeek,
  'mistral': Mistral,
  'mixtral': Mistral,
  'qwen': Qwen,
  'glm': Zhipu,
  'chatglm': Zhipu,
  'doubao': Doubao,
  'moonshot': Moonshot,
  'yi': Yi,
  'minimax': Minimax,
  'step': Stepfun,
  'spark': Spark,
  'ernie': Wenxin,
  'wenxin': Wenxin,
  'baichuan': Baichuan,
  'hunyuan': Hunyuan,
  'llava': LLaVA,
  'llama': Ollama,
  'codellama': Ollama,
  'rwkv': Rwkv,
  'internlm': InternLM,
  'skywork': Skywork,
  'sensenova': SenseNova,
  'gpt': OpenAI,
  'o1': OpenAI,
  'o3': OpenAI,
  'codex': OpenAI,
  'dall-e': Dalle,
  'dall·e': Dalle,
  'sora': Sora,
  'grok': Grok,
  'command': Cohere,
  'palm': Google,
  'flux': Flux,
  'codegeex': CodeGeeX,
  'cogvideo': CogVideo,
  'cogview': CogView,
  'dbrx': Dbrx,
  'kolors': Kolors,
  'kwai': KwaiKAT,

}

export function ModelIcon({
  modelId,
  size = 16,
  className,
  colored = true
}: ModelIconProps) {
  if (!modelId) return null

  const id = modelId.toLowerCase()


  const matchKey = Object.keys(modelPrefixMap).find((key) => id.startsWith(key))
  // ------------------

  if (!matchKey) return null

  const Icon = modelPrefixMap[matchKey]
  return <Icon size={size} className={className} type={colored ? "colored" : undefined} />
}
