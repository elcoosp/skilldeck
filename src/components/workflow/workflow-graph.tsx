// src/components/workflow/workflow-graph.tsx
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { JsonValue } from '@/lib/bindings'

interface WorkflowStepSpec {
  id: string
  name: string
}

interface WorkflowDependencySpec {
  from: string
  to: string
}

const asStep = (value: JsonValue): WorkflowStepSpec | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const { id, name } = value
  return typeof id === 'string' && typeof name === 'string'
    ? { id, name }
    : null
}

const asDependency = (value: JsonValue): WorkflowDependencySpec | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const { from, to } = value
  return typeof from === 'string' && typeof to === 'string'
    ? { from, to }
    : null
}

interface WorkflowGraphProps {
  definition: JsonValue
  stepStatuses: Record<string, string>
}

export function WorkflowGraph({
  definition,
  stepStatuses
}: WorkflowGraphProps) {
  const rawSteps =
    typeof definition === 'object' &&
    definition !== null &&
    !Array.isArray(definition) &&
    Array.isArray(definition.steps)
      ? definition.steps
      : null
  if (rawSteps === null) return null

  const nodes: Node[] = rawSteps.flatMap((step, idx) => {
    const parsed = asStep(step)
    if (!parsed) return []
    return [
      {
        id: parsed.id,
        data: {
          label: parsed.name,
          status: stepStatuses[parsed.id] || 'pending'
        },
        position: { x: idx * 200, y: 100 },
        style: {
          background:
            stepStatuses[parsed.id] === 'running' ? '#3b82f6' : undefined,
          borderColor:
            stepStatuses[parsed.id] === 'completed' ? '#22c55e' : undefined
        }
      }
    ]
  })

  const rawDependencies =
    typeof definition === 'object' &&
    definition !== null &&
    !Array.isArray(definition) &&
    Array.isArray(definition.dependencies)
      ? definition.dependencies
      : []

  const edges: Edge[] = rawDependencies.flatMap((dep) => {
    const parsed = asDependency(dep)
    if (!parsed) return []
    return [
      {
        id: `${parsed.from}-${parsed.to}`,
        source: parsed.from,
        target: parsed.to,
        markerEnd: { type: MarkerType.ArrowClosed }
      }
    ]
  })

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      zoomOnScroll={false}
      panOnScroll={false}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
