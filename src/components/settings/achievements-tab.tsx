import { useAchievements } from '@/hooks/use-achievements'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { CheckCircle2 } from 'lucide-react'

export function AchievementsTab() {
  const { isUnlocked } = useAchievements()
  const allAchievements = Object.entries(ACHIEVEMENTS).map(([key, value]) => ({
    id: key,
    ...value
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Achievements</h2>
      <div className="grid grid-cols-1 gap-2">
        {allAchievements.map(ach => (
          <div
            key={ach.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${isUnlocked(ach.id) ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'}`}
          >
            <span className="text-2xl">{ach.emoji}</span>
            <div>
              <p className="font-medium">{ach.title}</p>
              <p className="text-xs text-muted-foreground">{ach.description}</p>
            </div>
            {isUnlocked(ach.id) && <CheckCircle2 className="ml-auto text-green-500" />}
          </div>
        ))}
      </div>
    </div>
  )
}
