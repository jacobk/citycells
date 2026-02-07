/**
 * useExpandablePanel Hook
 * 
 * Manages panel state and gesture handling for the expandable bottom panel.
 * Supports touch gestures (mobile) and click-to-toggle (desktop).
 * 
 * @see docs/ADR/015-expandable-bottom-panel.md
 * @see docs/tickets/008-expandable-bottom-panel.md
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PanelState } from '@/lib/panel-state';
import { getPanelHeight, getMiniMapHeight } from '@/lib/panel-state';

interface UseExpandablePanelOptions {
  isOpen: boolean;
  onClose: () => void;
}

interface UseExpandablePanelReturn {
  state: PanelState;
  height: string;
  miniMapHeight: number;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  toggleState: () => void;
  isDragging: boolean;
}

// WHY: Velocity threshold for fast swipe detection (0.5px/ms)
const VELOCITY_THRESHOLD = 0.5;

// WHY: Minimum drag distance to distinguish click from drag (5px)
const MIN_DRAG_DISTANCE = 5;

export function useExpandablePanel({
  isOpen,
  onClose,
}: UseExpandablePanelOptions): UseExpandablePanelReturn {
  // WHY: Track internal panel state (only valid when isOpen is true)
  const [internalState, setInternalState] = useState<PanelState>('expanded');
  const [isDragging, setIsDragging] = useState(false);

  // WHY: Compute effective state - when closed, always 'closed'; when open, use internal state
  const state: PanelState = isOpen ? internalState : 'closed';

  // Drag tracking state
  const dragStateRef = useRef<{
    startY: number;
    currentY: number;
    startTime: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    isClick: boolean;
  } | null>(null);

  const isTouchDeviceRef = useRef<boolean | null>(null);
  const stateRef = useRef<PanelState>(state);
  const onCloseRef = useRef(onClose);
  const prevIsOpenRef = useRef(isOpen);

  // WHY: Detect touch device once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchDeviceRef.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  }, []);

  // WHY: Keep refs in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // WHY: Reset internal state to 'expanded' when panel opens
  // This is necessary synchronization between prop and state - when panel opens, reset to expanded
  useEffect(() => {
    if (!prevIsOpenRef.current && isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync panel state when opening
      setInternalState('expanded');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // WHY: Calculate velocity from recent touch points
  const updateVelocity = (currentY: number, currentTime: number) => {
    if (!dragStateRef.current) return;

    const { lastY, lastTime } = dragStateRef.current;
    const deltaY = currentY - lastY;
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 0) {
      dragStateRef.current.velocity = Math.abs(deltaY / deltaTime);
    }

    dragStateRef.current.lastY = currentY;
    dragStateRef.current.lastTime = currentTime;
  };

  // WHY: Determine final state based on drag delta and velocity
  const determineFinalState = useCallback((currentY: number, viewportHeight: number): PanelState => {
    if (!dragStateRef.current) return stateRef.current;

    const { startY, velocity } = dragStateRef.current;
    const currentState = stateRef.current;
    
    // WHY: Calculate drag delta (positive = dragged down, negative = dragged up)
    const deltaY = currentY - startY;
    const deltaVh = (deltaY / viewportHeight) * 100;

    // WHY: Fast swipe down closes panel regardless of position (ADR 015)
    if (velocity > VELOCITY_THRESHOLD && deltaY > 0) {
      return 'closed';
    }

    // WHY: Calculate panel top position based on current state and drag delta
    // Panel heights: collapsed=40vh, expanded=85vh, fullscreen=95vh
    // Panel top positions: collapsed=60vh from top, expanded=15vh from top, fullscreen=5vh from top
    let panelTopVh: number;
    switch (currentState) {
      case 'closed':
        panelTopVh = 100 + deltaVh; // Start at bottom (100vh from top)
        break;
      case 'collapsed':
        panelTopVh = 60 + deltaVh; // 40vh panel = 60vh from top
        break;
      case 'expanded':
        panelTopVh = 15 + deltaVh; // 85vh panel = 15vh from top
        break;
      case 'fullscreen':
        panelTopVh = 5 + deltaVh; // 95vh panel = 5vh from top
        break;
    }

    // WHY: Snap to nearest state based on panel top position thresholds
    if (panelTopVh >= 95) {
      return 'closed';
    } else if (panelTopVh >= 60) {
      return 'collapsed';
    } else if (panelTopVh >= 15) {
      return 'expanded';
    } else {
      return 'fullscreen';
    }
  }, []);

  const handleDragStart = useCallback((clientY: number) => {
    const startTime = Date.now();
    dragStateRef.current = {
      startY: clientY,
      currentY: clientY,
      startTime,
      lastY: clientY,
      lastTime: startTime,
      velocity: 0,
      isClick: true,
    };
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragStateRef.current) return;

    const currentTime = Date.now();
    dragStateRef.current.currentY = clientY;

    // WHY: Track if this is a click vs drag
    const dragDistance = Math.abs(clientY - dragStateRef.current.startY);
    if (dragDistance > MIN_DRAG_DISTANCE) {
      dragStateRef.current.isClick = false;
    }

    updateVelocity(clientY, currentTime);
  }, []);

  // WHY: Cycle through states: collapsed → expanded → full-screen → collapsed
  const toggleState = useCallback(() => {
    setInternalState(currentState => {
      switch (currentState) {
        case 'closed':
          return 'expanded';
        case 'collapsed':
          return 'expanded';
        case 'expanded':
          return 'fullscreen';
        case 'fullscreen':
          return 'collapsed';
      }
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragStateRef.current) return;

    const { currentY, isClick } = dragStateRef.current;
    const viewportHeight = window.innerHeight;
    const finalState = determineFinalState(currentY, viewportHeight);

    // WHY: Handle click-to-toggle for desktop (non-touch devices)
    if (isClick && !isTouchDeviceRef.current) {
      toggleState();
    } else {
      if (finalState === 'closed') {
        onCloseRef.current();
      } else {
        setInternalState(finalState);
      }
    }

    dragStateRef.current = null;
    setIsDragging(false);
  }, [determineFinalState, toggleState]);

  // WHY: Global event listeners for drag handling
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      // WHY: Only prevent default if dragging in drag handle area
      if (e.touches.length > 0) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragEnd, handleDragMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  }, [handleDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientY);
    }
  }, [handleDragStart]);

  return {
    state,
    height: getPanelHeight(state),
    miniMapHeight: getMiniMapHeight(state),
    handlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
    },
    toggleState,
    isDragging,
  };
}
