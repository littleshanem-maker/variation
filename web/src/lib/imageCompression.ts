/**
 * Image compression utility for PDF generation
 * Resizes images to max 1200px width while maintaining aspect ratio
 * Converts to base64 for embedding in PDFs
 */

export async function compressImageForPdf(imageUrl: string, maxWidth: number = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // More aggressive compression on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const effectiveMaxWidth = isMobile ? Math.min(maxWidth, 800) : maxWidth;
    const quality = isMobile ? 0.65 : 0.85;
    
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      
      if (width > effectiveMaxWidth) {
        height = (height * effectiveMaxWidth) / width;
        width = effectiveMaxWidth;
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 JPEG at 85% quality
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      resolve(base64);
    };
    
    img.onerror = () => {
      console.error('Image compression failed to load:', imageUrl);
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Compress all photo URLs for PDF generation
 */
export async function compressPhotosForPdf(
  photoUrls: Record<string, string>
): Promise<Record<string, string>> {
  const compressed: Record<string, string> = {};
  let failureCount = 0;
  
  for (const [id, url] of Object.entries(photoUrls)) {
    try {
      console.log(`Compressing photo ${id}...`);
      compressed[id] = await compressImageForPdf(url);
      console.log(`✓ Photo ${id} compressed successfully`);
    } catch (error) {
      failureCount++;
      console.error(`✗ Failed to compress photo ${id}:`, error);
      // IMPORTANT: Don't fall back to original - reject instead
      throw new Error(`Photo compression failed. Photo may be too large for mobile browser.`);
    }
  }
  
  if (failureCount > 0) {
    console.warn(`${failureCount} photos failed to compress`);
  }
  
  return compressed;
}
