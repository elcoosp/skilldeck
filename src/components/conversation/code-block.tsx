// src/components/conversation/code-block.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useArtifactContent } from '@/hooks/use-artifact-content';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  artifactId: string;
  highlightedHtml: string;
  isStreaming?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, artifactId, highlightedHtml, isStreaming = false }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: rawCode, isLoading } = useArtifactContent(artifactId);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const prevHtmlRef = useRef('');
  const isUserScrolledUp = useRef(false);
  const isProgrammaticScroll = useRef(false);

  // ─── Detect user scroll within the code block ──────────────────────────────
  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) return;
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;
      const atBottom = scrollable.scrollHeight - scrollable.clientHeight - scrollable.scrollTop < 40;
      isUserScrolledUp.current = !atBottom;
    };
    scrollable.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollable.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Auto-scroll to bottom when content changes during streaming ───────────
  useEffect(() => {
    if (!isStreaming || collapsed) return;
    if (highlightedHtml === prevHtmlRef.current) return;
    prevHtmlRef.current = highlightedHtml;

    const scrollable = scrollableRef.current;
    if (!scrollable || isUserScrolledUp.current) return;

    isProgrammaticScroll.current = true;
    scrollable.scrollTop = scrollable.scrollHeight;
    requestAnimationFrame(() => {
      isProgrammaticScroll.current = false;
    });
  }, [highlightedHtml, isStreaming, collapsed]);

  // ─── Floating header: show sticky duplicate when the static header leaves the viewport ──
  useEffect(() => {
    const header = headerRef.current;
    const floating = floatingRef.current;
    if (!header || !floating || collapsed) {
      if (floating) floating.style.display = 'none';
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating header when the static header scrolls out of the viewport
        floating.style.display = entry.isIntersecting ? 'none' : 'flex';
      },
      {
        root: null, // Observe against the browser viewport
        threshold: 0,
      }
    );

    observer.observe(header);
    return () => observer.disconnect();
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed(c => !c), []);

  const copy = useCallback(async () => {
    const text = rawCode || highlightedHtml.replace(/<[^>]+>/g, '');
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [rawCode, highlightedHtml]);

  const headerContent = (
    <>
      <button type="button" onClick={toggle} className="flex items-center gap-1.5">
        <ChevronRight className={cn('size-3.5 transition-transform', !collapsed && 'rotate-90')} />
        <span>{language || 'code'}</span>
      </button>
      <button type="button" onClick={copy} disabled={isLoading}>
        {copied ? (
          <Check className="size-3.5 text-green-500" />
        ) : isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </>
  );

  return (
    <div ref={containerRef} className="my-3 rounded-lg border border-border text-xs font-mono relative">
      {/* Static header */}
      <div
        ref={headerRef}
        className={cn(
          'flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted',
          collapsed ? 'rounded-lg' : 'rounded-t-lg'
        )}
      >
        {headerContent}
      </div>

      {/* Scrollable code area */}
      <div
        ref={scrollableRef}
        className={cn(
          'transition-[max-height] thin-scrollbar relative',
          collapsed ? 'max-h-0 overflow-hidden' : 'max-h-96 overflow-auto'
        )}
      >
        {/* Sticky floating header (hidden by default, shown when static header leaves viewport) */}
        <div
          ref={floatingRef}
          className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/95 backdrop-blur-sm"
          style={{ display: 'none' }}
        >
          {headerContent}
        </div>
        <pre
          ref={preRef}
          className="p-3 m-0 mt-0 mb-0 text-xs leading-relaxed"
          style={{ whiteSpace: 'pre', fontFamily: 'inherit', color: 'var(--foreground)' }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  );
};
