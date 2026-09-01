import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { HardDrive, Trash2, Upload, RefreshCw, Folder, FolderOpen, FileText, Film, Music, ChevronRight, FolderPlus, List, GitFork, Edit3, X, Download } from 'lucide-react';

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
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Rename state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [targetItemToRename, setTargetItemToRename] = useState(null);
  const [renameInputValue, setRenameInputValue] = useState('');

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('mediaFile', file);

    try {
      await fetch(`/api/files/upload?folder=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        body: formData
      });
      await refreshAllData();
      await fetchTree();
    } catch (err) {
      console.error('[Upload Error]', err);
    } finally {
      setUploading(false);
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

  // Render Creative TUI Tree Nodes with visual branch connectors (No Play buttons)
  const renderTreeNode = (node, depth = 0, isLast = false, parentPrefix = '') => {
    const isExpanded = !!expandedFolders[node.path || node.id];
    const branchChar = isLast ? '└── ' : '├── ';
    const nextPrefix = parentPrefix + (isLast ? '    ' : '│   ');

    const depthColors = ['var(--red-ember)', 'var(--amber)', 'var(--text)', 'var(--text2)'];
    const nodeColor = depthColors[Math.min(depth, depthColors.length - 1)];

    return (
      <div key={node.id || node.path} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Node Line Row */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderBottom: '1px solid var(--border)',
            background: 'transparent',
            fontFamily: 'var(--mono)',
            fontSize: '0.78rem',
            lineHeight: '1.2'
          }}
        >
          {/* Branch ASCII visual connector + Icon & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--border2)', letterSpacing: '-1px', userSelect: 'none' }}>
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
                  gap: '6px', 
                  cursor: 'pointer',
                  color: nodeColor,
                  fontWeight: '700'
                }}
              >
                {isExpanded ? <FolderOpen size={14} style={{ color: nodeColor }} /> : <Folder size={14} style={{ color: nodeColor }} />}
                <span>{node.name}/</span>
                <span className="badge font-mono" style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--bg3)', color: 'var(--text2)' }}>
                  {node.itemCount || (node.children ? node.children.length : 0)} items
                </span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                {node.type === 'video' ? (
                  <Film size={13} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
                ) : node.type === 'audio' ? (
                  <Music size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                ) : (
                  <FileText size={13} style={{ color: 'var(--text2)', flexShrink: 0 }} />
                )}
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </span>
              </div>
            )}
          </div>

          {/* Node Right Actions: Rename, Download, Delete (No Play button in Storage) */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {node.isDir ? (
              <button 
                onClick={() => setCurrentPath(node.path)}
                className="btn-primary"
                style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                title="Enter Subdirectory"
              >
                OPEN
              </button>
            ) : (
              <>
                <span style={{ fontSize: '0.65rem', color: 'var(--text3)', marginRight: '4px' }}>
                  {formatTerminalSize(node.size)}
                </span>
                <a 
                  href={node.url} 
                  download 
                  style={{ padding: '2px 6px', fontSize: '0.65rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  className="badge font-mono"
                  title="Download File"
                >
                  <Download size={10} /> GET
                </a>
              </>
            )}

            <button 
              onClick={() => openRenameModal(node)}
              style={{ padding: '2px 4px', color: 'var(--text2)', background: 'transparent', border: 'none' }}
              title="Rename Item"
            >
              <Edit3 size={11} />
            </button>

            <button 
              onClick={() => handleDeleteItem(node.path || node.id)}
              style={{ padding: '2px 4px', color: 'var(--red-ember)', background: 'transparent', border: 'none' }}
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

  return (
    <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 14px' }}>
      {/* Directory Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={18} style={{ color: 'var(--red-ember)' }} />
          <h2 style={{ fontSize: '0.95rem', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
            128GB SD STORAGE VAULT
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setViewMode('tree')} 
              className={viewMode === 'tree' ? 'btn-primary' : ''}
              style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <GitFork size={11} /> TREE
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={viewMode === 'list' ? 'btn-primary' : ''}
              style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <List size={11} /> LIST
            </button>
          </div>

          <button 
            onClick={() => setShowFolderModal(true)}
            style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <FolderPlus size={12} style={{ color: 'var(--amber)' }} /> NEW FOLDER
          </button>

          <button 
            onClick={() => { refreshAllData(); fetchTree(); }} 
            title="Refresh Directory Tree"
            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
          >
            <RefreshCw size={12} /> REFRESH
          </button>

          <label className="btn-primary" style={{ cursor: 'pointer', padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={12} />
            {uploading ? 'UPLOADING...' : 'OFFLOAD FILE'}
            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Path Breadcrumbs Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        background: 'var(--bg2)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px',
        marginBottom: '8px',
        fontFamily: 'var(--mono)',
        fontSize: '0.75rem',
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
              <ChevronRight size={12} style={{ color: 'var(--text3)' }} />
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px' }}>
        {viewMode === 'tree' ? (
          /* CREATIVE TUI TREE VIEW */
          <div>
            <div style={{ padding: '6px 8px', borderBottom: '1px dashed var(--border2)', color: 'var(--red-ember)', fontFamily: 'var(--mono)', fontWeight: '700', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={15} /> 128GB SD Storage Vault (`/storage/${currentPath}`)
            </div>

            {treeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border2)', color: 'var(--text2)', background: 'var(--bg1)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>PERMISSIONS</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>SIZE</th>
                <th style={{ padding: '8px 10px' }}>DATE MODIFIED</th>
                <th style={{ padding: '8px 10px' }}>NAME</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentDirItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>
                    No files or folders in current directory (`/{currentPath}`).
                  </td>
                </tr>
              ) : (
                currentDirItems.map((item) => {
                  return (
                    <tr 
                      key={item.id || item.path}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        color: 'var(--text)'
                      }}
                    >
                      <td style={{ padding: '6px 10px', color: item.isDir ? 'var(--amber)' : 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {item.permissions || (item.isDir ? 'drwxr-xr-x' : '-rw-r--r--')}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatTerminalSize(item.size)}
                      </td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {formatTerminalDate(item.uploadDate)}
                      </td>
                      <td style={{ padding: '6px 10px', wordBreak: 'break-all' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.isDir ? (
                            <Folder size={14} style={{ color: 'var(--amber)' }} />
                          ) : item.type === 'video' ? (
                            <Film size={14} style={{ color: 'var(--red-ember)' }} />
                          ) : item.type === 'audio' ? (
                            <Music size={14} style={{ color: 'var(--amber)' }} />
                          ) : (
                            <FileText size={14} style={{ color: 'var(--text2)' }} />
                          )}
                          <span style={{ fontWeight: item.isDir ? '700' : 'normal' }}>
                            {item.name || item.filename}{item.isDir ? '/' : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {item.isDir ? (
                            <button 
                              onClick={() => setCurrentPath(item.path)}
                              className="btn-primary"
                              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                            >
                              OPEN
                            </button>
                          ) : (
                            <a 
                              href={item.url} 
                              download 
                              style={{ padding: '3px 6px', fontSize: '0.65rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                              className="badge font-mono"
                              title="Download File"
                            >
                              <Download size={10} /> GET
                            </a>
                          )}

                          <button 
                            onClick={() => openRenameModal(item)}
                            style={{ padding: '3px 6px', color: 'var(--text2)', background: 'transparent', border: 'none' }}
                            title="Rename"
                          >
                            <Edit3 size={12} />
                          </button>

                          <button 
                            onClick={() => handleDeleteItem(item.path || item.id)}
                            style={{ padding: '3px 6px', color: 'var(--red-ember)', background: 'transparent', border: 'none' }}
                            title="Delete File/Folder"
                          >
                            <Trash2 size={12} />
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
