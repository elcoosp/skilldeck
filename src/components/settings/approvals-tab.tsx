import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import { SettingsSection } from '@/components/settings/settings-section'

const APPROVAL_FIELDS: Array<{
  key: keyof ReturnType<typeof useSettingsStore.getState>['toolApprovals']
  label: string
  description: string
}> = [
  {
    key: 'autoApproveReads',
    label: 'Auto-approve file reads',
    description: 'Skip the approval dialog for read-only filesystem tools'
  },
  {
    key: 'autoApproveWrites',
    label: 'Auto-approve file writes',
    description: 'Skip approval for file creation and modification'
  },
  {
    key: 'autoApproveShell',
    label: 'Auto-approve shell commands',
    description: 'Never require approval for shell execution (⚠ dangerous)'
  },
  {
    key: 'autoApproveHttpRequests',
    label: 'Auto-approve HTTP requests',
    description: 'Skip approval for outbound HTTP tool calls'
  }
]

export function ApprovalsTab() {
  const toolApprovals = useSettingsStore((s) => s.toolApprovals)
  const setToolApprovals = useSettingsStore((s) => s.setToolApprovals)

  return (
    <div className="divide-y divide-border">
      <SettingsSection
        title="Tool Approvals"
        description="Configure which tool categories skip the approval gate. All options are off by default for maximum safety."
      >
        <div className="space-y-3 text-left">
          {APPROVAL_FIELDS.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={toolApprovals[key]}
                  onChange={(e) =>
                    setToolApprovals({ [key]: e.target.checked })
                  }
                  className="sr-only"
                />
                <div
                  className={cn(
                    'size-4 rounded border-2 flex items-center justify-center transition-colors',
                    toolApprovals[key]
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40 group-hover:border-primary/50'
                  )}
                >
                  {toolApprovals[key] && (
                    <svg
                      className="size-2.5 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 12 12"
                      role="img"
                      aria-label="Checked"
                    >
                      <title>Checked</title>
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}
