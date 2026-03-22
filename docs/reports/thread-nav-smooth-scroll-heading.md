We'll implement smooth scrolling for heading clicks by extending the `scrollToMessage` method to accept a `behavior` option, then use it in `CenterPanel` to perform a smooth scroll to the message, followed by a smooth scroll to the heading.

## 1. Update `MessageThread` to accept scroll behavior in `scrollToMessage`

**File:** `src/components/conversation/message-thread.tsx`

First, modify the `MessageThreadHandle` interface to support both the old signature and the new options object:

```tsx
export interface MessageThreadHandle {
  scrollToMessage: {
    (fullIndex: number, onComplete?: () => void): void;
    (fullIndex: number, options?: { behavior?: ScrollBehavior; onComplete?: () => void }): void;
  };
  // ... other methods remain
}
```

Then, update the implementation inside the `React.useImperativeHandle` call:

```tsx
React.useImperativeHandle(
  ref,
  () => ({
    scrollToMessage: (fullIndex: number, arg?: (() => void) | { behavior?: ScrollBehavior; onComplete?: () => void }) => {
      let onComplete: (() => void) | undefined;
      let behavior: ScrollBehavior = 'auto';
      if (typeof arg === 'function') {
        onComplete = arg;
      } else if (arg) {
        behavior = arg.behavior ?? 'auto';
        onComplete = arg.onComplete;
      }

      const el = scrollRef.current;
      if (!el) return;
      const targetId = messages[fullIndex]?.id;
      if (!targetId) return;
      const fi = filteredMessagesRef.current.findIndex((m) => m.id === targetId);
      if (fi === -1) return;

      navigatorActiveRef.current = true;

      // Initial scroll with the requested behavior
      virtualizerRef.current.scrollToIndex(fi, {
        align: 'start',
        behavior: behavior,
      });

      let lastStart = -1;
      let stableTicks = 0;
      const poll = () => {
        if (!navigatorActiveRef.current) return;
        const vItems = virtualizerRef.current.getVirtualItems();
        const targetItem = vItems.find((it) => it.index === fi);
        if (!targetItem) {
          // Target not yet in view; wait
          requestAnimationFrame(poll);
          return;
        }
        const start = targetItem.start;
        if (Math.abs(start - lastStart) <= 2) {
          stableTicks++;
        } else {
          stableTicks = 0;
        }
        lastStart = start;

        if (stableTicks >= 3) {
          navigatorActiveRef.current = false;
          isProgrammaticScrollRef.current = true;
          el.scrollTop = start;
          requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false;
            if (onScrollSettledRef.current) {
              const msg = filteredMessagesRef.current[fi];
              if (msg) {
                onScrollSettledRef.current({
                  messageId: msg.id,
                  scrollTop: start,
                });
              }
            }
            if (onComplete) onComplete();
          });
        } else {
          // Wait for the scroll to stabilize – do not re‑scroll
          requestAnimationFrame(poll);
        }
      };
      requestAnimationFrame(poll);
    },
    // ... other methods unchanged
  }),
  [messages, filteredMessagesRef, virtualizerRef, scrollRef, isProgrammaticScrollRef, onScrollSettledRef]
);
```

**Note:** The repeated `scrollToIndex` call inside the polling loop has been removed. The virtualizer’s `scrollToIndex` with smooth behavior will trigger a single animation; we only wait for it to finish.

## 2. Update `CenterPanel` to use smooth scrolling

**File:** `src/components/conversation/center-panel.tsx` (the parent component)

Modify the `handleHeadingClick` callback to use the new options and to perform a smooth scroll for the heading itself:

```tsx
const handleHeadingClick = useCallback((messageIndex: number, tocIndex: number) => {
  const targetMsgId = messages[messageIndex]?.id;
  const scrollContainer = threadRef.current?.getScrollElement();
  const userMsgIndex = messageIndex - 1;
  const userMsg = messages[userMsgIndex];

  const scrollToHeading = () => {
    requestAnimationFrame(() => {
      const container = threadRef.current?.getScrollElement();
      const bubble = container?.querySelector(`[data-msg-id="${targetMsgId}"]`);
      if (!bubble || !container) return;
      const headingEls = bubble.querySelectorAll('h1,h2,h3,h4,h5,h6');
      const target = headingEls[tocIndex];
      if (!target) return;
      const elTop = target.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const newScrollTop = container.scrollTop + (elTop - containerTop - 16);
      container.scrollTo({ top: newScrollTop, behavior: 'smooth' });

      // Update navigator active index
      if (userMsg) handleVisibleUserIndexChange(userMsgIndex);
    });
  };

  const bubbleAlreadyRendered = !!scrollContainer?.querySelector(`[data-msg-id="${targetMsgId}"]`);

  if (bubbleAlreadyRendered) {
    scrollToHeading();
  } else {
    // Smooth scroll to the message first, then to the heading
    threadRef.current?.scrollToMessage(messageIndex, {
      behavior: 'smooth',
      onComplete: scrollToHeading,
    });
  }
}, [messages, handleVisibleUserIndexChange]);
```

## How it works

- **Click on a heading** → `handleHeadingClick` receives the assistant message index and the heading index.
- If the target message bubble is already in the DOM, `scrollToHeading` is called immediately, which smoothly scrolls the heading into view (centered with a 16px offset).
- If the message is not yet visible, we call `scrollToMessage` with `behavior: 'smooth'`. This scrolls the container so the message aligns to the top of the viewport. Once the scroll stabilises (after the smooth animation), the `onComplete` callback runs `scrollToHeading`, which then smoothly scrolls to the heading inside that message.
- The active user message index is updated after the heading scroll begins, ensuring the navigator highlights the correct message.

This approach avoids prop drilling by enhancing the existing ref method and keeps all scrolling logic within the components that manage the scroll container.
