/**
 * Share Walk Image Generation
 * 
 * WHY: Provides client-side image generation for sharing walk achievements.
 * Uses modern-screenshot to capture the SharePreview component as an image.
 * 
 * WHY modern-screenshot over html2canvas: html2canvas doesn't support modern
 * CSS color functions like lab(), oklch() which Tailwind CSS v4 uses.
 * modern-screenshot fully supports CSS4 color spaces.
 * 
 * @see docs/ADR/023-share-walk-feature.md Section 2 - Image Generation
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 * 
 * @module share/image
 */

import { domToBlob, domToPng } from 'modern-screenshot';
import type { ShareImageFormat } from '@/components/SharePreview';

// =============================================================================
// Types
// =============================================================================

export interface ImageGenerationResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ImageGenerationOptions {
  /** Image format */
  format: ShareImageFormat;
  /** Scale factor for higher resolution (default: 2 for retina) */
  scale?: number;
  /** Background color (default: #1e1e2e) */
  backgroundColor?: string;
}

// =============================================================================
// Format Dimensions
// =============================================================================

const FORMAT_DIMENSIONS: Record<ShareImageFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
};

export { FORMAT_DIMENSIONS };

// =============================================================================
// Image Generation
// =============================================================================

/**
 * Generate a shareable image from a DOM element.
 * 
 * WHY: Uses modern-screenshot to capture React components as images.
 * This library supports modern CSS color functions (lab, oklch) that
 * Tailwind CSS v4 uses, unlike html2canvas which fails on these.
 * 
 * @param element - DOM element to capture
 * @param options - Generation options
 * @returns Promise resolving to blob and data URL
 */
export async function generateShareImage(
  element: HTMLElement,
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { format, scale = 2, backgroundColor = '#1e1e2e' } = options;
  const dimensions = FORMAT_DIMENSIONS[format];

  try {
    // Generate both blob and data URL
    // WHY: We need blob for download and dataUrl for preview
    const [blob, dataUrl] = await Promise.all([
      domToBlob(element, {
        scale,
        backgroundColor,
        width: dimensions.width,
        height: dimensions.height,
      }),
      domToPng(element, {
        scale,
        backgroundColor,
        width: dimensions.width,
        height: dimensions.height,
      }),
    ]);

    if (!blob) {
      throw new Error('Failed to generate image blob');
    }

    return {
      blob,
      dataUrl,
      width: dimensions.width * scale,
      height: dimensions.height * scale,
    };
  } catch (error) {
    console.error('[generateShareImage] Failed to generate image:', error);
    throw new Error('Failed to generate share image');
  }
}

/**
 * Download an image blob as a file.
 * 
 * @param blob - Image blob to download
 * @param filename - Filename without extension
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy image blob to clipboard (where supported).
 * 
 * WHY: Clipboard API with images requires HTTPS and secure context.
 * Returns false if not supported.
 * 
 * @param blob - Image blob to copy
 * @returns Promise resolving to success status
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    // Check if Clipboard API with images is supported
    if (!navigator.clipboard || !('write' in navigator.clipboard)) {
      console.warn('[copyImageToClipboard] Clipboard API not supported');
      return false;
    }

    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error('[copyImageToClipboard] Failed to copy image:', error);
    return false;
  }
}

/**
 * Check if copy image to clipboard is supported.
 */
export function isClipboardImageSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    'write' in navigator.clipboard &&
    typeof ClipboardItem !== 'undefined'
  );
}
