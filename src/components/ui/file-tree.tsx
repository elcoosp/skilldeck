// src/components/ui/file-tree.tsx
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
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
import { useDraggable } from '@dnd-kit/react'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

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
  if (!context) throw new Error("useTree must be used within a TreeProvider")
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
    const [internalExpanded, setInternalExpanded] = useState<string[] | undefined>(
      initialExpandedItems
    )

    const effectiveExpanded = controlledExpanded ?? internalExpanded
    const setEffectiveExpanded = onExpandedChange ?? setInternalExpanded

    const selectItem = useCallback((id: string) => setSelectedId(id), [])

    const handleValueChange = useCallback(
      (newExpanded: string[]) => {
        setEffectiveExpanded(newExpanded)
      },
      [setEffectiveExpanded]
    )

    const handleExpand = useCallback(
      (id: string) => {
        const isExpanded = effectiveExpanded?.includes(id) ?? false
        const newExpanded = isExpanded
          ? effectiveExpanded?.filter((item) => item !== id) ?? []
          : [...(effectiveExpanded ?? []), id]
        handleValueChange(newExpanded)
      },
      [effectiveExpanded, handleValueChange]
    )

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return
        const findParent = (element: TreeViewElement, path: string[] = []) => {
          const newPath = [...path, element.id]
          if (element.id === selectId) {
            if (element.isSelectable !== false) {
              const newExpanded = mergeExpandedItems(effectiveExpanded, newPath)
              handleValueChange(newExpanded)
            } else if (newPath.includes(element.id)) {
              newPath.pop()
              const newExpanded = mergeExpandedItems(effectiveExpanded, newPath)
              handleValueChange(newExpanded)
            }
            return
          }
          if (element.children) {
            element.children.forEach((child) => findParent(child, newPath))
          }
        }
        elements.forEach((el) => findParent(el))
      },
      [effectiveExpanded, handleValueChange]
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
        <div className={cn("size-full overflow-hidden", className)}>
          <div
            ref={ref}
            className="relative h-full w-full overflow-auto min-w-0 thin-scrollbar"
          >
            <div className="w-full min-w-0">
              <AccordionPrimitive.Root
                {...props}
                type="multiple"
                value={effectiveExpanded}
                onValueChange={handleValueChange}
                className="flex flex-col w-full"
                dir={dir as Direction}
              >
                {treeChildren}
              </AccordionPrimitive.Root>
            </div>
          </div>
        </div>
      </TreeContext.Provider>
    )
  }
)
Tree.displayName = "Tree"

type FolderProps = {
  element: string
  isSelectable?: boolean
  isSelect?: boolean
  isFocused?: boolean
} & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>

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
      <AccordionPrimitive.Trigger
        className={cn(
          "flex items-center gap-1 rounded-md text-sm w-full min-w-0 px-1.5 py-0.5 my-0.5 outline-none focus:outline-none transition-colors duration-150",
          className,
          {
            "bg-muted rounded-md": isSelected && isSelectable,
            "cursor-pointer": isSelectable,
            "cursor-not-allowed opacity-50": !isSelectable,
            "bg-blue-500/15 text-primary": isFocused,
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
      >
        {isExpanded
          ? openIcon ?? <DefaultFolderOpenedIcon width={16} height={16} />
          : closeIcon ?? <FolderIcon folderName={element} width={16} height={16} />}
        <span
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left"
          title={element}
        >
          {element}
        </span>
      </AccordionPrimitive.Trigger>
    )

    return (
      <AccordionPrimitive.Item
        ref={ref}
        {...props}
        value={value}
        className="relative w-full"
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

        <AccordionPrimitive.Content forceMount asChild>
          <div className="overflow-hidden w-full">
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div
                    className={cn("pl-4 w-full", indicator && "border-l border-muted")}
                  >
                    <AccordionPrimitive.Root
                      dir={direction}
                      type="multiple"
                      className="flex flex-col w-full"
                      value={expandedItems}
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
    } = useTree();

    const isSelected = isSelect ?? selectedId === value;
    const gitStatus = gitStatusMap?.[value];
    const statusConfig = gitStatus ? gitStatusConfig[gitStatus] : null;
    const relativePath = workspaceRoot
      ? value.replace(workspaceRoot, '').replace(/^\//, '')
      : value;

    const { ref: draggableRef, isDragging } = useDraggable({
      id: value,
      data: { type: 'file', path: value, name: fileName },
    });

    const combinedRef = useCallback(
      (node: HTMLButtonElement | null) => {
        draggableRef(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [draggableRef, ref]
    );

    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
    };

    return (
      <>
        <button
          ref={combinedRef}
          type="button"
          disabled={!isSelectable}
          className={cn(
            // 添加 select-none 防止文本选择干扰拖拽
            'select-none flex w-full items-center gap-1 rounded-md text-sm px-1.5 py-0.5 my-0.5 outline-none focus:outline-none transition-colors duration-150',
            {
              'bg-muted': isSelected && isSelectable,
              'cursor-grab': isSelectable && !isDragging,
              'cursor-grabbing': isSelectable && isDragging,
              'cursor-not-allowed opacity-50': !isSelectable,
              'opacity-50': isDragging,
              'bg-blue-500/15 text-primary': isFocused && isSelectable,
              // Git 状态边框（可选）
              'border-l-4 border-yellow-500': statusConfig?.color === 'bg-yellow-500',
              'border-l-4 border-green-500': statusConfig?.color === 'bg-green-500',
              'border-l-4 border-red-500': statusConfig?.color === 'bg-red-500',
              'border-l-4 border-purple-500': statusConfig?.color === 'bg-purple-500',
              'border-l-4 border-blue-500': statusConfig?.color === 'bg-blue-500',
              'border-l-4 border-gray-400': statusConfig?.color === 'bg-gray-400',
            },
            direction === 'rtl' ? 'rtl' : 'ltr',
            className
          )}
          onClick={(event) => {
            if (!isSelectable) return;
            selectItem(value);
            handleSelect?.(value);
            onClick?.(event);
          }}
          onContextMenu={handleContextMenu}
          data-tree-item-id={value}
          role="treeitem"
          aria-selected={isSelected}
          {...props}
        >
          {/* 图标容器：强制穿透 */}
          <span
            style={{ pointerEvents: 'none' }}
            className="inline-flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            {fileIcon ?? <FileIcon fileName={fileName} width={16} height={16} />}
          </span>
          {/* 文件名：同样强制穿透，让按钮处理所有事件 */}
          <span
            style={{ pointerEvents: 'none' }}
            className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left"
          >
            {fileName}
          </span>
          {/* Git 状态点 */}
          {statusConfig && (
            <span
              style={{ pointerEvents: 'none' }}
              className={cn('ml-1 h-1.5 w-1.5 rounded-full shrink-0', statusConfig.color)}
              aria-hidden="true"
            />
          )}
        </button>

        {/* 右键菜单（Portal 方式） */}
        <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <ContextMenuContent
            className="w-48"
            style={{ position: 'fixed', left: menuPos.x, top: menuPos.y }}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <ContextMenuItem onClick={() => { setMenuOpen(false); onOpenFile?.(value); }}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open in Editor
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setMenuOpen(false); onRevealInFinder?.(value); }}>
              <FolderOpen className="mr-2 h-4 w-4" /> Reveal in Finder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => { setMenuOpen(false); onCopyPath?.(value); }}>
              <Copy className="mr-2 h-4 w-4" /> Copy Absolute Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setMenuOpen(false); onCopyRelativePath?.(relativePath); }}>
              <Copy className="mr-2 h-4 w-4" /> Copy Relative Path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => { setMenuOpen(false); onAttachToConversation?.(value); }}>
              <Paperclip className="mr-2 h-4 w-4" /> Attach to Conversation
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </>
    );
  }
);
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
