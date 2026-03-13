// src/components/conversation/message-bubble.tsx
/**
 * Individual message bubble — role-aware layout and content rendering.
 *
 * Renders markdown for assistant messages via react-markdown with syntax
 * highlighting and GitHub Flavored Markdown, plus copyable and collapsible code blocks.
 * Shows a loading indicator while the model is thinking.
 * Messages can be collapsed/expanded by clicking the chevron icon with smooth animations.
 */

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
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/invoke'

interface MessageBubbleProps {
  message: Message
  /** When true, show a streaming cursor at the end of content. */
  isStreaming?: boolean
}

// Animation variants for message content
const messageContentVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } },
  visible: { opacity: 1, height: 'auto', marginTop: 8, transition: { duration: 0.2 } }
}

// Animation variants for code blocks
const codeBlockVariants = {
  hidden: { opacity: 0, height: 0, transition: { duration: 0.2 } },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.2 } }
}

// Extracted CodeBlock component to prevent state loss on re-render
const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const [codeCollapsed, setCodeCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : 'text'
  const codeContent = String(children).replace(/\n$/, '')

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!inline && match) {
    return (
      <div className="my-2 rounded-md border border-border overflow-hidden">
        {/* Code block header */}
        <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 text-xs font-mono border-b border-border">
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setCodeCollapsed(v => !v)}
              className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
              aria-label={codeCollapsed ? 'Expand code' : 'Collapse code'}
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                animate={{ rotate: codeCollapsed ? 0 : 90 }}
                transition={{ duration: 0.15 }}
              >
                {codeCollapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </motion.div>
            </motion.button>
            <span className="text-muted-foreground">{language}</span>
          </div>
          <motion.button
            onClick={copyCode}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label="Copy code"
            whileTap={{ scale: 0.9 }}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </motion.button>
        </div>

        {/* Animated code content with height animation */}
        <AnimatePresence initial={false}>
          {!codeCollapsed && (
            <motion.div
              key="code-content"
              variants={codeBlockVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="overflow-hidden" // Crucial for height animation to clip content
            >
              <pre className="bg-muted p-3 overflow-x-auto text-xs">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Inline code
  return (
    <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
      {children}
    </code>
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

  // Streaming synthetic bubble (id = '__streaming__')
  const syntheticStreaming = message.id === '__streaming__'

  // Don't collapse user messages
  const canCollapse = isAssistant || isSystem || isTool

  const toggleCollapsed = () => setCollapsed(v => !v)

  return (
    <div className={cn('flex gap-3 max-w-full', isUser && 'flex-row-reverse')}>
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

      {/* Content bubble */}
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
          {/* Header with collapse toggle (only for collapsible messages) */}
          {canCollapse && (
            <div className="flex items-center justify-between mb-1 text-muted-foreground">
              <span className="text-xs font-medium">
                {isAssistant ? 'Assistant' : isSystem ? 'System' : 'Tool'}
              </span>
              <motion.button
                onClick={toggleCollapsed}
                className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
                aria-label={collapsed ? 'Expand message' : 'Collapse message'}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ rotate: collapsed ? 0 : 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {collapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </motion.div>
              </motion.button>
            </div>
          )}

          {/* Animated content */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="message-content"
                variants={messageContentVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="overflow-hidden" // Added for smooth height clip
              >
                {isAssistant || syntheticStreaming ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-1 prose-headings:my-1">
                    {message.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          // Use the stable component reference here
                          code: CodeBlock,
                          // Tables with styling
                          table({ children }) {
                            return (
                              <div className="overflow-x-auto my-2">
                                <table className="border-collapse border border-border text-xs">
                                  {children}
                                </table>
                              </div>
                            )
                          },
                          th({ children }) {
                            return <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">{children}</th>
                          },
                          td({ children }) {
                            return <td className="border border-border px-2 py-1">{children}</td>
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      // Empty assistant message – show a nice "Thinking..." placeholder
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
