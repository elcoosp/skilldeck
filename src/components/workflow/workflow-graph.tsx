// src/components/workflow/workflow-graph.tsx
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MarkerType
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface WorkflowGraphProps {
  definition: any
  stepStatuses: Record<string, string>
}

export function WorkflowGraph({
  definition,
  stepStatuses
}: WorkflowGraphProps) {
  if (!definition || !definition.steps) return null

  const nodes: Node[] = definition.steps.map((step: any, idx: number) => ({
    id: step.id,
    data: {
      label: step.name,
      status: stepStatuses[step.id] || 'pending'
    },
    position: { x: idx * 200, y: 100 },
    style: {
      background: stepStatuses[step.id] === 'running' ? '#3b82f6' : undefined,
      borderColor: stepStatuses[step.id] === 'completed' ? '#22c55e' : undefined
    }
  }))

  const edges: Edge[] = (definition.dependencies || []).map((dep: any) => ({
    id: `${dep.from}-${dep.to}`,
    source: dep.from,
    target: dep.to,
    markerEnd: { type: MarkerType.ArrowClosed }
  }))

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
