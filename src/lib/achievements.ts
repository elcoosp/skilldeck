export const ACHIEVEMENTS = {
  firstMessage: {
    id: 'first-message',
    emoji: '📝',
    title: 'First Words',
    description: 'Sent your first message',
  },
  tenthMessage: {
    id: 'tenth-message',
    emoji: '🎯',
    title: 'Getting Chatty',
    description: 'Sent 10 messages',
  },
  firstToolApproval: {
    id: 'first-tool',
    emoji: '🔧',
    title: 'Tool Master',
    description: 'Approved your first tool call',
  },
  fiveTools: {
    id: 'five-tools',
    emoji: '🛠️',
    title: 'Power User',
    description: 'Used 5 different tools',
  },
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;
