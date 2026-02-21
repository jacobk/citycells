'use client';

import { useState, useEffect } from 'react';
import { EXEMPTION_REASONS, type ExemptionReason } from '@/lib/exemption-types';
import { formatDistance } from '@/lib/format-utils';

interface ExemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: ExemptionReason, customReason?: string) => void;
  deviationInfo?: {
    classification: string;
    borderGapMeters: number;
    detourDistanceMeters: number;
  };
}

/**
 * ExemptionModal Component
 * 
 * Modal for selecting a reason when marking a deviation as exempt.
 * See PRD 001 section 3.7 for requirements.
 * 
 * Features:
 * - Predefined reason selection
 * - "Other" option with free text input
 * - Confirmation button
 */
export default function ExemptionModal({
  isOpen,
  onClose,
  onConfirm,
  deviationInfo,
}: ExemptionModalProps) {
  const [selectedReason, setSelectedReason] = useState<ExemptionReason | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // WHY: Reset form state when modal opens - necessary for UX
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedReason(null);
       
      setCustomReason('');
       
      setError(null);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    if (selectedReason === 'Other' && !customReason.trim()) {
      setError('Please provide a reason');
      return;
    }

    onConfirm(selectedReason, selectedReason === 'Other' ? customReason.trim() : undefined);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        {/* WHY: Using design system tokens for dark mode support */}
        <div
          className="bg-card rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Mark as Exempt</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a reason why this deviation was unavoidable.
            </p>
          </div>

          {/* Deviation Info */}
          {deviationInfo && (
            <div className="px-5 py-3 bg-secondary border-b border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Deviation Details</div>
              <div className="text-sm text-foreground">
                <span className="capitalize">{deviationInfo.classification.replace('_', ' ')}</span>
                {' • '}
                {formatDistance(deviationInfo.borderGapMeters)} skipped
                {' • '}
                {formatDistance(deviationInfo.detourDistanceMeters)} detour
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div className="px-5 py-4 space-y-2">
            {EXEMPTION_REASONS.map(reason => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedReason === reason
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground hover:bg-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="exemption-reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => {
                    setSelectedReason(reason);
                    setError(null);
                  }}
                  className="w-4 h-4 text-primary border-border focus:ring-primary"
                />
                <span className="text-sm text-foreground">{reason}</span>
              </label>
            ))}

            {/* Custom reason input */}
            {selectedReason === 'Other' && (
              <div className="ml-7 mt-2">
                <input
                  type="text"
                  placeholder="Describe the reason..."
                  value={customReason}
                  onChange={e => {
                    setCustomReason(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-border flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Confirm Exemption
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
