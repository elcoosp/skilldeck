import type { SlotDefinition } from '@/components/html-renderer/HtmlRenderer';
import { CodeBlock } from './code-block';
import { Heading } from './heading';

export const conversationSlots: SlotDefinition[] = [
  {
    slotName: 'code-block',
    extractProps: (el) => ({
      language: el.getAttribute('data-language') ?? 'text',
      artifactId: el.getAttribute('data-artifact-id') ?? '',
      highlightedHtml: el.innerHTML,
    }),
    component: CodeBlock,
  },
  {
    slotName: 'heading',
    extractProps: (el) => ({
      level: parseInt(el.getAttribute('data-level') ?? '1', 10),
      slug: el.getAttribute('data-slug') ?? '',
      text: el.textContent ?? '',
    }),
    component: Heading,
  },
];
