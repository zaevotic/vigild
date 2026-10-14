// Chunked Resumable Upload Engine (Torrent-Style Piece Tracking)
// Slices files into chunks, checks existing server chunks, uploads missing pieces, and verifies assembly.

export const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk size

/**
 * Deterministically generates an upload ID based on file metadata.
 * Enables automatic resume if the upload is interrupted or restarted.
 */
export function generateUploadId(file) {
  const str = `${file.name}-${file.size}-${file.lastModified}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
  return `${cleanName}_${Math.abs(hash)}_${file.size}`;
}

/**
 * Uploads a file in chunks with piece tracking, resume support, and progress reporting.
 *
 * @param {File} file - The file to upload
 * @param {Object} options
 * @param {string} options.folder - Destination subfolder inside SD storage
 * @param {function} options.onProgress - Callback with { transferred, total, percent, currentChunk, totalChunks, status }
 * @param {number} options.maxRetries - Maximum retry attempts per failed chunk
 * @param {number} options.chunkSize - Byte size per slice (default 2MB)
 */
export async function uploadFileInChunks(file, options = {}) {
  const {
    folder = '',
    onProgress = () => {},
    maxRetries = 3,
    chunkSize = CHUNK_SIZE
  } = options;

  const uploadId = generateUploadId(file);
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  onProgress({
    transferred: 0,
    total: file.size,
    percent: 0,
    currentChunk: 0,
    totalChunks,
    status: 'checking'
  });

  // 1. Query server for existing pieces
  let uploadedChunks = [];
  try {
    const statusRes = await fetch(`/api/files/upload/status?uploadId=${encodeURIComponent(uploadId)}`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      uploadedChunks = Array.isArray(statusData.uploadedChunks) ? statusData.uploadedChunks : [];
    }
  } catch (e) {
    console.warn('[ChunkUploader] Status check failed, starting fresh transfer:', e);
  }

  // Calculate transferred bytes from existing chunks
  let transferredBytes = 0;
  uploadedChunks.forEach((idx) => {
    const start = idx * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    transferredBytes += (end - start);
  });

  const isResuming = uploadedChunks.length > 0 && uploadedChunks.length < totalChunks;

  onProgress({
    transferred: transferredBytes,
    total: file.size,
    percent: file.size > 0 ? Math.round((transferredBytes / file.size) * 100) : 0,
    currentChunk: uploadedChunks.length,
    totalChunks,
    status: isResuming ? 'resuming' : 'uploading'
  });

  // 2. Upload missing chunks
  for (let i = 0; i < totalChunks; i++) {
    if (uploadedChunks.includes(i)) {
      continue;
    }

    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBlob = file.slice(start, end);

    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('chunk', chunkBlob, `chunk_${i}.part`);

        const chunkUrl = `/api/files/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${i}&totalChunks=${totalChunks}`;
        const chunkRes = await fetch(chunkUrl, {
          method: 'POST',
          body: formData
        });

        if (!chunkRes.ok) {
          throw new Error(`Chunk ${i} rejected with status ${chunkRes.status}`);
        }

        success = true;
        transferredBytes += (end - start);
        const percent = file.size > 0 ? Math.min(99, Math.round((transferredBytes / file.size) * 100)) : 99;

        onProgress({
          transferred: transferredBytes,
          total: file.size,
          percent,
          currentChunk: i + 1,
          totalChunks,
          status: 'uploading'
        });
      } catch (err) {
        console.warn(`[ChunkUploader] Chunk ${i} attempt ${attempts}/${maxRetries} failed:`, err);
        if (attempts >= maxRetries) {
          throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks}: ${err.message}`);
        }
        // Exponential backoff retry
        await new Promise((r) => setTimeout(r, 800 * attempts));
      }
    }
  }

  // 3. Request server to assemble pieces into final file
  onProgress({
    transferred: file.size,
    total: file.size,
    percent: 99,
    currentChunk: totalChunks,
    totalChunks,
    status: 'assembling'
  });

  const assembleRes = await fetch('/api/files/upload/assemble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      filename: file.name,
      totalChunks,
      folder,
      size: file.size,
      mimetype: file.type
    })
  });

  if (!assembleRes.ok) {
    const errorData = await assembleRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to assemble file pieces');
  }

  const assembleData = await assembleRes.json();

  onProgress({
    transferred: file.size,
    total: file.size,
    percent: 100,
    currentChunk: totalChunks,
    totalChunks,
    status: 'completed'
  });

  return assembleData;
}
