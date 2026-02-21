'use client';

/**
 * ShareModal Component
 * 
 * Modal for sharing walk achievements via URL or image export.
 * Provides options to copy link, download image, or preview image.
 * 
 * WHY: Users want to share their walk achievements on social media
 * and with friends. This modal provides multiple sharing options
 * optimized for different platforms.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Technical decisions
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SharePreview, FORMAT_CONFIGS, type ShareImageFormat } from '@/components/SharePreview';
import {
  type ShareableWalkData,
  generateShareUrl,
  generateShareImage,
  downloadImage,
} from '@/lib/share';

// =============================================================================
// Types
// =============================================================================

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareableWalkData;
}

// =============================================================================
// Main Component
// =============================================================================

export default function ShareModal({ isOpen, onClose, data }: ShareModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ShareImageFormat>('square');
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Generate share URL
  const shareUrl = generateShareUrl(data);
  const isUrlLong = shareUrl.isLong;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLinkCopied(false);
      setError(null);
      setPreviewImage(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showPreview) {
          setShowPreview(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, showPreview, onClose]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.url);
      setLinkCopied(true);
      setError(null);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      console.error('[ShareModal] Failed to copy link:', e);
      setError('Failed to copy link to clipboard');
    }
  }, [shareUrl.url]);

  // Generate and download image
  const handleDownloadImage = useCallback(async () => {
    if (!previewRef.current) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateShareImage(previewRef.current, {
        format: selectedFormat,
        scale: 2,
      });

      const filename = `citycells-${data.areaName.toLowerCase().replace(/\s+/g, '-')}-${data.walkDate}`;
      downloadImage(result.blob, filename);
    } catch (e) {
      console.error('[ShareModal] Failed to generate image:', e);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFormat, data.areaName, data.walkDate]);

  // Generate and show preview
  const handleShowPreview = useCallback(async () => {
    if (!previewRef.current) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateShareImage(previewRef.current, {
        format: selectedFormat,
        scale: 1, // Lower scale for preview
      });

      setPreviewImage(result.dataUrl);
      setShowPreview(true);
    } catch (e) {
      console.error('[ShareModal] Failed to generate preview:', e);
      setError('Failed to generate preview. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFormat]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Share Walk</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.areaName} - {data.walkDate}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4">
            {/* Copy Link Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Share Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl.url}
                  readOnly
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    linkCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isUrlLong && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  This link is long ({shareUrl.length} characters). Consider using image export.
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or share as image</span>
              </div>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Image Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FORMAT_CONFIGS) as ShareImageFormat[]).map(format => (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      selectedFormat === format
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground hover:bg-secondary text-foreground'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {/* Format icon */}
                      <div className={`rounded border-2 ${
                        selectedFormat === format ? 'border-primary' : 'border-muted-foreground'
                      }`} style={{
                        width: format === 'story' ? 16 : format === 'wide' ? 32 : 24,
                        height: format === 'story' ? 28 : format === 'wide' ? 18 : 24,
                      }} />
                      <span className="capitalize">{format}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={isGenerating}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Image
                  </>
                )}
              </button>
              <button
                onClick={handleShowPreview}
                disabled={isGenerating}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Hidden Preview Component for Capture */}
          {/* WHY: forCapture=true renders at full size (1080px etc) without scale transform */}
          <div className="absolute -left-[9999px] overflow-hidden">
            <SharePreview
              ref={previewRef}
              data={data}
              format={selectedFormat}
              forCapture={true}
            />
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setShowPreview(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- WHY: previewImage is a data URL from html2canvas, next/image doesn't optimize data URLs */}
            <img
              src={previewImage}
              alt="Share preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <p className="text-center text-white/70 text-sm mt-4">
              Right-click or long-press to copy or save the image
            </p>
          </div>
        </div>
      )}
    </>
  );
}
