import { useCallback } from 'react';
import { toast } from 'sonner';
import { ACHIEVEMENTS, AchievementId } from '@/lib/achievements';

const STORAGE_KEY = 'skilldeck-achievements';

export function useAchievements() {
  const getUnlocked = useCallback((): AchievementId[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const unlock = useCallback((id: AchievementId) => {
    const unlocked = getUnlocked();
    if (!unlocked.includes(id)) {
      const updated = [...unlocked, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      const ach = ACHIEVEMENTS[id];
      toast.success(`${ach.emoji} Achievement Unlocked: ${ach.title}`, {
        description: ach.description,
        duration: 4000,
      });
    }
  }, [getUnlocked]);

  const isUnlocked = useCallback((id: AchievementId): boolean => {
    return getUnlocked().includes(id);
  }, [getUnlocked]);

  return { unlock, isUnlocked };
}
