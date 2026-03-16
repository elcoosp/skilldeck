// src/hooks/use-subagent-events.ts
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useSubagentStore } from '@/store/subagent';

export function useSubagentEvents() {
  const updateStatus = useSubagentStore((s) => s.updateSubagentStatus);
  const setResult = useSubagentStore((s) => s.setSubagentResult);
  const setError = useSubagentStore((s) => s.setSubagentError);

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenArtifact: (() => void) | undefined;

    const setup = async () => {
      unlistenStatus = await listen<{ subagentId: string; status: string }>(
        'subagent-status',
        (event) => {
          updateStatus(event.payload.subagentId, event.payload.status as any);
        }
      );
      unlistenArtifact = await listen<{ subagentId: string; artifact: any }>(
        'subagent-artifact',
        (event) => {
          // For now, treat artifacts as final result (simplified)
          setResult(event.payload.subagentId, JSON.stringify(event.payload.artifact));
        }
      );
    };

    setup();

    return () => {
      unlistenStatus?.();
      unlistenArtifact?.();
    };
  }, [updateStatus, setResult, setError]);
}
