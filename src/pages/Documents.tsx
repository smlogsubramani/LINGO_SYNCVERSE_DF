// Documents.tsx
import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  FolderPlus, 
  Upload,
  Eye, 
  Trash2, 
  Folder, 
  File, 
  Search,
  Download, 
  X,
  Users,
  Brain,
  Bot
} from 'lucide-react';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  where,
  Timestamp 
} from 'firebase/firestore';
import { storage, db } from '../firebase';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  lastModified?: string;
  size?: string;
  downloadURL?: string;
  firebasePath?: string;
  summary?: string;
  parentFolderId?: string | null;
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  teamMembers: Array<{
    name: string;
    allocatedHours: number;
  }>;
  totalEfforts: number;
  remainingHours: number;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  manager: string;
  createdAt: string;
}

interface ModalProps {
  isOpen: boolean;   
  onClose: () => void;   
  onSubmit: (value: string) => void;   
  title: string;   
  initialValue?: string;   
  type: 'folder' | 'file';
}

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  onDeleteFile: (file: FileNode) => void;
}

interface DocumentsProps {
  initialFiles?: FileNode[];
}

// File Preview Modal Component
const FilePreviewModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  file: FileNode | null 
}> = ({ isOpen, onClose, file }) => {
  if (!isOpen || !file) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '90vw',
        maxHeight: '90vh',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Eye size={20} />
            Preview: {file.name}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={24} />
          </button>
        </div>
        
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          {file.downloadURL ? (
            file.name.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={file.downloadURL}
                style={{
                  width: '100%',
                  height: '600px',
                  border: 'none',
                  borderRadius: '8px',
                }}
                title={file.name}
              />
            ) : file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
              <img
                src={file.downloadURL}
                alt={file.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '600px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
              />
            ) : (
              <div style={{
                padding: '24px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
              }}>
                <File size={48} color="#64748b" style={{ marginBottom: '16px' }} />
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Preview not available for this file type.
                  <br />
                  <a 
                    href={file.downloadURL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                  >
                    Download file
                  </a> to view content.
                </p>
              </div>
            )
          ) : (
            <div style={{
              padding: '24px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}>
              <File size={48} color="#64748b" style={{ marginBottom: '16px' }} />
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                No preview available for this file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// FileTreeItem Component with Delete functionality
const FileTreeItem: React.FC<FileTreeItemProps> = ({ 
  node, 
  level = 0, 
  selectedFile, 
  onSelectFile, 
  onDeleteFile 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(!expanded);
    }
    onSelectFile(node);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFile(node);
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          paddingLeft: `${level * 24 + 16}px`,
          cursor: 'pointer',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '500',
          color: selectedFile?.id === node.id ? '#ffffff' : '#64748b',
          backgroundColor: selectedFile?.id === node.id ? '#3b82f6' : 'transparent',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          margin: '2px 4px',
          position: 'relative',
          border: selectedFile?.id === node.id ? 'none' : '1px solid transparent',
        }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {node.type === 'folder' ? (
          <>
            <div style={{ 
              opacity: expanded ? 1 : 0.7,
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s ease'
            }}>
              <ChevronDown size={16} />
            </div>
            <Folder size={18} color={selectedFile?.id === node.id ? '#ffffff' : '#f59e0b'} />
          </>
        ) : (
          <>
            <div style={{ width: '16px' }} />
            <File size={18} color={selectedFile?.id === node.id ? '#ffffff' : '#64748b'} />
          </>
        )}
        <span style={{ 
          flex: 1,
          fontWeight: selectedFile?.id === node.id ? '600' : '500'
        }}>
          {node.name}
        </span>
        
        {(isHovered || selectedFile?.id === node.id) && !showDeleteConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trash2 
              size={14} 
              color={selectedFile?.id === node.id ? '#ffffff' : '#ef4444'}
              style={{ opacity: 0.7, cursor: 'pointer' }}
              onClick={handleDeleteClick}
            />
          </div>
        )}

        {showDeleteConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: selectedFile?.id === node.id ? '#ffffff' : '#ef4444' }}>
              Delete?
            </span>
            <button
              onClick={confirmDelete}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              onClick={cancelDelete}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        )}
      </div>
      {expanded && node.children?.map(child => (
        <FileTreeItem
          key={child.id}
          node={child}
          level={level + 1}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </div>
  );
};

// Modal Component
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onSubmit, title, initialValue = '', type }) => {
  const [value, setValue] = useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px',
            }}>
              {type === 'folder' ? 'Folder Name' : 'Name'}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: 'white',
                fontSize: '14px',
                fontWeight: '500',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            />
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: value.trim() ? '#3b82f6' : '#94a3b8',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: value.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Enhanced Chat Interface Component
const ChatInterface: React.FC<{ 
  selectedFile: FileNode | null;
  onGenerateSummary: (file: FileNode) => void;
  isSummarizing: boolean;
}> = ({ selectedFile, onGenerateSummary, isSummarizing }) => {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedFile) return;

    const userMessage = inputText;
    setInputText('');
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setIsLoading(true);

    try {
      const response = await fetch('https://document-summarizer-a5dk.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: selectedFile.downloadURL,
          question: userMessage,
          file_name: selectedFile.name
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { text: data.response, isUser: false }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        text: 'Sorry, I encountered an error. Please try again.', 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      background: 'white',
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={16} color="#3b82f6" />
          <span style={{ fontWeight: '600', color: '#1e293b' }}>Document Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => selectedFile && onGenerateSummary(selectedFile)}
            disabled={!selectedFile || isSummarizing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (!selectedFile || isSummarizing) ? 'not-allowed' : 'pointer',
            }}
          >
            <Brain size={12} />
            {isSummarizing ? 'Summarizing...' : 'Summarize'}
          </button>
          <button
            onClick={clearChat}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #6b7280',
              background: 'rgba(107, 114, 128, 0.1)',
              color: '#6b7280',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {selectedFile && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#f0f9ff',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '12px',
          color: '#0369a1',
        }}>
          Active: {selectedFile.name}
        </div>
      )}

      <div style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px',
            marginTop: '40px',
          }}>
            {selectedFile 
              ? 'Ask questions about the selected document or click "Summarize"'
              : 'Select a document to start chatting'}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.isUser ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: message.isUser ? '#3b82f6' : '#f1f5f9',
                color: message.isUser ? 'white' : '#1e293b',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              {message.text}
            </div>
          ))
        )}
        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: '#f1f5f9',
            color: '#1e293b',
            fontSize: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #e2e8f0',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: '16px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={selectedFile ? "Ask about this document..." : "Select a document first..."}
          disabled={!selectedFile || isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            outline: 'none',
            backgroundColor: !selectedFile ? '#f8fafc' : 'white',
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || !selectedFile || isLoading}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: (!inputText.trim() || !selectedFile || isLoading) ? '#cbd5e1' : '#3b82f6',
            color: 'white',
            cursor: (!inputText.trim() || !selectedFile || isLoading) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

const Documents: React.FC<DocumentsProps> = ({ initialFiles = [] }) => {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'rename' | 'newFolder';
    title: string;
    initialValue: string;
  }>({
    isOpen: false,
    type: 'newFolder',
    title: '',
    initialValue: ''
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [documentCounts, setDocumentCounts] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0
  });

  // User state
  const [currentUserRole, setCurrentUserRole] = useState<'ORGADM' | 'TENUSER' | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  // Firebase collections
  const documentsCollection = collection(db, 'documents');
  const projectsCollection = collection(db, 'projects');

  // Get user data from token/localStorage
  const getUserData = () => {
    const data = JSON.parse(localStorage.getItem('userData') || '{}');
    let role = 'TENUSER';

    try {
      if (data.Token) {
        const base64Url = data.Token.split('.')[1] || '';
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const tokenClaims = JSON.parse(atob(base64));
        role = tokenClaims.Role || 'TENUSER';

        return {
          token: data.Token,
          userEmail: tokenClaims.Email || tokenClaims.UserName || '',
          userName: tokenClaims.UserName || '',
          role,
          isOrgAdmin: role === 'ORGADM'
        };
      }
    } catch (error) {
      console.error('Error parsing token:', error);
    }
    return {
      token: data.Token,
      userEmail: data.UserName || '',
      userName: data.UserName || '',
      role: 'TENUSER',
      isOrgAdmin: false
    };
  };

  // Check if user has access to project
  const userHasAccessToProject = (project: Project, userName: string) => {
    if (!project.teamMembers || project.teamMembers.length === 0) return false;
    return project.teamMembers.some(member => 
      member.name.toLowerCase() === userName.toLowerCase()
    );
  };

  // Fetch projects based on user role
  const fetchProjects = async () => {
    try {
      setLoading(true);
      console.log(loading)
      const userData = getUserData();
      setCurrentUserRole(userData.isOrgAdmin ? 'ORGADM' : 'TENUSER');
      setCurrentUserName(userData.userName.toLowerCase());
      console.log(currentUserName)

      const projectsQuery = query(projectsCollection);
      const querySnapshot = await getDocs(projectsQuery);
      const projectsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];

      if (userData.isOrgAdmin) {
        setProjects(projectsList);
      } else {
        const userProjects = projectsList.filter(project =>
          userHasAccessToProject(project, userData.userName)
        );
        setProjects(userProjects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate unique filename
  const generateUniqueFilename = async (originalName: string, projectId: string, parentFolderId?: string | null): Promise<string> => {
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
    
    let counter = 0;
    let uniqueName = originalName;

    while (true) {
      const existingQuery = query(
        documentsCollection,
        where('name', '==', uniqueName),
        where('projectId', '==', projectId),
        where('parentFolderId', '==', parentFolderId || null)
      );
      
      const existingDocs = await getDocs(existingQuery);
      if (existingDocs.empty) break;
      
      counter++;
      uniqueName = `${baseName}_${counter}${extension}`;
    }

    return uniqueName;
  };

  // Load documents from Firebase
  const loadDocumentsFromFirebase = async (projectId?: string) => {
    try {
      let documentsQuery;
      
      if (projectId) {
        documentsQuery = query(documentsCollection, where('projectId', '==', projectId));
      } else {
        if (currentUserRole === 'ORGADM') {
          documentsQuery = query(documentsCollection);
        } else {
          const userProjectIds = projects.map(p => p.id);
          if (userProjectIds.length > 0) {
            documentsQuery = query(documentsCollection, where('projectId', 'in', userProjectIds));
          } else {
            setFiles([]);
            return;
          }
        }
      }

      const querySnapshot = await getDocs(documentsQuery);
      const raw: any[] = [];
      
      querySnapshot.forEach((d) => {
        const data = d.data();
        raw.push({
          id: d.id,
          name: data.name,
          type: data.type,
          lastModified: data.lastModified,
          size: data.size,
          downloadURL: data.downloadURL,
          firebasePath: data.firebasePath,
          summary: data.summary,
          parentFolderId: data.parentFolderId || null,
          projectId: data.projectId || null,
          createdAt: data.createdAt || null,
        });
      });

      // Build tree structure
      const folders = raw.filter(r => r.type === 'folder').map(f => ({ ...f, children: [] as FileNode[] }));
      const filesOnly = raw.filter(r => r.type === 'file');

      const folderMap: Record<string, FileNode> = {};
      folders.forEach((fr: FileNode) => {
        folderMap[fr.id] = fr;
      });

      const rootNodes: FileNode[] = [];

      // Add folders first
      folders.forEach(fr => rootNodes.push(fr));

      // Add files into folder children or root
      filesOnly.forEach((file) => {
        if (file.parentFolderId && folderMap[file.parentFolderId]) {
          folderMap[file.parentFolderId].children!.push(file);
        } else {
          rootNodes.push(file);
        }
      });

      setFiles(rootNodes);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  // Create new folder
  const handleNewFolder = async (folderName: string) => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }

    try {
      const uniqueFolderName = await generateUniqueFolderName(folderName, selectedProject.id);
      
      const folderDocRef = await addDoc(documentsCollection, {
        name: uniqueFolderName,
        type: 'folder',
        lastModified: new Date().toLocaleDateString(),
        createdAt: Timestamp.now(),
        projectId: selectedProject.id,
      });

      const newFolder: FileNode = {
        id: folderDocRef.id,
        name: uniqueFolderName,
        type: 'folder',
        lastModified: new Date().toLocaleDateString(),
        children: [],
        projectId: selectedProject.id,
      };

      setFiles((prevFiles) => [...prevFiles, newFolder]);
      await loadDocumentsFromFirebase(selectedProject.id);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  // Generate unique folder name
  const generateUniqueFolderName = async (folderName: string, projectId: string): Promise<string> => {
    let counter = 0;
    let uniqueName = folderName;

    while (true) {
      const existingQuery = query(
        documentsCollection,
        where('name', '==', uniqueName),
        where('type', '==', 'folder'),
        where('projectId', '==', projectId)
      );
      
      const existingDocs = await getDocs(existingQuery);
      if (existingDocs.empty) break;
      
      counter++;
      uniqueName = `${folderName}_${counter}`;
    }

    return uniqueName;
  };

  // Enhanced upload function
  const handleUpload = () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.txt,.docx,.doc,.jpg,.jpeg,.png";

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files?.length) return;

      setUploading(true);
      const uploadPromises = Array.from(target.files).map(file => 
        uploadFileToFirebase(file, selectedProject.id)
      );

      try {
        await Promise.all(uploadPromises);
        await loadDocumentsFromFirebase(selectedProject.id);
      } catch (error) {
        console.error('Error uploading files:', error);
      } finally {
        setUploading(false);
      }
    };

    input.click();
  };

  // Upload file to Firebase
  const uploadFileToFirebase = async (file: File, projectId: string): Promise<void> => {
    try {
      const parentFolderId = selectedFile?.type === 'folder' ? selectedFile.id : null;
      const uniqueFileName = await generateUniqueFilename(file.name, projectId, parentFolderId);

      const filePath = parentFolderId 
        ? `documents/${projectId}/${parentFolderId}/${uniqueFileName}`
        : `documents/${projectId}/${uniqueFileName}`;

      const storageRef = ref(storage, filePath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const summary = await generateDocumentSummary(file, downloadURL);

      const newFileDoc = {
        name: uniqueFileName,
        type: 'file',
        lastModified: new Date().toLocaleDateString(),
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        downloadURL,
        firebasePath: filePath,
        summary,
        parentFolderId: parentFolderId || null,
        projectId: projectId,
        uploadedAt: Timestamp.now(),
        originalName: file.name,
        mimeType: file.type
      };

      await addDoc(documentsCollection, newFileDoc);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  // Delete file/folder
  const handleDeleteFile = async (fileToDelete: FileNode) => {
    if (!window.confirm(`Are you sure you want to delete "${fileToDelete.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (fileToDelete.type === 'file') {
        if (fileToDelete.firebasePath) {
          const storageRef = ref(storage, fileToDelete.firebasePath);
          await deleteObject(storageRef);
        }
        await deleteDoc(doc(documentsCollection, fileToDelete.id));
      } else {
        const childrenQuery = query(documentsCollection, where('parentFolderId', '==', fileToDelete.id));
        const childrenSnapshot = await getDocs(childrenQuery);
        
        for (const childDoc of childrenSnapshot.docs) {
          const childData = childDoc.data();
          if (childData.firebasePath) {
            const childStorageRef = ref(storage, childData.firebasePath);
            await deleteObject(childStorageRef);
          }
          await deleteDoc(doc(documentsCollection, childDoc.id));
        }

        await deleteDoc(doc(documentsCollection, fileToDelete.id));
      }

      if (selectedFile?.id === fileToDelete.id) {
        setSelectedFile(null);
      }

      await loadDocumentsFromFirebase(selectedProject?.id);

    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file. Please try again.');
    }
  };

  // Generate document summary using Python backend
  const handleGenerateSummary = async (file: FileNode) => {
    if (!file.downloadURL) {
      alert('No file URL available for summarization');
      return;
    }

    setIsSummarizing(true);
    try {
      const response = await fetch('https://document-summarizer-a5dk.onrender.com/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: file.downloadURL,
          file_name: file.name
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      
      // Update the file with the new summary
      const fileDocRef = doc(documentsCollection, file.id);
      await updateDoc(fileDocRef, {
        summary: data.summary
      });

      // Update local state
      setSelectedFile(prev => prev ? { ...prev, summary: data.summary } : null);
      await loadDocumentsFromFirebase(selectedProject?.id);

    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Error generating summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Mock function for document summarization (fallback)
  const generateDocumentSummary = async (file: File, downloadURL: string): Promise<string> => {
    return `Document "${file.name}" uploaded successfully. Click "Summarize" to generate AI summary.`;
  };

  // Get document counts
  const getDocumentCounts = async () => {
    try {
      let documentsQuery;
      
      if (currentUserRole === 'ORGADM') {
        documentsQuery = query(documentsCollection);
      } else {
        const userProjectIds = projects.map(p => p.id);
        if (userProjectIds.length > 0) {
          documentsQuery = query(documentsCollection, where('projectId', 'in', userProjectIds));
        } else {
          return { totalFiles: 0, totalFolders: 0, totalSize: 0 };
        }
      }

      const querySnapshot = await getDocs(documentsQuery);
      const documents = querySnapshot.docs.map(doc => doc.data());
      
      const totalFiles = documents.filter(doc => doc.type === 'file').length;
      const totalFolders = documents.filter(doc => doc.type === 'folder').length;
      
      const totalSize = documents.reduce((acc, doc) => {
        if (doc.size) {
          const sizeValue = parseFloat(doc.size);
          return acc + (isNaN(sizeValue) ? 0 : sizeValue);
        }
        return acc;
      }, 0);

      return { totalFiles, totalFolders, totalSize };
    } catch (error) {
      console.error('Error getting document counts:', error);
      return { totalFiles: 0, totalFolders: 0, totalSize: 0 };
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!selectedFile?.downloadURL) return;
    window.open(selectedFile.downloadURL, '_blank');
  };

  // Handle preview
  const handlePreview = () => {
    if (!selectedFile?.downloadURL) {
      alert('No preview available for this file.');
      return;
    }
    setPreviewModalOpen(true);
  };

  // Load projects and documents on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Load documents when projects change
  useEffect(() => {
    if (projects.length > 0) {
      loadDocumentsFromFirebase();
      getDocumentCounts().then(setDocumentCounts);
    }
  }, [projects, currentUserRole]);

  // Load documents when project selection changes
  useEffect(() => {
    if (selectedProject) {
      loadDocumentsFromFirebase(selectedProject.id);
    }
  }, [selectedProject]);

  // Modal handlers
  const openNewFolderModal = () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }
    setModalState({
      isOpen: true,
      type: 'newFolder',
      title: 'Create New Folder',
      initialValue: ''
    });
  };

  const handleModalSubmit = (value: string) => {
    if (modalState.type === 'newFolder') {
      handleNewFolder(value);
    }
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Filter files based on search
  const filteredFiles = files
    .map(node => {
      if (!searchQuery) return node;
      const q = searchQuery.toLowerCase();
      if (node.type === 'folder') {
        const matchedChildren = node.children?.filter(c => c.name.toLowerCase().includes(q)) || [];
        if (node.name.toLowerCase().includes(q) || matchedChildren.length) {
          return { ...node, children: matchedChildren };
        }
        return null;
      } else {
        return node.name.toLowerCase().includes(q) ? node : null;
      }
    })
    .filter(Boolean) as FileNode[];

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .file-tree-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .file-tree-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .file-tree-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .file-tree-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @media (max-width: 768px) {
          .documents-layout {
            grid-template-columns: 1fr !important;
          }
          .documents-container {
            padding: 16px !important;
          }
          .header-actions {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        title={modalState.title}
        initialValue={modalState.initialValue}
        type={modalState.type === 'newFolder' ? 'folder' : 'file'}
      />

      <FilePreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        file={selectedFile}
      />

      <div className="documents-container" style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* Header and Stats */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                marginBottom: '8px',
              }}>Documents</h1>
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                fontWeight: '500',
              }}>Organize and manage your project files</p>
              {uploading && (
                <div style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  display: 'inline-block',
                  marginTop: '8px'
                }}>
                  Uploading files...
                </div>
              )}
            </div>
            
            <div className="header-actions" style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}>
              <div style={{
                position: 'relative',
                minWidth: '280px',
              }}>
                <Search size={18} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }} />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Project Selection */}
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}>
              Select Project
            </label>
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === e.target.value);
                setSelectedProject(project || null);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                backgroundColor: 'white',
                color: '#1e293b',
                outline: 'none',
              }}
            >
              <option value="">Choose a project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.manager}
                </option>
              ))}
            </select>
            {selectedProject && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Users size={14} color="#3b82f6" />
                  <span style={{ fontWeight: '600', color: '#0369a1' }}>{selectedProject.name}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Manager: {selectedProject.manager} | Status: {selectedProject.status}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '16px',
            marginTop: '24px',
          }}>
            <div style={{
              padding: '20px 16px',
              borderRadius: '16px',
              textAlign: 'center',
              background: 'linear-gradient(45deg, #3b82f6, #6366f1, #8b5cf6)',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 3s ease infinite',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
              color: 'white',
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
                {documentCounts.totalFiles}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>Total Files</div>
            </div>

            <div style={{
              padding: '20px 16px',
              borderRadius: '16px',
              textAlign: 'center',
              background: 'linear-gradient(45deg, #10b981, #14b8a6, #06b6d4)',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 3s ease infinite',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
              color: 'white',
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
                {documentCounts.totalFolders}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>Folders</div>
            </div>

            <div style={{
              padding: '20px 16px',
              borderRadius: '16px',
              textAlign: 'center',
              background: 'linear-gradient(45deg, #f59e0b, #f97316, #ef4444)',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 3s ease infinite',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
              color: 'white',
            }}>
              <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
                {documentCounts.totalSize.toFixed(1)} MB
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>Total Size</div>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="documents-layout" style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: '28px',
        }}>
          {/* File Tree Sidebar */}
          <div style={{
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            height: 'fit-content',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '24px',
            }}>
              <button
                onClick={openNewFolderModal}
                disabled={!selectedProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: selectedProject ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#94a3b8',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedProject ? 'pointer' : 'not-allowed',
                }}
              >
                <FolderPlus size={18} /> New Folder
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: uploading 
                    ? '#94a3b8' 
                    : selectedProject 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : '#94a3b8',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (uploading || !selectedProject) ? 'not-allowed' : 'pointer',
                }}
              >
                <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            
            <div style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: '8px',
            }}>
              File Explorer {selectedProject && `- ${selectedProject.name}`}
            </div>
            
            <div className="file-tree-scrollbar" style={{
              maxHeight: '520px',
              overflowY: 'auto',
            }}>
              {filteredFiles.map(node => (
                <FileTreeItem
                  key={node.id}
                  node={node}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onDeleteFile={handleDeleteFile}
                />
              ))}
              {filteredFiles.length === 0 && (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '14px',
                }}>
                  {selectedProject ? 'No files or folders yet' : 'Select a project to view files'}
                </div>
              )}
            </div>
          </div>

          {/* File Details Panel & Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* File Details Panel */}
            <div style={{
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              height: 'fit-content',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(12px)',
            }}>
              <h3 style={{
                margin: '0 0 28px 0',
                fontSize: '20px',
                fontWeight: '500',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                File Details
                {selectedFile && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}>
                    {selectedFile.type === 'folder' ? 'FOLDER' : 'FILE'}
                  </span>
                )}
              </h3>
              
              {selectedFile ? (
                <div>
                  <div style={{
                    padding: '24px',
                    background: 'rgba(248, 250, 252, 0.8)',
                    borderRadius: '14px',
                    marginBottom: '32px',
                    border: '1px solid rgba(226, 232, 240, 0.6)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginBottom: '20px',
                    }}>
                      {selectedFile.type === 'folder' ? (
                        <div style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background: 'rgba(254, 243, 199, 0.4)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                        }}>
                          <Folder size={28} color="#d97706" />
                        </div>
                      ) : (
                        <div style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background: 'rgba(226, 232, 240, 0.4)',
                          border: '1px solid rgba(100, 116, 139, 0.2)',
                        }}>
                          <File size={28} color="#475569" />
                        </div>
                      )}
                      <div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '500',
                          color: '#1e293b',
                          marginBottom: '4px',
                        }}>
                          {selectedFile.name}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b',
                          fontWeight: '400',
                        }}>
                          {selectedFile.lastModified || 'Recently modified'}
                          {selectedFile.size && ` • ${selectedFile.size}`}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '16px',
                      fontSize: '13px',
                    }}>
                      <div>
                        <div style={{ color: '#64748b', fontWeight: '400', marginBottom: '6px', fontSize: '12px' }}>Type</div>
                        <div style={{ 
                          color: '#1e293b', 
                          fontWeight: '400',
                          padding: '6px 12px',
                          background: 'rgba(255, 255, 255, 0.6)',
                          borderRadius: '8px',
                          display: 'inline-block',
                          fontSize: '12px',
                        }}>
                          {selectedFile.type === 'folder' ? 'Folder' : selectedFile.name.split('.').pop()?.toUpperCase() || 'File'}
                        </div>
                      </div>
                      {selectedFile.lastModified && (
                        <div>
                          <div style={{ color: '#64748b', fontWeight: '400', marginBottom: '6px', fontSize: '12px' }}>Last Modified</div>
                          <div style={{ 
                            color: '#1e293b', 
                            fontWeight: '400',
                            padding: '6px 12px',
                            background: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: '8px',
                            display: 'inline-block',
                            fontSize: '12px',
                          }}>
                            {selectedFile.lastModified}
                          </div>
                        </div>
                      )}
                      {selectedFile.size && (
                        <div>
                          <div style={{ color: '#64748b', fontWeight: '400', marginBottom: '6px', fontSize: '12px' }}>Size</div>
                          <div style={{ 
                            color: '#1e293b', 
                            fontWeight: '400',
                            padding: '6px 12px',
                            background: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: '8px',
                            display: 'inline-block',
                            fontSize: '12px',
                          }}>
                            {selectedFile.size}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedFile.summary && (
                      <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: 'rgba(239, 246, 255, 0.6)',
                        borderRadius: '12px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#3b82f6',
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                        }}>
                          AI Summary
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#475569',
                          lineHeight: '1.5',
                        }}>
                          {selectedFile.summary}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '14px',
                  }}>
                    <button
                      onClick={handlePreview}
                      disabled={!selectedFile.downloadURL}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        background: selectedFile.downloadURL 
                          ? 'rgba(59, 130, 246, 0.05)' 
                          : 'rgba(148, 163, 184, 0.1)',
                        color: selectedFile.downloadURL ? '#1e40af' : '#64748b',
                        cursor: selectedFile.downloadURL ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: '400',
                        textAlign: 'left',
                      }}
                    >
                      <Eye size={18} />
                      {selectedFile.downloadURL ? 'Preview File' : 'No Preview'}
                    </button>
                    
                    <button
                      onClick={handleDownload}
                      disabled={!selectedFile.downloadURL}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        background: selectedFile.downloadURL 
                          ? 'rgba(16, 185, 129, 0.05)' 
                          : 'rgba(148, 163, 184, 0.1)',
                        color: selectedFile.downloadURL ? '#065f46' : '#64748b',
                        cursor: selectedFile.downloadURL ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: '400',
                        textAlign: 'left',
                      }}
                    >
                      <Download size={18} />
                      Download
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#94a3b8',
                  background: 'rgba(248, 250, 252, 0.6)',
                  borderRadius: '14px',
                  border: '1px dashed rgba(203, 213, 225, 0.6)',
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    margin: '0 auto 20px',
                    background: 'rgba(241, 245, 249, 0.8)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <File size={24} style={{ opacity: 0.4, color: '#64748b' }} />
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '400', color: '#64748b' }}>
                    No File Selected
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', maxWidth: '280px', lineHeight: '1.5', fontWeight: '400' }}>
                    Select a file or folder from the explorer to view details
                  </p>
                </div>
              )}
            </div>

            {/* Chat Interface */}
            <ChatInterface 
              selectedFile={selectedFile}
              onGenerateSummary={handleGenerateSummary}
              isSummarizing={isSummarizing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;