import {
  createFileRoute,
  Outlet,
  useLocation,
  useRouter
} from '@tanstack/react-router'
import {
  AlertTriangle,
  Bell,
  Folder,
  GitBranch,
  Globe,
  Key,
  Keyboard,
  Layers,
  Share2,
  ShieldCheck,
  Sun,
  Trophy,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_TABS = [
  { id: 'api-keys', label: 'API Keys', Icon: Key },
  { id: 'profiles', label: 'Profiles', Icon: Layers },
  { id: 'approvals', label: 'Tool Approvals', Icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', Icon: Sun },
  { id: 'preferences', label: 'Preferences', Icon: Bell },
  { id: 'platform', label: 'Platform', Icon: Globe },
  { id: 'referral', label: 'Refer & Earn', Icon: Share2 },
  { id: 'lint', label: 'Lint Rules', Icon: AlertTriangle },
  { id: 'sources', label: 'Skill Sources', Icon: Folder },
  { id: 'shortcuts', label: 'Shortcuts', Icon: Keyboard },
  { id: 'achievements', label: 'Achievements', Icon: Trophy },
  { id: 'workflows', label: 'Workflows', Icon: GitBranch }
] as const

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout
})

function SettingsLayout() {
  const router = useRouter()
  const location = useLocation()
  const activeTab = location.pathname.split('/').pop() ?? 'api-keys'

  const handleClose = () => {
    router.history.back()
  }

  const handleTabChange = (tabId: string) => {
    router.navigate({
      to: `/settings/${tabId}`,
      replace: true
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="relative w-full max-w-2xl h-[520px] rounded-xl border border-border bg-background shadow-2xl flex overflow-hidden">
        {/* Close button - absolutely positioned, takes no layout space */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Sidebar navigation - no close tab here anymore */}
        <nav className="w-44 shrink-0 border-r border-border bg-muted/30 p-2 flex flex-col gap-0.5 overflow-y-auto">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Settings
          </p>
          {SETTINGS_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content area - no extra padding needed because button floats above */}
        <div className="flex-1 overflow-y-auto text-left thin-scrollbar">
          <div className="mx-auto w-full max-w-2xl">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
