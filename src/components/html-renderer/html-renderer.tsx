import React, { useRef, useLayoutEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';

export interface SlotDefinition<P = Record<string, string>> {
  slotName: string;
  extractProps: (el: Element) => P;
  component: React.ComponentType<P & { slotId: string }>;
}

export interface HtmlMessage {
  stableHtml: string;
  draftHtml: string | null;
  slotCount: number;
}

export interface HtmlRendererProps {
  message: HtmlMessage;
  slots: SlotDefinition[];
  className?: string;
}

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ message, slots, className }) => {
  const stableRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());
  const lastStableHtmlRef = useRef<string>('');

  const mountSlots = useCallback((container: HTMLElement) => {
    for (const slotDef of slots) {
      const elements = container.querySelectorAll<HTMLElement>(`[data-slot="${slotDef.slotName}"]`);
      for (const el of elements) {
        const slotId = el.getAttribute('data-slot-id') ?? '';
        const existingRoot = rootsRef.current.get(slotId);
        const props = slotDef.extractProps(el);
        const Component = slotDef.component as React.ComponentType<Record<string, unknown>>;

        if (existingRoot) {
          existingRoot.render(<Component {...props} slotId={slotId} />);
        } else {
          el.innerHTML = '';
          const root = createRoot(el);
          root.render(<Component {...props} slotId={slotId} />);
          rootsRef.current.set(slotId, root);
        }
      }
    }
  }, [slots]);

  const pruneRoots = useCallback((container: HTMLElement) => {
    for (const [slotId, root] of rootsRef.current) {
      if (!container.querySelector(`[data-slot-id="${slotId}"]`)) {
        root.unmount();
        rootsRef.current.delete(slotId);
      }
    }
  }, []);

  useLayoutEffect(() => {
    const stable = stableRef.current;
    if (!stable) return;

    if (message.stableHtml !== lastStableHtmlRef.current) {
      stable.innerHTML = message.stableHtml;
      lastStableHtmlRef.current = message.stableHtml;
      mountSlots(stable);
    }
  }, [message.stableHtml, mountSlots]);

  useLayoutEffect(() => {
    const draft = draftRef.current;
    if (!draft) return;
    pruneRoots(draft);
    draft.innerHTML = message.draftHtml ?? '';
    if (message.draftHtml) {
      mountSlots(draft);
    }
  }, [message.draftHtml, mountSlots, pruneRoots]);

  useLayoutEffect(() => {
    return () => {
      for (const root of rootsRef.current.values()) {
        root.unmount();
      }
      rootsRef.current.clear();
    };
  }, []);

  return (
    <div className={className}>
      <div ref={stableRef} />
      <div ref={draftRef} />
    </div>
  );
};
