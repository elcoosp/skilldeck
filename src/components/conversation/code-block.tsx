// src/components/conversation/code-block.tsx
import React, { useState } from 'react';
import { ChevronRight, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useArtifactContent } from '@/hooks/use-artifact-content';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  artifactId: string;
  highlightedHtml: string;
}

interface CodeBlockState {
  collapsed: boolean;
  copied: boolean;
}

const INITIAL_STATE: CodeBlockState = { collapsed: false, copied: false };

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, artifactId, highlightedHtml }) => {
  const [state, setState] = useState<CodeBlockState>(INITIAL_STATE);
  const { collapsed, copied } = state;
  const { data: rawCode, isLoading, error } = useArtifactContent(artifactId);

  const toggle = () => setState({ ...state, collapsed: !collapsed });
  const copy = async () => {
    if (rawCode) {
      await navigator.clipboard.writeText(rawCode);
      setState({ ...state, copied: true });
      toast.success('Copied');
      setTimeout(() => setState(s => ({ ...s, copied: false })), 2000);
    }
  };

  return (
    <div className="my-3 rounded-lg border border-border text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted rounded-t-lg">
        <button type="button" onClick={toggle} className="flex items-center gap-1.5">
          <ChevronRight className={cn('size-3.5 transition-transform', !collapsed && 'rotate-90')} />
          <span>{language || 'code'}</span>
        </button>
        <button type="button" onClick={copy} disabled={isLoading || !rawCode}>
          {copied ? <Check className="size-3.5 text-green-500" /> : isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <div className={cn('transition-[max-height]', collapsed ? 'max-h-0 overflow-hidden' : 'max-h-96 overflow-visible')}>
        <pre
          className="overflow-x-auto thin-scrollbar p-3 m-0 mt-0 mb-0"
          style={{
            whiteSpace: 'pre',
            fontFamily: 'inherit',
            maxHeight: 'inherit',
            overflowY: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  );
};
