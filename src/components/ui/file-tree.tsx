import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import {
  FileIcon,
  FolderIcon,
  DefaultFolderOpenedIcon,
} from "@react-symbols/icons/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
  ExternalLink,
  FolderOpen,
  Copy,
  Paperclip,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type TreeViewElement = {
  id: string
  name: string
  type?: "file" | "folder"
  isSelectable?: boolean
  children?: TreeViewElement[]
}

type TreeSortMode =
  | "default"
  | "none"
  | ((a: TreeViewElement, b: TreeViewElement) => number)

type TreeContextProps = {
  selectedId: string | undefined
  expandedItems: string[] | undefined
  indicator: boolean
  handleExpand: (id: string) => void
  selectItem: (id: string) => void
  setExpandedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
  direction: "rtl" | "ltr"
  gitStatusMap?: Record<string, string>
  onOpenFile?: (path: string) => void
  onRevealInFinder?: (path: string) => void
  onCopyPath?: (path: string) => void
  onCopyRelativePath?: (path: string) => void
  onAttachToConversation?: (path: string) => void
  workspaceRoot?: string
}

const TreeContext = createContext<TreeContextProps | null>(null)

const useTree = () => {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error("useTree must be used within a TreeProvider")
  }
  return context
}

type Direction = "rtl" | "ltr" | undefined

const isFolderElement = (element: TreeViewElement) => {
  if (element.type) return element.type === "folder"
  return Array.isArray(element.children)
}

const mergeExpandedItems = (
  currentItems: string[] | undefined,
  nextItems: string[]
) => [...new Set([...(currentItems ?? []), ...nextItems])]

const treeCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

const defaultTreeComparator = (a: TreeViewElement, b: TreeViewElement) => {
  const aIsFolder = isFolderElement(a)
  const bIsFolder = isFolderElement(b)
  if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1
  return treeCollator.compare(a.name, b.name)
}

const getTreeComparator = (sort: TreeSortMode) => {
  if (sort === "none") return undefined
  if (sort === "default") return defaultTreeComparator
  return sort
}

const sortTreeElements = (
  elements: TreeViewElement[],
  sort: TreeSortMode
): TreeViewElement[] => {
  const comparator = getTreeComparator(sort)
  const nextElements = elements.map((element) => ({
    ...element,
    children: element.children
      ? sortTreeElements(element.children, sort)
      : undefined,
  }))
  if (!comparator) return nextElements
  return [...nextElements].sort(comparator)
}

const renderTreeElements = (
  elements: TreeViewElement[],
  sort: TreeSortMode
): React.ReactNode =>
  sortTreeElements(elements, sort).map((element) => {
    if (isFolderElement(element)) {
      return (
        <Folder
          key={element.id}
          value={element.id}
          element={element.name}
          isSelectable={element.isSelectable}
        >
          {element.children ? renderTreeElements(element.children, sort) : null}
        </Folder>
      )
    }
    return (
      <File
        key={element.id}
        value={element.id}
        fileName={element.name}
        isSelectable={element.isSelectable}
      />
    )
  })

type TreeViewProps = {
  initialSelectedId?: string
  indicator?: boolean
  elements?: TreeViewElement[]
  initialExpandedItems?: string[]
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
  sort?: TreeSortMode
  expanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  gitStatusMap?: Record<string, string>
  onOpenFile?: (path: string) => void
  onRevealInFinder?: (path: string) => void
  onCopyPath?: (path: string) => void
  onCopyRelativePath?: (path: string) => void
  onAttachToConversation?: (path: string) => void
  workspaceRoot?: string
} & Omit<
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>,
  "defaultValue" | "onValueChange" | "type" | "value"
>

const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpandedItems,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      sort = "default",
      dir,
      expanded: controlledExpanded,
      onExpandedChange,
      gitStatusMap,
      onOpenFile,
      onRevealInFinder,
      onCopyPath,
      onCopyRelativePath,
      onAttachToConversation,
      workspaceRoot,
      ...props
    },
    ref
  ) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(
      initialSelectedId
    )
    const [expandedItems, setExpandedItems] = useState<string[] | undefined>(
      initialExpandedItems
    )

    const effectiveExpanded = controlledExpanded ?? expandedItems
    const setEffectiveExpanded = onExpandedChange ?? setExpandedItems

    const selectItem = useCallback((id: string) => setSelectedId(id), [])

    const handleExpand = useCallback(
      (id: string) => {
        setEffectiveExpanded((prev) => {
          if (prev?.includes(id)) return prev.filter((item) => item !== id)
          return [...(prev ?? []), id]
        })
      },
      [setEffectiveExpanded]
    )

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return
        const findParent = (element: TreeViewElement, path: string[] = []) => {
          const newPath = [...path, element.id]
          if (element.id === selectId) {
            if (element.isSelectable !== false) {
              setEffectiveExpanded((prev) => mergeExpandedItems(prev, newPath))
            } else if (newPath.includes(element.id)) {
              newPath.pop()
              setEffectiveExpanded((prev) => mergeExpandedItems(prev, newPath))
            }
            return
          }
          if (element.children) {
            element.children.forEach((child) => findParent(child, newPath))
          }
        }
        elements.forEach((el) => findParent(el))
      },
      [setEffectiveExpanded]
    )

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId)
      }
    }, [initialSelectedId, elements, expandSpecificTargetedElements])

    const direction = dir === "rtl" ? "rtl" : "ltr"
    const treeChildren =
      children ?? (elements ? renderTreeElements(elements, sort) : null)

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expandedItems: effectiveExpanded,
          handleExpand,
          selectItem,
          setExpandedItems: setEffectiveExpanded,
          indicator,
          openIcon,
          closeIcon,
          direction,
          gitStatusMap,
          onOpenFile,
          onRevealInFinder,
          onCopyPath,
          onCopyRelativePath,
          onAttachToConversation,
          workspaceRoot,
        }}
      >
        <div className={cn("size-full", className)}>
          <ScrollArea
            ref={ref}
            className="relative h-full"
            dir={dir as Direction}
          >
            <AccordionPrimitive.Root
              {...props}
              type="multiple"
              value={effectiveExpanded}
              onValueChange={setEffectiveExpanded}
              className="flex flex-col gap-0.5 min-w-max"
              dir={dir as Direction}
            >
              {treeChildren}
            </AccordionPrimitive.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    )
  }
)
Tree.displayName = "Tree"

// Tooltip only when text is truncated
const TruncatedSpan = ({
  text,
  className,
}: {
  text: string
  className?: string
}) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }, [text])

  const content = (
    <span ref={ref} className={className}>
      {text}
    </span>
  )

  if (!isTruncated) return content

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" align="start">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type FolderProps = {
  element: string
  isSelectable?: boolean
  isSelect?: boolean
  isFocused?: boolean
} & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>

const MotionTrigger = motion(AccordionPrimitive.Trigger)

const Folder = forwardRef<
  HTMLDivElement,
  FolderProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      className,
      element,
      value,
      isSelectable = true,
      isSelect,
      isFocused,
      children,
      ...props
    },
    ref
  ) => {
    const {
      direction,
      handleExpand,
      expandedItems,
      indicator,
      selectedId,
      selectItem,
      openIcon,
      closeIcon,
      onOpenFile,
      onRevealInFinder,
      onCopyPath,
      onCopyRelativePath,
      onAttachToConversation,
      workspaceRoot,
    } = useTree()
    const isSelected = isSelect ?? selectedId === value
    const isExpanded = expandedItems?.includes(value) ?? false

    const relativePath = workspaceRoot
      ? value.replace(workspaceRoot, "").replace(/^\//, "")
      : value

    const trigger = (
      <MotionTrigger
        className={cn(
          "flex items-center gap-1 rounded-md text-sm w-full px-1.5 py-0.5 my-0.5 outline-none focus:outline-none",
          className,
          {
            "bg-muted rounded-md": isSelected && isSelectable,
            "cursor-pointer": isSelectable,
            "cursor-not-allowed opacity-50": !isSelectable,
          }
        )}
        disabled={!isSelectable}
        onClick={() => {
          selectItem(value)
          handleExpand(value)
        }}
        data-tree-item-id={value}
        role="treeitem"
        aria-expanded={isExpanded}
        aria-selected={isSelected}
        animate={{
          backgroundColor: isFocused
            ? "rgba(59, 130, 246, 0.15)"
            : "transparent",
          color: isFocused ? "var(--primary)" : "inherit",
        }}
        transition={{ duration: 0.15 }}
      >
        {isExpanded
          ? openIcon ?? <DefaultFolderOpenedIcon width={16} height={16} />
          : closeIcon ?? <FolderIcon folderName={element} width={16} height={16} />}
        <TruncatedSpan text={element} className="truncate text-left flex-1" />
      </MotionTrigger>
    )

    return (
      <AccordionPrimitive.Item
        ref={ref}
        {...props}
        value={value}
        className="relative"
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => onOpenFile?.(value)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Editor
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRevealInFinder?.(value)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Reveal in Finder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onCopyPath?.(value)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Absolute Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopyRelativePath?.(relativePath)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Relative Path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAttachToConversation?.(value)}>
              <Paperclip className="mr-2 h-4 w-4" />
              Attach to Conversation
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Animated content with indentation bar */}
        <AccordionPrimitive.Content forceMount asChild>
          <div className="overflow-hidden">
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className={cn(
                      "pl-4",
                      indicator && "border-l border-muted"
                    )}
                  >
                    <AccordionPrimitive.Root
                      dir={direction}
                      type="multiple"
                      className="flex flex-col gap-0.5"
                      value={expandedItems}
                      onValueChange={handleExpand}
                    >
                      {children}
                    </AccordionPrimitive.Root>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    )
  }
)
Folder.displayName = "Folder"

const MotionButton = motion.button

const gitStatusConfig: Record<string, { color: string; label: string }> = {
  M: { color: "bg-yellow-500", label: "Modified" },
  A: { color: "bg-green-500", label: "Added" },
  D: { color: "bg-red-500", label: "Deleted" },
  R: { color: "bg-purple-500", label: "Renamed" },
  C: { color: "bg-blue-500", label: "Copied" },
  U: { color: "bg-red-500", label: "Updated but unmerged" },
  "?": { color: "bg-gray-400", label: "Untracked" },
  "!": { color: "bg-red-500", label: "Ignored" },
}

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string
    fileName: string
    handleSelect?: (id: string) => void
    isSelectable?: boolean
    isSelect?: boolean
    fileIcon?: React.ReactNode
    isFocused?: boolean
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(
  (
    {
      value,
      fileName,
      className,
      handleSelect,
      onClick,
      isSelectable = true,
      isSelect,
      fileIcon,
      isFocused,
      ...props
    },
    ref
  ) => {
    const {
      direction,
      selectedId,
      selectItem,
      gitStatusMap,
      onOpenFile,
      onRevealInFinder,
      onCopyPath,
      onCopyRelativePath,
      onAttachToConversation,
      workspaceRoot,
    } = useTree()
    const isSelected = isSelect ?? selectedId === value
    const gitStatus = gitStatusMap?.[value]
    const statusConfig = gitStatus ? gitStatusConfig[gitStatus] : null

    const relativePath = workspaceRoot
      ? value.replace(workspaceRoot, "").replace(/^\//, "")
      : value

    const button = (
      <MotionButton
        ref={ref}
        type="button"
        disabled={!isSelectable}
        className={cn(
          "flex w-full min-w-0 items-center gap-1 rounded-md text-sm px-1.5 py-0.5 my-0.5 outline-none focus:outline-none",
          {
            "bg-muted": isSelected && isSelectable,
          },
          isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
          direction === "rtl" ? "rtl" : "ltr",
          className
        )}
        onClick={(event) => {
          selectItem(value)
          handleSelect?.(value)
          onClick?.(event)
        }}
        data-tree-item-id={value}
        role="treeitem"
        aria-selected={isSelected}
        animate={{
          backgroundColor: isFocused
            ? "rgba(59, 130, 246, 0.15)"
            : "transparent",
          color: isFocused ? "var(--primary)" : "inherit",
        }}
        transition={{ duration: 0.15 }}
        {...props}
      >
        {fileIcon ?? <FileIcon fileName={fileName} width={16} height={16} />}
        <TruncatedSpan text={fileName} className="flex-1 truncate text-left" />
        {statusConfig && (
          <span
            className={cn(
              "ml-1 h-1.5 w-1.5 rounded-full shrink-0",
              statusConfig.color
            )}
            title={statusConfig.label}
          />
        )}
      </MotionButton>
    )

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onOpenFile?.(value)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Editor
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRevealInFinder?.(value)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Reveal in Finder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCopyPath?.(value)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Absolute Path
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyRelativePath?.(relativePath)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Relative Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAttachToConversation?.(value)}>
            <Paperclip className="mr-2 h-4 w-4" />
            Attach to Conversation
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }
)
File.displayName = "File"

const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[]
    expandAll?: boolean
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ className, elements, expandAll = false, children, ...props }, ref) => {
  const { expandedItems, setExpandedItems } = useTree()

  const expendAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandedElementIds: string[] = []
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true
      if (isSelectable && element.children && element.children.length > 0) {
        expandedElementIds.push(element.id)
        element.children.forEach(expandTree)
      }
    }
    elements.forEach(expandTree)
    return [...new Set(expandedElementIds)]
  }, [])

  const closeAll = useCallback(() => setExpandedItems?.([]), [setExpandedItems])

  useEffect(() => {
    if (expandAll) setExpandedItems?.(expendAllTree(elements))
  }, [expandAll, elements, expendAllTree, setExpandedItems])

  return (
    <Button
      variant="ghost"
      className={cn("absolute right-2 bottom-1 h-8 w-fit p-1", className)}
      onClick={
        expandedItems && expandedItems.length > 0
          ? closeAll
          : () => setExpandedItems?.(expendAllTree(elements))
      }
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  )
})
CollapseButton.displayName = "CollapseButton"

export { CollapseButton, File, Folder, Tree, type TreeViewElement }
export type { TreeSortMode }
