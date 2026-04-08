// src/components/settings/shortcuts-tab.tsx
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  conversation: 'Conversation',
  editing: 'Editing',
  app: 'Application'
}

export function ShortcutsTab() {
  const grouped = keyboardShortcuts.reduce<
    Record<string, typeof keyboardShortcuts>
  >((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className="divide-y divide-border">
      {Object.entries(grouped).map(([cat, shortcuts]) => (
        <section key={cat} className="px-5 py-4">
          <h3 className="mb-3 text-sm font-medium">
            {categoryLabels[cat] ?? cat}
          </h3>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.keys} className="flex items-center justify-between">
                <span className="text-sm">{s.description}</span>
                <KbdGroup>
                  {s.keys.split('+').map((k) => (
                    <Kbd key={k}>
                      {k
                        .replace('Cmd', '⌘')
                        .replace('Shift', '⇧')
                        .replace('Alt', '⌥')}
                    </Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
