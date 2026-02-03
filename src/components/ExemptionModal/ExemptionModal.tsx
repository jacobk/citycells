'use client';

import { useState, useEffect } from 'react';
import { EXEMPTION_REASONS, type ExemptionReason } from '@/lib/exemption-types';

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomReason('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Mark as Exempt</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select a reason why this deviation was unavoidable.
            </p>
          </div>

          {/* Deviation Info */}
          {deviationInfo && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deviation Details</div>
              <div className="text-sm text-gray-700">
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
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                  className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">{reason}</span>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-600 mt-2">{error}</div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 transition-colors"
            >
              Confirm Exemption
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
