// src/components/GlobalEventListeners.tsx

import { useAttachFilesListener } from '@/hooks/use-attach-files-listener'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSkillEvents } from '@/hooks/use-skill-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'

export function GlobalEventListeners() {
  useMcpEvents()
  useSubagentEvents()
  useSkillEvents()
  useAttachFilesListener()
  return null
}
