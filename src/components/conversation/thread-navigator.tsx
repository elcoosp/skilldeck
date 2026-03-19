// src/components/conversation/thread-navigator.tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageData } from '@/lib/bindings';

interface ThreadNavigatorProps {
  messages: MessageData[];
  onScrollTo: (index: number) => void;
}

export function ThreadNavigator({ messages, onScrollTo }: ThreadNavigatorProps) {
  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user');

  if (userMessages.length < 3) return null;

  return (
    <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-around z-20 pointer-events-none">
      {userMessages.map(({ msg, idx }) => (
        <Tooltip key={msg.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="size-2 rounded-full bg-muted-foreground/30 hover:bg-primary pointer-events-auto transition-colors"
              onClick={() => onScrollTo(idx)}
            />
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="max-w-[200px] truncate">{msg.content.slice(0, 80)}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
