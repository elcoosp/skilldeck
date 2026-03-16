// src/components/conversation/message-bubble.tsx
import { useState } from 'react'
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  User,
  Wrench
} from 'lucide-react'
import { motion } from 'framer-motion'
import { MarkdownHooks } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeShiki from '@shikijs/rehype'
import { cn } from '@/lib/utils'
import type { MessageData } from '@/lib/bindings'   // Fixed import

interface MessageBubbleProps {
  message: MessageData   // Changed from Message to MessageData
  isStreaming?: boolean
}

// Intercept <pre> from Shiki — never touch <code> or whitespace
const CodePre = ({ children, ...props }: any) => {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  const extractText = (node: any): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node?.props?.children) return extractText(node.props.children)
    return ''
  }

  const language = props['data-language'] ?? 'code'

  const copy = async () => {
    await navigator.clipboard.writeText(
      extractText(children).replace(/\n$/, '')
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-lg border border-border flex flex-col text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted rounded-t-lg">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <motion.div
            animate={{ rotate: collapsed ? 0 : 90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="size-3.5" />
          </motion.div>
          <span>{language}</span>
        </button>
        <button
          onClick={copy}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>

      <div
        className="grid transition-all duration-200"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden rounded-b-lg">
          <div
            className="overflow-auto max-h-96 transition-opacity duration-200 [&>pre]:!m-0 [&>pre]:!rounded-none [&>pre]:!border-none [&>pre]:p-3 [&>pre]:text-xs [&>pre]:leading-relaxed"
            style={{ opacity: collapsed ? 0 : 1 }}
          >
            <pre {...props}>{children}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MessageBubble({
  message,
  isStreaming = false
}: MessageBubbleProps) {
  const [collapsed, setCollapsed] = useState(false)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'
  const syntheticStreaming = message.id === '__streaming__'

  const canCollapse =
    (isAssistant || isSystem || isTool) && !isStreaming && !syntheticStreaming
  const isCollapsed = collapsed && canCollapse

  return (
    <motion.div
      className={cn('flex gap-3 max-w-full', isUser && 'flex-row-reverse')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 size-7 rounded-full flex items-center justify-center mt-0.5',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-destructive/20 text-destructive'
              : isTool
                ? 'bg-muted text-muted-foreground'
                : 'bg-muted text-foreground'
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : isSystem ? (
          <AlertCircle className="size-3.5" />
        ) : isTool ? (
          <Wrench className="size-3.5" />
        ) : (
          <Bot className="size-3.5" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn('relative max-w-[78%] min-w-0', isUser && 'text-right')}
      >
        <div
          className={cn(
            'inline-block px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : isTool
                ? 'bg-muted/70 font-mono text-xs w-full rounded-tl-sm'
                : 'bg-muted rounded-tl-sm'
          )}
        >
          {/* Collapse header — only shown once streaming is done */}
          {canCollapse && (
            <div className="flex items-center justify-between mb-1 text-muted-foreground">
              <span className="text-xs font-medium">
                {isAssistant ? 'Assistant' : isSystem ? 'System' : 'Tool'}
              </span>
              <motion.button
                onClick={() => setCollapsed((v) => !v)}
                className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors ml-2"
                aria-label={isCollapsed ? 'Expand message' : 'Collapse message'}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ rotate: isCollapsed ? 0 : 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </motion.div>
              </motion.button>
            </div>
          )}

          <div
            className="grid transition-all duration-200"
            style={{ gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
          >
            <div
              className="overflow-hidden transition-opacity duration-200"
              style={{ opacity: isCollapsed ? 0 : 1 }}
            >
              {isAssistant || syntheticStreaming ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-pre:my-0">
                  {message.content ? (
                    <MarkdownHooks
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[
                        [
                          rehypeShiki,
                          {
                            themes: {
                              light: 'vitesse-light',
                              dark: 'vitesse-dark'
                            },
                            useBackground: false
                          }
                        ]
                      ]}
                      components={{
                        pre: CodePre,
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="border-collapse border border-border text-xs">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-border px-2 py-1">
                            {children}
                          </td>
                        )
                      }}
                    >
                      {message.content}
                    </MarkdownHooks>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                      Thinking...
                    </span>
                  )}
                  {(isStreaming || syntheticStreaming) && message.content && (
                    <span className="inline-block ml-0.5 align-middle">
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    </span>
                  )}
                </div>
              ) : (
                <span className="whitespace-pre-wrap break-words">
                  {message.content}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
