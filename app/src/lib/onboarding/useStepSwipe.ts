import { useMemo } from 'react';
import { PanResponder } from 'react-native';

interface StepSwipeOptions {
  onNext?: () => void;
  onPrevious?: () => void;
  disabled?: boolean;
}

const CAPTURE_DISTANCE = 24;
const NAVIGATION_DISTANCE = 72;

/** Horizontal navigation for onboarding without interfering with vertical scrolling. */
export function useStepSwipe({ onNext, onPrevious, disabled = false }: StepSwipeOptions) {
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          const horizontal = Math.abs(gesture.dx);
          const vertical = Math.abs(gesture.dy);
          const directionAvailable = gesture.dx < 0 ? Boolean(onNext) : Boolean(onPrevious);
          return !disabled && directionAvailable && horizontal > CAPTURE_DISTANCE && horizontal > vertical * 1.5;
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < NAVIGATION_DISTANCE) return;
          if (gesture.dx < 0) onNext?.();
          else onPrevious?.();
        },
      }).panHandlers,
    [disabled, onNext, onPrevious],
  );
}
