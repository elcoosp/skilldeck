// src/hooks/use-workflow-definitions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';

export interface WorkflowDefinition {
  id: string;
  name: string;
  definition: any;
  created_at: string;
  updated_at: string;
}

export function useWorkflowDefinitions() {
  return useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: async (): Promise<WorkflowDefinition[]> => {
      // FIXME: commands.listWorkflowDefinitions is not typed; cast to any
      const res = await (commands as any).listWorkflowDefinitions();
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
  });
}

export function useSaveWorkflowDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, definition }: { name: string; definition: any }) => {
      const res = await (commands as any).saveWorkflowDefinition({ name, definition });
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
    },
  });
}

export function useDeleteWorkflowDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await (commands as any).deleteWorkflowDefinition(id);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
    },
  });
}
