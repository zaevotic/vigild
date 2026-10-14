import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { uploadFileInChunks } from '../utils/chunkUploader';
import { HardDrive, Trash2, Upload, RefreshCw, Folder, FolderOpen, FileText, Film, Music, ChevronRight, FolderPlus, List, GitFork, Edit3, X, Download, Eye, Image as ImageIcon, Disc } from 'lucide-react';

function formatTerminalSize(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '-';
  if (bytes === 0) return '0B';
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i === 0) return `${bytes}B`;
  const val = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${val}${units[i]}`;
}

function formatTerminalDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hours}:${mins}`;
  } catch (e) {
    return dateString;
  }
}

export const StorageDirectoryPanel = () => {
  const { media, deleteMedia, refreshAllData } = useDashboard();
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'list'
  const [treeData, setTreeData] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({ 'root': true });
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Rename state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [targetItemToRename, setTargetItemToRename] = useState(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // File Preview state
  const [previewItem, setPreviewItem] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const fetchTree = async () => {
    try {
      const res = await fetch('/api/files?format=tree');
      const data = await res.json();
      if (data && data.tree) {
        setTreeData(data.tree);
      }
    } catch (e) {
      console.error('[StorageTree Error]', e);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [media]);

  // If opening preview on a text/document file, fetch its raw contents
  useEffect(() => {
    if (!previewItem) {
      setTextContent('');
      return;
    }

    const ext = (previewItem.name || previewItem.filename || '').split('.').pop()?.toLowerCase();
    const textExts = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'log', 'sh', 'py', 'yml', 'yaml', 'env'];
    
    if (textExts.includes(ext) && previewItem.url) {
      setLoadingText(true);
      fetch(previewItem.url)
        .then(res => res.text())
        .then(txt => {
          setTextContent(txt);
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent('(Unable to load file preview)');
          setLoadingText(false);
        });
    } else {
      setTextContent('');
    }
  }, [previewItem]);

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadCount(files.length);

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await uploadFileInChunks(file, {
          folder: currentPath,
          onProgress: (p) => {
            setUploadProgress({
              fileName: file.name,
              fileIndex: i + 1,
              totalFiles: files.length,
              ...p
            });
          }
        });
        successCount++;
      } catch (err) {
        console.error('[Upload Error]', err);
        showToast(`Error offloading ${file.name}: ${err.message}`);
      }
    }

    setUploadProgress(null);
    setUploading(false);
    setUploadCount(0);
    if (e.target) e.target.value = '';

    await refreshAllData();
    await fetchTree();
    if (successCount > 0) {
      showToast(`Offloaded ${successCount} file(s) to SD Card (verified)`);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await fetch('/api/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: newFolderName.trim(),
          parentPath: currentPath
        })
      });
      setNewFolderName('');
      setShowFolderModal(false);
      await refreshAllData();
      await fetchTree();
    } catch (err) {
      console.error('[Create Folder Error]', err);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!targetItemToRename || !renameInputValue.trim()) return;

    try {
      await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: targetItemToRename.path,
          newName: renameInputValue.trim()
        })
      });
      setShowRenameModal(false);
      setTargetItemToRename(null);
      setRenameInputValue('');
      if (previewItem && (previewItem.path === targetItemToRename.path)) {
        setPreviewItem(null);
      }
      await refreshAllData();
      await fetchTree();
    } catch (err) {
      console.error('[Rename Error]', err);
    }
  };

  const openRenameModal = (item) => {
    setTargetItemToRename(item);
    setRenameInputValue(item.name || item.originalname || '');
    setShowRenameModal(true);
  };

  const handleDeleteItem = async (itemPath) => {
    if (!itemPath) return;
    try {
      await fetch(`/api/files/item?path=${encodeURIComponent(itemPath)}`, {
        method: 'DELETE'
      });
      if (previewItem && previewItem.path === itemPath) {
        setPreviewItem(null);
      }
      await refreshAllData();
      await fetchTree();
    } catch (err) {
      console.error('[Delete Error]', err);
      deleteMedia(itemPath);
    }
  };

  const toggleFolderExpand = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Helper to resolve nodes at currentPath for List Mode
  const getCurrentDirectoryNodes = () => {
    if (!currentPath) return treeData;
    const parts = currentPath.split('/').filter(Boolean);

    let currentNodes = treeData;
    for (const part of parts) {
      const match = currentNodes.find(n => n.isDir && n.name === part);
      if (match && match.children) {
        currentNodes = match.children;
      } else {
        return [];
      }
    }
    return currentNodes;
  };

  // Helper to determine file category
  const getFileCategory = (item) => {
    if (item.isDir) return 'folder';
    const ext = (item.name || item.filename || '').split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext) || item.type === 'video') return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || item.type === 'audio') return 'audio';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || item.type === 'image') return 'image';
    if (['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'log', 'sh', 'py', 'yml', 'yaml'].includes(ext)) return 'text';
    return 'other';
  };

  // Render Creative TUI Tree Nodes with visual branch connectors & Preview button
  const renderTreeNode = (node, depth = 0, isLast = false, parentPrefix = '') => {
    const isExpanded = !!expandedFolders[node.path || node.id];
    const branchChar = isLast ? '└── ' : '├── ';
    const nextPrefix = parentPrefix + (isLast ? '    ' : '│   ');

    const depthColors = ['var(--red-ember)', 'var(--amber)', 'var(--text)', 'var(--text2)'];
    const nodeColor = depthColors[Math.min(depth, depthColors.length - 1)];
    const category = getFileCategory(node);

    return (
      <div key={node.id || node.path} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Node Line Row */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px',
            borderBottom: '1px solid var(--border)',
            background: 'transparent',
            fontFamily: 'var(--mono)',
            fontSize: '0.75rem',
            lineHeight: '1.2'
          }}
        >
          {/* Branch ASCII visual connector + Icon & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--border2)', letterSpacing: '-1px', userSelect: 'none', flexShrink: 0 }}>
              {parentPrefix}{branchChar}
            </span>

            {node.isDir ? (
              <button 
                onClick={() => toggleFolderExpand(node.path || node.id)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '5px', 
                  cursor: 'pointer',
                  color: nodeColor,
                  fontWeight: '700'
                }}
              >
                {isExpanded ? <FolderOpen size={13} style={{ color: nodeColor }} /> : <Folder size={13} style={{ color: nodeColor }} />}
                <span>{node.name}/</span>
                <span className="badge font-mono" style={{ fontSize: '0.55rem', padding: '1px 3px', background: 'var(--bg3)', color: 'var(--text2)' }}>
                  {node.itemCount || (node.children ? node.children.length : 0)} items
                </span>
              </button>
            ) : (
              <div 
                onClick={() => setPreviewItem(node)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', cursor: 'pointer' }}
                title="Click to preview file"
              >
                {category === 'video' ? (
                  <Film size={12} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
                ) : category === 'audio' ? (
                  <Music size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                ) : category === 'image' ? (
                  <ImageIcon size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
                ) : (
                  <FileText size={12} style={{ color: 'var(--text2)', flexShrink: 0 }} />
                )}
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </span>
              </div>
            )}
          </div>

          {/* Node Right Actions: View, Download, Rename, Delete */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {node.isDir ? (
              <button 
                onClick={() => setCurrentPath(node.path)}
                className="btn-primary"
                style={{ padding: '2px 5px', fontSize: '0.62rem' }}
                title="Enter Subdirectory"
              >
                OPEN
              </button>
            ) : (
              <>
                <span style={{ fontSize: '0.62rem', color: 'var(--text3)', marginRight: '2px' }}>
                  {formatTerminalSize(node.size)}
                </span>
                
                {/* View / Quick Look Button */}
                <button 
                  onClick={() => setPreviewItem(node)}
                  className="btn-amber"
                  style={{ padding: '2px 5px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                  title="Preview File"
                >
                  <Eye size={10} /> VIEW
                </button>

                <a 
                  href={node.url} 
                  download 
                  style={{ padding: '2px 5px', fontSize: '0.62rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                  className="badge font-mono"
                  title="Download File"
                >
                  <Download size={9} /> GET
                </a>
              </>
            )}

            <button 
              onClick={() => openRenameModal(node)}
              style={{ padding: '2px 3px', color: 'var(--text2)', background: 'transparent', border: 'none' }}
              title="Rename Item"
            >
              <Edit3 size={11} />
            </button>

            <button 
              onClick={() => handleDeleteItem(node.path || node.id)}
              style={{ padding: '2px 3px', color: 'var(--red-ember)', background: 'transparent', border: 'none' }}
              title="Delete Item"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Child Subtree Recursive Branch Rendering */}
        {node.isDir && isExpanded && node.children && node.children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map((child, idx) => 
              renderTreeNode(child, depth + 1, idx === node.children.length - 1, nextPrefix)
            )}
          </div>
        )}
      </div>
    );
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const currentDirItems = getCurrentDirectoryNodes();

  const previewCategory = previewItem ? getFileCategory(previewItem) : 'other';

  return (
    <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 12px' }}>
      {/* Directory Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0, gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HardDrive size={16} style={{ color: 'var(--red-ember)' }} />
          <h2 style={{ fontSize: '0.88rem', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
            128GB SD STORAGE VAULT
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setViewMode('tree')} 
              className={viewMode === 'tree' ? 'btn-primary' : ''}
              style={{ padding: '2px 5px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <GitFork size={10} /> TREE
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={viewMode === 'list' ? 'btn-primary' : ''}
              style={{ padding: '2px 5px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <List size={10} /> LIST
            </button>
          </div>

          <button 
            onClick={() => setShowFolderModal(true)}
            style={{ padding: '3px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <FolderPlus size={11} style={{ color: 'var(--amber)' }} /> NEW FOLDER
          </button>

          <button 
            onClick={() => { refreshAllData(); fetchTree(); }} 
            title="Refresh Directory Tree"
            style={{ padding: '3px 6px', fontSize: '0.65rem' }}
          >
            <RefreshCw size={11} /> REFRESH
          </button>

          <label className="btn-primary" style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Upload size={11} />
            {uploading ? `OFFLOADING (${uploadCount})...` : 'OFFLOAD FILES'}
            <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div style={{
          background: 'var(--amber-warm-dim)',
          border: '1px solid var(--amber-dim)',
          color: 'var(--amber)',
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.68rem',
          marginBottom: '6px',
          textAlign: 'center',
          fontFamily: 'var(--mono)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Resumable Chunked Upload Progress Banner */}
      {uploadProgress && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--amber)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          marginBottom: '6px',
          fontFamily: 'var(--mono)',
          fontSize: '0.68rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: 'var(--shadow-ember)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--amber)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
              ⚡ {uploadProgress.fileName} ({uploadProgress.fileIndex}/{uploadProgress.totalFiles})
            </span>
            <span style={{ color: 'var(--text2)', fontSize: '0.62rem' }}>
              {uploadProgress.status === 'resuming' ? 'RESUMING PIECES' : uploadProgress.status === 'assembling' ? 'ASSEMBLING' : 'OFFLOADING'} • {uploadProgress.percent}%
            </span>
          </div>
          <div style={{ width: '100%', height: '5px', background: 'var(--bg)', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{
              width: `${uploadProgress.percent}%`,
              height: '100%',
              background: 'var(--amber)',
              transition: 'width 0.2s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text3)', fontSize: '0.6rem' }}>
            <span>{formatTerminalSize(uploadProgress.transferred)} / {formatTerminalSize(uploadProgress.total)}</span>
            <span>PIECE {uploadProgress.currentChunk}/{uploadProgress.totalChunks}</span>
          </div>
        </div>
      )}

      {/* Path Breadcrumbs Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        background: 'var(--bg2)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        marginBottom: '6px',
        fontFamily: 'var(--mono)',
        fontSize: '0.72rem',
        color: 'var(--text2)',
        flexShrink: 0,
        overflowX: 'auto'
      }}>
        <button 
          onClick={() => setCurrentPath('')} 
          style={{ background: 'transparent', border: 'none', color: currentPath === '' ? 'var(--red-ember)' : 'var(--text)', fontWeight: '700', cursor: 'pointer', padding: 0 }}
        >
          ROOT
        </button>
        {pathParts.map((part, idx) => {
          const pathSub = pathParts.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={pathSub}>
              <ChevronRight size={11} style={{ color: 'var(--text3)' }} />
              <button 
                onClick={() => setCurrentPath(pathSub)}
                style={{ background: 'transparent', border: 'none', color: idx === pathParts.length - 1 ? 'var(--red-ember)' : 'var(--text)', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Viewport Content Area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
        {viewMode === 'tree' ? (
          /* CREATIVE TUI TREE VIEW */
          <div>
            <div style={{ padding: '4px 6px', borderBottom: '1px dashed var(--border2)', color: 'var(--red-ember)', fontFamily: 'var(--mono)', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <HardDrive size={13} /> 128GB SD Storage Vault (`/storage/${currentPath}`)
            </div>

            {treeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                No files or subdirectories in storage vault.
              </div>
            ) : (
              treeData.map((node, idx) => 
                renderTreeNode(node, 0, idx === treeData.length - 1, '')
              )
            )}
          </div>
        ) : (
          /* TERMINAL LS -AL LIST VIEW (Current Directory Folder & Files only with real POSIX Permissions) */
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border2)', color: 'var(--text2)', background: 'var(--bg1)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>PERMISSIONS</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>SIZE</th>
                <th style={{ padding: '6px 8px' }}>DATE MODIFIED</th>
                <th style={{ padding: '6px 8px' }}>NAME</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentDirItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>
                    No files or folders in current directory (`/{currentPath}`).
                  </td>
                </tr>
              ) : (
                currentDirItems.map((item) => {
                  const category = getFileCategory(item);

                  return (
                    <tr 
                      key={item.id || item.path}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        color: 'var(--text)'
                      }}
                    >
                      <td style={{ padding: '5px 8px', color: item.isDir ? 'var(--amber)' : 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {item.permissions || (item.isDir ? 'drwxr-xr-x' : '-rw-r--r--')}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatTerminalSize(item.size)}
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {formatTerminalDate(item.uploadDate)}
                      </td>
                      <td style={{ padding: '5px 8px', wordBreak: 'break-all' }}>
                        <div 
                          onClick={() => !item.isDir && setPreviewItem(item)}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: item.isDir ? 'default' : 'pointer' }}
                        >
                          {item.isDir ? (
                            <Folder size={13} style={{ color: 'var(--amber)' }} />
                          ) : category === 'video' ? (
                            <Film size={13} style={{ color: 'var(--red-ember)' }} />
                          ) : category === 'audio' ? (
                            <Music size={13} style={{ color: 'var(--amber)' }} />
                          ) : category === 'image' ? (
                            <ImageIcon size={13} style={{ color: '#4ade80' }} />
                          ) : (
                            <FileText size={13} style={{ color: 'var(--text2)' }} />
                          )}
                          <span style={{ fontWeight: item.isDir ? '700' : 'normal' }}>
                            {item.name || item.filename}{item.isDir ? '/' : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {item.isDir ? (
                            <button 
                              onClick={() => setCurrentPath(item.path)}
                              className="btn-primary"
                              style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                            >
                              OPEN
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => setPreviewItem(item)}
                                className="btn-amber"
                                style={{ padding: '2px 5px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                                title="View File"
                              >
                                <Eye size={9} /> VIEW
                              </button>

                              <a 
                                href={item.url} 
                                download 
                                style={{ padding: '2px 5px', fontSize: '0.62rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                                className="badge font-mono"
                                title="Download File"
                              >
                                <Download size={9} /> GET
                              </a>
                            </>
                          )}

                          <button 
                            onClick={() => openRenameModal(item)}
                            style={{ padding: '2px 3px', color: 'var(--text2)', background: 'transparent', border: 'none' }}
                            title="Rename"
                          >
                            <Edit3 size={11} />
                          </button>

                          <button 
                            onClick={() => handleDeleteItem(item.path || item.id)}
                            style={{ padding: '2px 3px', color: 'var(--red-ember)', background: 'transparent', border: 'none' }}
                            title="Delete File/Folder"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* FILE PREVIEW / QUICK LOOK MODAL (AUDIOS, VIDEOS, IMAGES, TEXT DOCUMENTS) */}
      {previewItem && (
        <div 
          onClick={() => setPreviewItem(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.9)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--bg1)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              boxShadow: 'var(--shadow-ember)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                {previewCategory === 'video' ? (
                  <Film size={15} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
                ) : previewCategory === 'audio' ? (
                  <Music size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                ) : previewCategory === 'image' ? (
                  <ImageIcon size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
                ) : (
                  <FileText size={15} style={{ color: 'var(--text2)', flexShrink: 0 }} />
                )}
                <div style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {previewItem.name || previewItem.filename}
                </div>
              </div>

              <button onClick={() => setPreviewItem(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', padding: '2px', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Metadata tags bar */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
              <span className="badge font-mono" style={{ fontSize: '0.62rem', background: 'var(--bg3)', color: 'var(--text2)' }}>
                {previewItem.permissions || '-rw-r--r--'}
              </span>
              <span className="badge font-mono" style={{ fontSize: '0.62rem', background: 'var(--bg3)', color: 'var(--text2)' }}>
                {formatTerminalSize(previewItem.size)}
              </span>
              <span className="badge font-mono" style={{ fontSize: '0.62rem', background: 'var(--bg3)', color: 'var(--text2)' }}>
                {formatTerminalDate(previewItem.uploadDate)}
              </span>
              <span className="badge badge-amber font-mono" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
                {previewCategory}
              </span>
            </div>

            {/* Viewer Content Box */}
            <div style={{ 
              flex: 1, 
              minHeight: '140px', 
              maxHeight: '56vh', 
              background: '#050303', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'auto',
              padding: previewCategory === 'text' ? '10px' : '4px',
              marginBottom: '10px'
            }}>
              {/* 1. IMAGE PREVIEW */}
              {previewCategory === 'image' && (
                <img 
                  src={previewItem.url} 
                  alt={previewItem.name} 
                  style={{ maxWidth: '100%', maxHeight: '52vh', objectFit: 'contain', borderRadius: '3px' }} 
                />
              )}

              {/* 2. VIDEO PREVIEW */}
              {previewCategory === 'video' && (
                <video 
                  src={previewItem.url} 
                  controls 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', borderRadius: '3px' }} 
                />
              )}

              {/* 3. AUDIO PREVIEW */}
              {previewCategory === 'audio' && (
                <div style={{ width: '100%', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: 'var(--red-mute)', 
                    border: '1px solid var(--red-ember)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Disc size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text)', textAlign: 'center', fontWeight: '700' }}>
                    {previewItem.name}
                  </div>
                  <audio 
                    src={previewItem.url} 
                    controls 
                    autoPlay 
                    style={{ width: '100%', height: '36px' }} 
                  />
                </div>
              )}

              {/* 4. TEXT / CODE PREVIEW */}
              {previewCategory === 'text' && (
                <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                  {loadingText ? (
                    <div style={{ color: 'var(--text3)', fontSize: '0.72rem', fontFamily: 'var(--mono)', textAlign: 'center', padding: '20px' }}>
                      Loading file contents...
                    </div>
                  ) : (
                    <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {textContent}
                    </pre>
                  )}
                </div>
              )}

              {/* 5. OTHER BINARY / ARCHIVE PREVIEW */}
              {previewCategory === 'other' && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
                  <FileText size={32} style={{ color: 'var(--text3)', marginBottom: '8px' }} />
                  <div>Binary / Non-previewable file format</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: '4px' }}>Use the Download button below to inspect on device</div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a 
                  href={previewItem.url} 
                  download 
                  className="badge font-mono" 
                  style={{ textDecoration: 'none', padding: '5px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={11} /> DOWNLOAD
                </a>
                <button 
                  onClick={() => openRenameModal(previewItem)}
                  style={{ padding: '5px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit3 size={11} /> RENAME
                </button>
                <button 
                  onClick={() => handleDeleteItem(previewItem.path || previewItem.id)}
                  style={{ padding: '5px 10px', fontSize: '0.7rem', color: 'var(--red-ember)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={11} /> DELETE
                </button>
              </div>

              <button onClick={() => setPreviewItem(null)} className="btn-primary" style={{ padding: '5px 14px', fontSize: '0.72rem' }}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW FOLDER MODAL OVERLAY */}
      {showFolderModal && (
        <div 
          onClick={() => setShowFolderModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg1)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              boxShadow: 'var(--shadow-ember)'
            }}
          >
            <div style={{ fontSize: '0.95rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', marginBottom: '12px' }}>
              CREATE NEW DIRECTORY
            </div>
            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '4px' }}>FOLDER NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. Movies, Music, Docs"
                  value={newFolderName} 
                  onChange={(e) => setNewFolderName(e.target.value)} 
                  style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFolderModal(false)} style={{ padding: '6px 12px' }}>
                  CANCEL
                </button>
                <button type="submit" className="btn-amber" style={{ padding: '6px 14px' }}>
                  CREATE FOLDER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME ITEM MODAL OVERLAY */}
      {showRenameModal && (
        <div 
          onClick={() => setShowRenameModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg1)',
              border: '1px solid var(--red-ember)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              boxShadow: 'var(--shadow-ember)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.95rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)' }}>
                RENAME ITEM
              </div>
              <button onClick={() => setShowRenameModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text2)' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '4px' }}>NEW NAME</label>
                <input 
                  type="text" 
                  value={renameInputValue} 
                  onChange={(e) => setRenameInputValue(e.target.value)} 
                  style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowRenameModal(false)} style={{ padding: '6px 12px' }}>
                  CANCEL
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 14px' }}>
                  SAVE RENAME
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
