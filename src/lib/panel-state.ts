/**
 * Panel State Configuration
 * 
 * Defines the four states for the expandable bottom panel and their
 * associated height configurations.
 * 
 * @see docs/ADR/015-expandable-bottom-panel.md
 * @see docs/tickets/008-expandable-bottom-panel.md
 */

export type PanelState = 'closed' | 'collapsed' | 'expanded' | 'fullscreen';

export interface PanelStateConfig {
  state: PanelState;
  height: string; // CSS value (e.g., '40vh', '85vh', '95vh')
  miniMapHeight: number; // pixels
}

// WHY: Height values match ADR 015 specifications
export const COLLAPSED_HEIGHT = '40vh';
export const EXPANDED_HEIGHT = '85vh';
export const FULLSCREEN_HEIGHT = '95vh';

// WHY: Mini-map heights optimized for each panel state (ADR 015)
const MINI_MAP_HEIGHTS: Record<PanelState, number> = {
  closed: 0,
  collapsed: 150,
  expanded: 200,
  fullscreen: 400,
};

/**
 * Get the CSS height value for a given panel state.
 * 
 * @param state - The panel state
 * @returns CSS height value (e.g., '40vh', '85vh', '95vh')
 */
export function getPanelHeight(state: PanelState): string {
  switch (state) {
    case 'closed':
      return '0';
    case 'collapsed':
      return COLLAPSED_HEIGHT;
    case 'expanded':
      return EXPANDED_HEIGHT;
    case 'fullscreen':
      return FULLSCREEN_HEIGHT;
  }
}

/**
 * Get the mini-map height in pixels for a given panel state.
 * 
 * @param state - The panel state
 * @returns Height in pixels
 */
export function getMiniMapHeight(state: PanelState): number {
  return MINI_MAP_HEIGHTS[state];
}
