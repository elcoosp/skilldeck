/**
 * useWorkflowEvents — subscribe to Tauri workflow-event channel.
 *
 * Exposes the latest workflow state update so UI components (WorkflowTab)
 * can render live step progress without polling.
 */

import { useEffect, useState } from 'react'
import type { WorkflowEvent } from '@/lib/events'
import { onWorkflowEvent } from '@/lib/events'
import type { UUID } from '@/lib/types'

export interface WorkflowStepProgress {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
}

export interface WorkflowProgress {
  workflowId: UUID
  status: 'running' | 'completed' | 'failed'
  steps: Record<string, WorkflowStepProgress>
  error?: string
}

export function useWorkflowEvents() {
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | null = null

    const handleEvent = (event: WorkflowEvent) => {
      switch (event.type) {
        case 'started':
          if (event.id) {
            setProgress({
              workflowId: event.id,
              status: 'running',
              steps: {}
            })
          }
          break

        case 'step_started':
          if (event.workflow_id && event.step_id) {
            setProgress((prev) => {
              if (!prev || prev.workflowId !== event.workflow_id) return prev
              return {
                ...prev,
                steps: {
                  ...prev.steps,
                  [event.step_id!]: {
                    stepId: event.step_id!,
                    status: 'running'
                  }
                }
              }
            })
          }
          break

        case 'step_completed':
          if (event.workflow_id && event.step_id) {
            setProgress((prev) => {
              if (!prev || prev.workflowId !== event.workflow_id) return prev
              return {
                ...prev,
                steps: {
                  ...prev.steps,
                  [event.step_id!]: {
                    stepId: event.step_id!,
                    status: 'completed',
                    result: event.result ?? undefined
                  }
                }
              }
            })
          }
          break

        case 'completed':
          setProgress((prev) =>
            prev && prev.workflowId === event.id
              ? { ...prev, status: 'completed' }
              : prev
          )
          break

        case 'failed':
          setProgress((prev) =>
            prev && prev.workflowId === event.id
              ? { ...prev, status: 'failed', error: event.message }
              : prev
          )
          break
      }
    }

    onWorkflowEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])

  return { progress }
}
