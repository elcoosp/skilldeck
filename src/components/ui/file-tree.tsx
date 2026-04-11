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
import { motion } from "framer-motion"

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
  // Context menu actions
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
  if (element.type) {
    return element.type === "folder"
  }

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

  if (aIsFolder !== bIsFolder) {
    return aIsFolder ? -1 : 1
  }

  return treeCollator.compare(a.name, b.name)
}

const getTreeComparator = (sort: TreeSortMode) => {
  if (sort === "none") {
    return undefined
  }

  if (sort === "default") {
    return defaultTreeComparator
  }

  return sort
}

const sortTreeElements = (
  elements: TreeViewElement[],
  sort: TreeSortMode
): TreeViewElement[] => {
  const comparator = getTreeComparator(sort)

  const nextElements = elements.map((element) => {
    if (!Array.isArray(element.children)) {
      return element
    }

    return {
      ...element,
      children: sortTreeElements(element.children, sort),
    }
  })

  if (!comparator) {
    return nextElements
  }

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
          {Array.isArray(element.children)
            ? renderTreeElements(element.children, sort)
            : null}
        </Folder>
      )
    }

    return (
      <File
        key={element.id}
        value={element.id}
        isSelectable={element.isSelectable}
      >
        <span>{element.name}</span>
      </File>
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

    const selectItem = useCallback((id: string) => {
      setSelectedId(id)
    }, [])

    const handleExpand = useCallback((id: string) => {
      setEffectiveExpanded((prev) => {
        if (prev?.includes(id)) {
          return prev.filter((item) => item !== id)
        }
        return [...(prev ?? []), id]
      })
    }, [setEffectiveExpanded])

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return
        const findParent = (
          currentElement: TreeViewElement,
          currentPath: string[] = []
        ) => {
          const isSelectable = currentElement.isSelectable ?? true
          const newPath = [...currentPath, currentElement.id]
          if (currentElement.id === selectId) {
            if (isSelectable) {
              setEffectiveExpanded((prev) => mergeExpandedItems(prev, newPath))
            } else {
              if (newPath.includes(currentElement.id)) {
                newPath.pop()
                setEffectiveExpanded((prev) => mergeExpandedItems(prev, newPath))
              }
            }
            return
          }
          if (
            Array.isArray(currentElement.children) &&
            currentElement.children.length > 0
          ) {
            currentElement.children.forEach((child) => {
              findParent(child, newPath)
            })
          }
        }
        elements.forEach((element) => {
          findParent(element)
        })
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

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { direction } = useTree()

  return (
    <div
      dir={direction}
      ref={ref}
      className={cn(
        "bg-muted absolute left-[11px] h-full w-px rounded-md py-3 duration-300 ease-in-out hover:bg-slate-300 rtl:right-[11px]",
        className
      )}
      {...props}
    />
  )
})

TreeIndicator.displayName = "TreeIndicator"

type FolderProps = {
  expandedItems?: string[]
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

    const relativePath = workspaceRoot
      ? value.replace(workspaceRoot, '').replace(/^\//, '')
      : value

    const trigger = (
      <MotionTrigger
        className={cn(
          `flex items-center gap-1 rounded-md text-sm w-full px-1.5 py-0.5 my-0.5 outline-none focus:outline-none`,
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
        aria-expanded={expandedItems?.includes(value)}
        aria-selected={isSelected}
        animate={{
          backgroundColor: isFocused
            ? "rgba(59, 130, 246, 0.15)"
            : "transparent",
          color: isFocused ? "var(--primary)" : "inherit",
        }}
        transition={{ duration: 0.15 }}
      >
        {expandedItems?.includes(value)
          ? (openIcon ?? <DefaultFolderOpenedIcon width={16} height={16} />)
          : (closeIcon ?? <FolderIcon folderName={element} width={16} height={16} />)}
        <span className="truncate text-left flex-1">{element}</span>
      </MotionTrigger>
    )

    return (
      <AccordionPrimitive.Item
        ref={ref}
        {...props}
        value={value}
        className="relative h-full overflow-hidden"
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => onOpenFile?.(value)}>
              Open in Editor
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRevealInFinder?.(value)}>
              Reveal in Finder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onCopyPath?.(value)}>
              Copy Absolute Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopyRelativePath?.(relativePath)}>
              Copy Relative Path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAttachToConversation?.(value)}>
              Attach to Conversation
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative h-full overflow-hidden text-sm">
          {element && indicator && <TreeIndicator aria-hidden="true" />}
          <AccordionPrimitive.Root
            dir={direction}
            type="multiple"
            className="ml-5 flex flex-col gap-0.5 py-1 rtl:mr-5"
            value={expandedItems}
          >
            {children}
          </AccordionPrimitive.Root>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    )
  }
)

Folder.displayName = "Folder"

const MotionButton = motion.button

// Map git status letters to colors and labels
const gitStatusConfig: Record<string, { color: string; label: string }> = {
  'M': { color: 'bg-yellow-500', label: 'Modified' },
  'A': { color: 'bg-green-500', label: 'Added' },
  'D': { color: 'bg-red-500', label: 'Deleted' },
  'R': { color: 'bg-purple-500', label: 'Renamed' },
  'C': { color: 'bg-blue-500', label: 'Copied' },
  'U': { color: 'bg-red-500', label: 'Updated but unmerged' },
  '?': { color: 'bg-gray-400', label: 'Untracked' },
  '!': { color: 'bg-red-500', label: 'Ignored' },
}

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string
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
      className,
      handleSelect,
      onClick,
      isSelectable = true,
      isSelect,
      fileIcon,
      children,
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

    const fileName = value.split('/').pop() || value
    const relativePath = workspaceRoot
      ? value.replace(workspaceRoot, '').replace(/^\//, '')
      : value

    const button = (
      <MotionButton
        ref={ref}
        type="button"
        disabled={!isSelectable}
        className={cn(
          "flex w-fit items-center gap-1 rounded-md text-sm px-1.5 py-0.5 my-0.5 outline-none focus:outline-none whitespace-nowrap",
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
        <span className="truncate">{children}</span>
        {statusConfig && (
          <span
            className={cn("ml-1 h-1.5 w-1.5 rounded-full shrink-0", statusConfig.color)}
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
            Open in Editor
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRevealInFinder?.(value)}>
            Reveal in Finder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCopyPath?.(value)}>
            Copy Absolute Path
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyRelativePath?.(relativePath)}>
            Copy Relative Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAttachToConversation?.(value)}>
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
        for (const child of element.children) {
          expandTree(child)
        }
      }
    }

    for (const element of elements) {
      expandTree(element)
    }

    return [...new Set(expandedElementIds)]
  }, [])

  const closeAll = useCallback(() => {
    setExpandedItems?.([])
  }, [setExpandedItems])

  useEffect(() => {
    if (expandAll) {
      setExpandedItems?.(expendAllTree(elements))
    }
  }, [expandAll, elements, expendAllTree, setExpandedItems])

  return (
    <Button
      variant={"ghost"}
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
