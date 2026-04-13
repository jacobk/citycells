'use client';

import { useState } from 'react';
import type { DebugToggles } from '@/hooks/useDebugFeatureToggles';

interface DebugPanelProps {
  toggles: DebugToggles;
}

function TimingBadge({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-[10px] text-gray-500">--</span>;
  const color = ms < 100 ? 'text-green-400' : ms < 500 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-[10px] font-mono ${color}`}>{ms.toFixed(0)}ms</span>;
}

export function DebugPanel({ toggles }: DebugPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] select-none" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
      <div className="bg-black/90 text-white rounded-lg shadow-2xl overflow-hidden" style={{ width: 260 }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer border-b border-white/10"
          onClick={() => setCollapsed(c => !c)}
        >
          <span className="text-xs font-bold tracking-wide uppercase">Debug Panel</span>
          <div className="flex items-center gap-2">
            {!collapsed && (
              <>
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); toggles.enableAll(); }}
                >
                  All On
                </button>
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); toggles.resetAll(); }}
                >
                  Reset
                </button>
              </>
            )}
            <span className="text-[10px]">{collapsed ? '+' : '-'}</span>
          </div>
        </div>

        {/* Feature list */}
        {!collapsed && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 6rem)' }}>
            {toggles.features.map((feature) => {
              const isForced = feature.forced && !feature.enabled;
              return (
                <div
                  key={feature.id}
                  className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/5 ${isForced ? 'opacity-40' : ''}`}
                >
                  {/* Toggle */}
                  <button
                    className={`w-8 h-4 rounded-full flex-shrink-0 relative transition-colors ${
                      feature.enabled ? 'bg-green-500' : 'bg-gray-600'
                    } ${isForced ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !isForced && toggles.toggle(feature.id)}
                    disabled={isForced}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        feature.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium leading-tight truncate">{feature.label}</div>
                    <div className="text-[9px] text-gray-400 leading-tight truncate">{feature.description}</div>
                  </div>

                  {/* Timing */}
                  <TimingBadge ms={feature.timing} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
