'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  MessageSquare,
  CheckSquare,
  Activity,
  CheckCircle,
  Clock,
  Users,
  Pin,
  Search,
  Moon,
  Sun,
  Calendar,
  TrendingUp,
  Zap,
  Star,
  Crown,
  Edit,
  Save,
  X as CloseIcon,
  PlayCircle,
  CheckCircle2
} from 'lucide-react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { getDiligenceFabricSDK } from '../services/DFService';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface Message {
  id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
  type: 'text' | 'system';
  projectId: string;
  isPinned?: boolean;
}
interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  assigneeId: string;
  status: 'todo' | 'in-progress' | 'completed' | 'review';
  priority: 'low' | 'medium' | 'high';
  dueDate: Timestamp;
  createdBy: string;
  createdById: string;
  projectId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
interface StatusUpdate {
  id: string;
  user: string;
  userId: string;
  update: string;
  timestamp: Timestamp;
  mood: 'good' | 'neutral' | 'blocked';
  projectId: string;
  type: 'status';
}
interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  remainingHours: number;
  startDate: string;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  teamMembers: TeamMember[];
  totalEfforts: number;
  createdAt: Timestamp;
  sentiment?: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    totalMessages: number;
    updatedAt?: Timestamp;
  };
}
interface TeamMember {
  name: string;
  allocatedHours: number;
  userId: string;
  role: string;
  email?: string;
}
interface User {
  displayName: string;
  email: string;
  id: string;
  role?: string;
  isOrgAdmin: boolean;
}
interface DFUser {
  id: string;
  name: string;
  email: string;
  organization: string;
}
interface EditableTaskState {
  [taskId: string]: {
    title: string;
    description: string;
    assignee: string;
    dueDate: string;
    isEditing: boolean;
  };
}
interface EditableStatusState {
  [statusId: string]: {
    update: string;
    mood: 'good' | 'neutral' | 'blocked';
    isEditing: boolean;
  };
}

// ──────────────────────────────────────────────────────────────
// Sentiment API
// ──────────────────────────────────────────────────────────────



const analyzeSentiment = async (texts: string[]) => {
  if (texts.length === 0) return [];

  try {
    const res = await fetch('https://document-summarizer-a5dk.onrender.com/api/analyze-sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const sentidata = await res.json();
    console.log(sentidata[0].score)
    return sentidata;
     // example: [{ label: "positive", score: 0.8 }]
  } catch (err) {
    console.error('Sentiment API failed:', err);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────
// Update Project Sentiment
// ──────────────────────────────────────────────────────────────
const updateProjectSentiment = async (
  projectId: string,
  sentiment: { score: number; label: 'positive' | 'neutral' | 'negative'; totalMessages: number },
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const snap = await getDoc(projectRef);
    const stored = snap.data()?.sentiment ?? { score: 0, totalMessages: 0 };

    // If nothing new to save, skip (prevents repeated writes)
    if (stored.totalMessages === sentiment.totalMessages && Math.abs((stored.score ?? 0) - sentiment.score) < 1e-6) {
      // nothing changed
      return;
    }

    // Ensure incoming sentiment.score is normalized to [-1, 1]
    const clampedScore = Math.max(-1, Math.min(1, sentiment.score));

    await updateDoc(projectRef, {
      'sentiment.score': clampedScore,
      'sentiment.label': sentiment.label,
      'sentiment.totalMessages': sentiment.totalMessages,
      'sentiment.updatedAt': serverTimestamp()
    });

    // Update local state: keep same normalized score (Timestamp.now for local update)
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              sentiment: {
                ...sentiment,
                score: clampedScore,
                updatedAt: Timestamp.now()
              }
            }
          : p
      )
    );
  } catch (error) {
    console.error('Failed to update sentiment:', error);
  }
};


// ──────────────────────────────────────────────────────────────
// Sentiment Badge
// ──────────────────────────────────────────────────────────────
const SentimentBadge = ({ sentiment }: { sentiment?: Project['sentiment'] }) => {
  if (!sentiment || sentiment.totalMessages === 0) {
    return <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" title="No messages yet" />;
  }
  const color =
    sentiment.label === 'positive'
      ? 'bg-emerald-500'
      : sentiment.label === 'negative'
      ? 'bg-red-500'
      : 'bg-amber-500';
  return (
    <div
      className={`w-3 h-3 rounded-full ${color} shadow-sm transition-all duration-300`}
      title={`Thread Sentiment: ${sentiment.label} (${(sentiment.score * 100).toFixed(1)}%)\nBased on ${sentiment.totalMessages} messages`}
    />
  );
};

const Chat: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [chatTab, setChatTab] = useState<'chat' | 'task' | 'status'>('chat');
  const [newMessage, setNewMessage] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    assigneeId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  });
  const [newStatus, setNewStatus] = useState('');
  const [statusMood, setStatusMood] = useState<'good' | 'neutral' | 'blocked'>('neutral');
  const [loading, setLoading] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dfUsers, setDfUsers] = useState<DFUser[]>([]);
  const [editableTasks, setEditableTasks] = useState<EditableTaskState>({});
  const [editableStatuses, setEditableStatuses] = useState<EditableStatusState>({});
  const [messageDocIds, setMessageDocIds] = useState<{ [messageId: string]: string }>({});
  const [positivePct, setPositivePct] = useState(0);
  const [neutralPct, setNeutralPct] = useState(0);
  const [negativePct, setNegativePct] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ──────────────────────────────────────────────────────────────
  // Theme
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const bgPrimary = isDarkMode ? 'bg-slate-900' : 'bg-gray-50';
  const bgSecondary = isDarkMode ? 'bg-slate-800' : 'bg-white';
  const bgTertiary = isDarkMode ? 'bg-slate-700' : 'bg-gray-100';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-slate-300' : 'text-gray-700';
  const textTertiary = isDarkMode ? 'text-slate-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-slate-700' : 'border-gray-200';
  const hoverBg = isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100';

  // ──────────────────────────────────────────────────────────────
  // User & DF Helpers
  // ──────────────────────────────────────────────────────────────
  const getUserData = useCallback(() => {
    const data = JSON.parse(localStorage.getItem('userData') || '{}');
    let role = 'TENUSER';
    let isOrgAdmin = false;
    try {
      if (data.Token) {
        const base64Url = data.Token.split('.')[1] || '';
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const tokenClaims = JSON.parse(atob(base64));
        role = tokenClaims.Role || 'TENUSER';
        isOrgAdmin = role === 'ORGADM';
      }
    } catch {}
    return {
      token: data.Token,
      tenantID: data.TenantID,
      userName: data.UserName || 'TENUSER',
      role,
      isOrgAdmin
    };
  }, []);

  const buildNameAndEmail = useCallback((dfUserName: string) => {
    if (!dfUserName || typeof dfUserName !== 'string') {
      return { name: 'Unknown User', email: 'unknown@ubtiinc.com' };
    }
    const atIndex = dfUserName.indexOf('@');
    if (atIndex === -1) {
      return { name: dfUserName, email: `${dfUserName}@ubtiinc.com` };
    }
    const namePart = dfUserName.substring(0, atIndex);
    return { name: namePart, email: dfUserName };
  }, []);

  const fetchDFUsers = useCallback(async () => {
    try {
      const userData = getUserData();
      if (!userData.token) throw new Error('No authentication token found.');
      const client = getDiligenceFabricSDK();
      if (!client) throw new Error('Failed to initialize Diligence Fabric SDK');
      client.setAuthUser({ Token: userData.token });
      const requestBody = { tenantID: userData.tenantID };
      const appRoleService = client.getApplicationRoleService();
      const response = await appRoleService.getUserAppRole(requestBody);
      if (Array.isArray(response?.Result)) {
        const users: DFUser[] = response.Result.map((user: any) => {
          const { name, email } = buildNameAndEmail(user.UserName);
          return {
            id: user.UserID,
            name,
            email,
            organization: user.OrganizationName || 'N/A'
          };
        });
        setDfUsers(users);
      }
    } catch (error) {
      console.error('Error fetching DF users:', error);
      setDfUsers([]);
    }
  }, [getUserData, buildNameAndEmail]);

  const fetchCurrentUser = useCallback(async () => {
    const userData = getUserData();
    try {
      if (!userData.token) throw new Error('No authentication token found.');
      const client = getDiligenceFabricSDK();
      if (!client) throw new Error('Failed to initialize Diligence Fabric SDK');
      client.setAuthUser({ Token: userData.token });
      const requestBody = { tenantID: userData.tenantID };
      const appRoleService = client.getApplicationRoleService();
      const response = await appRoleService.getUserAppRole(requestBody);
      let userName = userData.userName || 'TENUSER';
      let userEmail = userData.userName || '';
      if (userEmail && !userEmail.includes('@')) {
        userEmail = `${userEmail}@ubtiinc.com`;
      }
      if (Array.isArray(response?.Result) && response.Result.length > 0) {
        const currentUser = response.Result.find(
          (u: any) => u.UserName === userEmail || u.UserName === userName
        );
        if (currentUser) {
          userName = currentUser.UserName;
          userEmail = currentUser.UserName;
        }
      }
      const { name, email } = buildNameAndEmail(userName);
      setCurrentUser({
        displayName: name,
        email,
        id: userData.userName || 'current-user',
        role: userData.role,
        isOrgAdmin: userData.isOrgAdmin
      });
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      const { name, email } = buildNameAndEmail(userData.userName);
      setCurrentUser({
        displayName: name,
        email,
        id: userData.userName || 'current-user',
        role: 'TENUSER',
        isOrgAdmin: false
      });
    }
  }, [getUserData, buildNameAndEmail]);

  // ──────────────────────────────────────────────────────────────
  // ID Generators
  // ──────────────────────────────────────────────────────────────
  const generateMessageId = useCallback(() => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `msg_${timestamp}_${randomStr}`;
  }, []);

  const generateTaskId = useCallback(() => {
    const timestamp = Date.now().toString(36);
    return `task_${timestamp}`;
  }, []);

  const generateStatusId = useCallback(() => {
    const timestamp = Date.now().toString(36);
    return `status_${timestamp}`;
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Project Access
  // ──────────────────────────────────────────────────────────────
  const userHasAccessToProject = useCallback((project: Project, userEmail: string) => {
    if (!project.teamMembers || project.teamMembers.length === 0) return false;
    return project.teamMembers.some(member => {
      if (member.email && member.email.toLowerCase() === userEmail.toLowerCase()) {
        return true;
      }
      const memberEmail = `${member.name.toLowerCase().replace(/\s+/g, '.')}@ubtiinc.com`;
      return memberEmail === userEmail.toLowerCase();
    });
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Load Projects + Initial Sentiment Percentages
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsRef = collection(db, 'projects');
        const snapshot = await getDocs(projectsRef);
        const projectsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          sentiment: doc.data().sentiment || { score: 0, label: 'neutral', totalMessages: 0 }
        })) as Project[];
        setProjects(projectsData);
        if (currentUser) {
          let accessibleProjects;
          if (currentUser.isOrgAdmin) {
            accessibleProjects = projectsData;
          } else {
            accessibleProjects = projectsData.filter(project =>
              userHasAccessToProject(project, currentUser.email)
            );
          }
          setFilteredProjects(accessibleProjects);
          const total = accessibleProjects.length || 1;
          const positiveCount = accessibleProjects.filter(p => p.sentiment?.label === 'positive').length;
          const neutralCount = accessibleProjects.filter(p => p.sentiment?.label === 'neutral').length;
          const negativeCount = accessibleProjects.filter(p => p.sentiment?.label === 'negative').length;
          setPositivePct(Math.round((positiveCount / total) * 100));
          setNeutralPct(Math.round((neutralCount / total) * 100));
          setNegativePct(Math.round((negativeCount / total) * 100));
          if (!selectedProject || !accessibleProjects.find(p => p.id === selectedProject.id)) {
            const rodneyProject = accessibleProjects.find(p => p.id === 'rodney');
            setSelectedProject(rodneyProject || accessibleProjects[0] || null);
          }
        } else {
          setFilteredProjects([]);
          setSelectedProject(null);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) loadProjects();
  }, [currentUser, userHasAccessToProject]);

  // ──────────────────────────────────────────────────────────────
  // Recalculate Sentiment Percentages
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || filteredProjects.length === 0) return;
    const total = filteredProjects.length;
    const positiveCount = filteredProjects.filter(p => p.sentiment?.label === 'positive').length;
    const neutralCount = filteredProjects.filter(p => p.sentiment?.label === 'neutral').length;
    const negativeCount = filteredProjects.filter(p => p.sentiment?.label === 'negative').length;
    setPositivePct(Math.round((positiveCount / total) * 100));
    setNeutralPct(Math.round((neutralCount / total) * 100));
    setNegativePct(Math.round((negativeCount / total) * 100));
  }, [filteredProjects, currentUser]);

  // ──────────────────────────────────────────────────────────────
  // REAL-TIME MESSAGES + PER-THREAD CUMULATIVE SENTIMENT
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;

    const messagesRef = collection(db, 'projects', selectedProject.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesData = snapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Message, 'id'>;
        if ((data as any).id && (data as any).id !== doc.id) {
          setMessageDocIds((prev) => ({ ...prev, [(data as any).id]: doc.id }));
        }
        return { id: doc.id, ...data } as Message;
      });
      setMessages(messagesData);

      const stored = selectedProject.sentiment ?? {
        score: 0,
        label: 'neutral' as const,
        totalMessages: 0,
      };

      const newMessages = messagesData
        .filter(
          (m): m is Message & { type: 'text'; content: string } =>
            m.type === 'text' && !!m.content?.trim()
        )
        .slice(stored.totalMessages);

      if (newMessages.length === 0) {
        setSelectedProject((prev) =>
          prev ? { ...prev, sentiment: stored } : null
        );
        return;
      }
      
      const texts = newMessages.map((m) => m.content);
      const results = await analyzeSentiment(texts);
      console.log(texts) // [{score:number, label:string}]

      const oldScoreTotal = stored.score * stored.totalMessages;
      const newScoreTotal = results.reduce((s: number, r: { score: number }) => s + r.score, 0);
      const totalScore = oldScoreTotal + newScoreTotal;
      const totalCount = stored.totalMessages + results.length;
      const avgScore = totalCount > 0 ? totalScore / totalCount : 0;

      const label: 'positive' | 'neutral' | 'negative' =
        avgScore >= 0.05 ? 'positive' :
        avgScore <= -0.05 ? 'negative' :
        'neutral';

      const newSentiment = {
        score: avgScore,
        label,
        totalMessages: totalCount,
      };
setPositivePct(newSentiment.label === 'positive' ? Math.round(newSentiment.score * 100) : 0);
setNeutralPct(newSentiment.label === 'neutral' ? 100 : 0);
setNegativePct(newSentiment.label === 'negative' ? Math.round(Math.abs(newSentiment.score) * 100) : 0);


      await updateProjectSentiment(selectedProject.id, newSentiment, setProjects);

      setSelectedProject((prev) =>
        prev
          ? {
              ...prev,
              sentiment: { ...newSentiment, updatedAt: Timestamp.now() },
            }
          : null
      );
    });

    return () => unsubscribe();
  }, [selectedProject]);

  // ──────────────────────────────────────────────────────────────
  // REAL-TIME LISTENERS FOR TASKS + STATUS UPDATES (CRITICAL)
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // when project changes, attach listeners for tasks and statusUpdates so UI updates in real-time
    if (!selectedProject) {
      setTasks([]);
      setStatusUpdates([]);
      return;
    }

    const tasksRef = collection(db, 'projects', selectedProject.id, 'tasks');
    const qTasks = query(tasksRef, orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(qTasks, snapshot => {
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return { id: d.id, ...raw } as Task;
      });
      setTasks(data);
    }, err => {
      console.error('Tasks listener error:', err);
    });

    const statusRef = collection(db, 'projects', selectedProject.id, 'statusUpdates');
    const qStatus = query(statusRef, orderBy('timestamp', 'desc'));
    const unsubscribeStatus = onSnapshot(qStatus, snapshot => {
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return { id: d.id, ...raw } as StatusUpdate;
      });
      setStatusUpdates(data);
    }, err => {
      console.error('StatusUpdates listener error:', err);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeStatus();
    };
  }, [selectedProject]);

  // ──────────────────────────────────────────────────────────────
  // Pinned Messages
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const pinned = messages.filter(msg => msg.isPinned);
    setPinnedMessages(pinned);
  }, [messages]);

  // ──────────────────────────────────────────────────────────────
  // Init User
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCurrentUser();
    fetchDFUsers();
  }, [fetchCurrentUser, fetchDFUsers]);

  // ──────────────────────────────────────────────────────────────
  // Firebase Functions
  // ──────────────────────────────────────────────────────────────
  const handlePinMessage = async (messageId: string, pin: boolean) => {
    if (!selectedProject) return;
    try {
      const firebaseDocId = messageDocIds[messageId] || messageId;
      const messageRef = doc(db, 'projects', selectedProject.id, 'messages', firebaseDocId);
      await updateDoc(messageRef, {
        isPinned: pin,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error pinning message:', error);
      alert(`Failed to ${pin ? 'pin' : 'unpin'} message.`);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedProject || !currentUser) return;
    try {
      const messagesRef = collection(db, 'projects', selectedProject.id, 'messages');
      const messageId = generateMessageId();
      await addDoc(messagesRef, {
        id: messageId,
        sender: currentUser.displayName,
        senderId: currentUser.id,
        content: newMessage,
        type: 'text',
        projectId: selectedProject.id,
        timestamp: serverTimestamp(),
        isPinned: false
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleAddTask = async () => {
    if (!selectedProject || !currentUser) return;
    if (!newTask.title.trim() || !newTask.description.trim()) return;
    if (newTask.assignee && newTask.assignee !== currentUser.displayName && !currentUser.isOrgAdmin) {
      alert('Only Organization Administrators can assign tasks to other team members.');
      return;
    }
    try {
      const tasksRef = collection(db, 'projects', selectedProject.id, 'tasks');
      const taskId = generateTaskId();
      let finalAssignee = newTask.assignee;
      let finalAssigneeId = newTask.assigneeId;
      if (!finalAssignee || (!currentUser.isOrgAdmin && finalAssignee !== currentUser.displayName)) {
        finalAssignee = currentUser.displayName;
        finalAssigneeId = currentUser.id;
      } else {
        const selectedUser = dfUsers.find(user => user.name === newTask.assignee);
        finalAssigneeId = selectedUser?.id || currentUser.id;
      }
      await addDoc(tasksRef, {
        id: taskId,
        title: newTask.title,
        description: newTask.description,
        assignee: finalAssignee,
        assigneeId: finalAssigneeId,
        status: 'todo',
        priority: newTask.priority,
        dueDate: Timestamp.fromDate(new Date(newTask.dueDate || Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdBy: currentUser.displayName,
        createdById: currentUser.id,
        projectId: selectedProject.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewTask({ title: '', description: '', assignee: '', assigneeId: '', priority: 'medium', dueDate: '' });
      // no need to manually update setTasks — onSnapshot will pick up the new doc
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleAddStatus = async () => {
    if (!newStatus.trim() || !selectedProject || !currentUser) return;
    try {
      const statusRef = collection(db, 'projects', selectedProject.id, 'statusUpdates');
      const statusId = generateStatusId();
      await addDoc(statusRef, {
        id: statusId,
        user: currentUser.displayName,
        userId: currentUser.id,
        update: newStatus,
        mood: statusMood,
        projectId: selectedProject.id,
        type: 'status',
        timestamp: serverTimestamp()
      });
      setNewStatus('');
      setStatusMood('neutral');
      // onSnapshot will update setStatusUpdates
    } catch (error) {
      console.error('Error adding status update:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    if (!selectedProject) return;
    try {
      const tasksRef = collection(db, 'projects', selectedProject.id, 'tasks');
      const querySnapshot = await getDocs(query(tasksRef, where('id', '==', taskId)));
      if (querySnapshot.empty) return;
      const taskDocRef = doc(db, 'projects', selectedProject.id, 'tasks', querySnapshot.docs[0].id);
      await updateDoc(taskDocRef, { status: newStatus, updatedAt: serverTimestamp() });
      // onSnapshot will reflect change
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleQuickStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
    if (!selectedProject || !currentUser) return;
    try {
      const tasksRef = collection(db, 'projects', selectedProject.id, 'tasks');
      const querySnapshot = await getDocs(query(tasksRef, where('id', '==', taskId)));
      if (querySnapshot.empty) return;
      const taskData = querySnapshot.docs[0].data() as Task;
      const canUpdate =
        taskData.assigneeId === currentUser.id ||
        taskData.createdById === currentUser.id ||
        currentUser.isOrgAdmin;
      if (!canUpdate) {
        alert('You can only update the status of tasks assigned to you or created by you.');
        return;
      }
      const taskDocRef = doc(db, 'projects', selectedProject.id, 'tasks', querySnapshot.docs[0].id);
      await updateDoc(taskDocRef, { status: newStatus, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!selectedProject || !currentUser) return;
    try {
      const tasksRef = collection(db, 'projects', selectedProject.id, 'tasks');
      const querySnapshot = await getDocs(query(tasksRef, where('id', '==', taskId)));
      if (querySnapshot.empty) return;
      const taskData = querySnapshot.docs[0].data() as Task;
      const canEdit = currentUser.isOrgAdmin || taskData.createdById === currentUser.id;
      if (!canEdit) {
        alert('You can only edit tasks that you created.');
        return;
      }
      if (updates.assignee && updates.assignee !== taskData.assignee && !currentUser.isOrgAdmin) {
        alert('Only Organization Administrators can reassign tasks.');
        return;
      }
      const taskDocRef = doc(db, 'projects', selectedProject.id, 'tasks', querySnapshot.docs[0].id);
      await updateDoc(taskDocRef, { ...updates, updatedAt: serverTimestamp() });
      setEditableTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], isEditing: false } }));
      // onSnapshot will update tasks state
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleUpdateStatus = async (statusId: string, updates: Partial<StatusUpdate>) => {
    if (!selectedProject || !currentUser) return;
    try {
      const statusRef = collection(db, 'projects', selectedProject.id, 'statusUpdates');
      const querySnapshot = await getDocs(query(statusRef, where('id', '==', statusId)));
      if (querySnapshot.empty) return;
      const statusData = querySnapshot.docs[0].data() as StatusUpdate;
      const canEdit = currentUser.isOrgAdmin || statusData.userId === currentUser.id;
      if (!canEdit) {
        alert('You can only edit your own status updates.');
        return;
      }
      const statusDocRef = doc(db, 'projects', selectedProject.id, 'statusUpdates', querySnapshot.docs[0].id);
      await updateDoc(statusDocRef, { ...updates, updatedAt: serverTimestamp() });
      setEditableStatuses(prev => ({ ...prev, [statusId]: { ...prev[statusId], isEditing: false } }));
      // onSnapshot will update statusUpdates state
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleEditTask = (taskId: string) => {
    setEditableTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], isEditing: true } }));
  };

  const handleCancelEditTask = (taskId: string, originalTask: Task) => {
    setEditableTasks(prev => ({
      ...prev,
      [taskId]: {
        title: originalTask.title,
        description: originalTask.description,
        assignee: originalTask.assignee,
        dueDate: originalTask.dueDate ? new Date(originalTask.dueDate.toDate()).toISOString().split('T')[0] : '',
        isEditing: false
      }
    }));
  };

  const handleSaveTask = async (taskId: string) => {
    const taskData = editableTasks[taskId];
    if (!taskData) return;
    const updates: Partial<Task> = {
      title: taskData.title,
      description: taskData.description
    };
    const originalTask = tasks.find(t => t.id === taskId);
    if (originalTask && taskData.assignee !== originalTask.assignee) {
      if (!currentUser?.isOrgAdmin) {
        alert('Only Organization Administrators can reassign tasks.');
        return;
      }
      updates.assignee = taskData.assignee;
      const selectedUser = dfUsers.find(user => user.name === taskData.assignee);
      updates.assigneeId = selectedUser?.id || currentUser?.id;
    }
    if (taskData.dueDate) {
      updates.dueDate = Timestamp.fromDate(new Date(taskData.dueDate));
    }
    await handleUpdateTask(taskId, updates);
  };

  const handleEditEditStatus = (statusId: string) => {
    setEditableStatuses(prev => ({ ...prev, [statusId]: { ...prev[statusId], isEditing: true } }));
  };

  const handleCancelEditStatus = (statusId: string, originalStatus: StatusUpdate) => {
    setEditableStatuses(prev => ({
      ...prev,
      [statusId]: {
        update: originalStatus.update,
        mood: originalStatus.mood,
        isEditing: false
      }
    }));
  };

  const handleSaveStatus = async (statusId: string) => {
    const statusData = editableStatuses[statusId];
    if (!statusData) return;
    const updates: Partial<StatusUpdate> = {
      update: statusData.update,
      mood: statusData.mood
    };
    await handleUpdateStatus(statusId, updates);
  };

  const handleEditableFieldChange = (taskId: string, field: keyof EditableTaskState[string], value: string) => {
    setEditableTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value }
    }));
  };

  const handleEditableStatusFieldChange = (
    statusId: string,
    field: keyof EditableStatusState[string],
    value: string
  ) => {
    setEditableStatuses(prev => ({
      ...prev,
      [statusId]: { ...prev[statusId], [field]: value as any }
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatTab === 'chat') handleSendMessage();
      if (chatTab === 'task') handleAddTask();
      if (chatTab === 'status') handleAddStatus();
    }
  };

  const canEditTask = (task: Task) => currentUser?.isOrgAdmin || task.createdById === currentUser?.id;
  const canUpdateTaskStatus = (task: Task) =>
    currentUser?.isOrgAdmin || task.assigneeId === currentUser?.id || task.createdById === currentUser?.id;
  const canEditStatus = (status: StatusUpdate) => currentUser?.isOrgAdmin || status.userId === currentUser?.id;
  const canAssignToOthers = () => currentUser?.isOrgAdmin || false;

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: messages.length },
    { id: 'task', label: 'Tasks', icon: CheckSquare, count: tasks.length },
    { id: 'status', label: 'Status', icon: Activity, count: statusUpdates.length }
  ] as const;

  const getStatusColor = (status: string) => {
    const colors = {
      completed: isDarkMode ? '#10b981' : '#059669',
      'in-progress': isDarkMode ? '#f59e0b' : '#d97706',
      review: isDarkMode ? '#8b5cf6' : '#7c3aed',
      todo: isDarkMode ? '#6b7280' : '#4b5563',
      good: isDarkMode ? '#10b981' : '#059669',
      neutral: isDarkMode ? '#6b7280' : '#4b5563',
      blocked: isDarkMode ? '#ef4444' : '#dc2626'
    };
    return colors[status as keyof typeof colors] || colors.neutral;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: isDarkMode ? '#ef4444' : '#dc2626',
      medium: isDarkMode ? '#f59e0b' : '#d97706',
      low: isDarkMode ? '#10b981' : '#059669'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getMoodIcon = (mood: string) => {
    const icons = { good: 'On Track', neutral: 'In Progress', blocked: 'Blocked' };
    return icons[mood as keyof typeof icons] || 'In Progress';
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredMessages = messages.filter(
    msg =>
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.sender.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-slate-300">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Project Header */}
        {selectedProject && (
          <div className={`${bgSecondary} rounded-xl p-4 mb-5 shadow-lg border ${borderColor}`}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex-1 w-full lg:w-auto">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-emerald-400 text-xs font-semibold tracking-wide">LIVE COLLABORATION</span>
                  <Zap className="w-3 h-3 text-yellow-400" />
                  {currentUser.isOrgAdmin && (
                    <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-full">
                      <Crown className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-400 text-xs font-semibold">ORG ADMIN</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className={`text-xl sm:text-2xl font-bold ${textPrimary}`}>{selectedProject.name}</h1>
                  <div className="px-2 py-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-full">
                    <span className="text-blue-400 text-xs font-semibold">ACTIVE</span>
                  </div>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <SentimentBadge sentiment={selectedProject.sentiment} />
                  <span className={`text-xs ${textTertiary}`}>
                    Thread Sentiment: {selectedProject.sentiment?.label || 'neutral'} 
                    ({selectedProject.sentiment?.totalMessages || 0} messages)
                  </span>
                </div>
                <p className={`${textSecondary} text-sm max-w-2xl`}>{selectedProject.description}</p>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-60">
                  <Search className={`w-4 h-4 ${textTertiary} absolute left-3 top-1/2 transform -translate-y-1/2`} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className={`w-full pl-9 pr-3 py-2 ${bgTertiary} border ${borderColor} rounded-lg ${textPrimary} placeholder-${textTertiary} focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm`}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className={`${bgTertiary} border ${borderColor} ${textPrimary} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium`}
                  value={selectedProject?.id || ''}
                  onChange={e => {
                    const project = filteredProjects.find(p => p.id === e.target.value);
                    if (project) setSelectedProject(project);
                  }}
                >
                  <option value="">Select Project</option>
                  {filteredProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-2 ${bgTertiary} rounded-lg ${textSecondary} ${hoverBg} transition-all`}
                  aria-label="Toggle theme"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>
              </div>
            </div>

            {/* 5 Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              {[
                {
                  value: `${selectedProject.progress}%`,
                  label: 'Progress',
                  gradient: 'from-emerald-500 to-teal-500',
                  icon: <TrendingUp className="w-4 h-4 text-teal-400" />,
                  bgGradient: isDarkMode ? 'from-emerald-500/10 to-teal-500/10' : 'from-emerald-500/20 to-teal-500/20'
                },
                {
                  value: `${selectedProject.remainingHours}h`,
                  label: 'Hours',
                  gradient: 'from-blue-500 to-cyan-500',
                  icon: <Clock className="w-4 h-4 text-cyan-400" />,
                  bgGradient: isDarkMode ? 'from-blue-500/10 to-cyan-500/10' : 'from-blue-500/20 to-cyan-500/20'
                },
                {
                  value: selectedProject.teamMembers?.length || 0,
                  label: 'Team',
                  gradient: 'from-purple-500 to-pink-500',
                  icon: <Users className="w-4 h-4 text-pink-400" />,
                  bgGradient: isDarkMode ? 'from-purple-500/10 to-pink-500/10' : 'from-purple-500/20 to-pink-500/20'
                },
                {
                  value: tasks.filter(t => t.status === 'completed').length,
                  label: 'Completed',
                  gradient: 'from-orange-500 to-red-500',
                  icon: <CheckCircle className="w-4 h-4 text-red-400" />,
                  bgGradient: isDarkMode ? 'from-orange-500/10 to-red-500/10' : 'from-orange-500/20 to-red-500/20'
                },
                {
                  value: selectedProject.sentiment?.label
                    ? `${selectedProject.sentiment.label.charAt(0).toUpperCase() + selectedProject.sentiment.label.slice(1)} (${Math.round(selectedProject.sentiment.score * 100)}%)`
                    : 'No messages',
                  label: 'Sentiment',
                  gradient:
                    selectedProject.sentiment?.label === 'positive'
                      ? 'from-emerald-500 to-green-500'
                      : selectedProject.sentiment?.label === 'negative'
                      ? 'from-red-500 to-rose-500'
                      : 'from-amber-500 to-orange-500',
                  icon: <SentimentBadge sentiment={selectedProject.sentiment} />,
                  bgGradient:
                    selectedProject.sentiment?.label === 'positive'
                      ? isDarkMode
                        ? 'from-emerald-500/10 to-green-500/10'
                        : 'from-emerald-500/20 to-green-500/20'
                      : selectedProject.sentiment?.label === 'negative'
                      ? isDarkMode
                        ? 'from-red-500/10 to-rose-500/10'
                        : 'from-red-500/20 to-rose-500/20'
                      : isDarkMode
                      ? 'from-amber-500/10 to-orange-500/10'
                      : 'from-amber-500/20 to-orange-500/20'
                }
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`bg-gradient-to-br ${stat.bgGradient} rounded-lg p-3 border ${borderColor} hover:scale-105 transition-all duration-300 cursor-pointer`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`text-xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                      {stat.value}
                    </div>
                    <div className="mt-1">{stat.icon}</div>
                  </div>
                  <div className={`${textTertiary} text-xs font-medium uppercase`}>{stat.label}</div>
                  {index === 0 && (
                    <div className={`w-full ${isDarkMode ? 'bg-slate-700' : 'bg-gray-300'} rounded-full h-1.5 mt-2`}>
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${selectedProject.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && chatTab === 'chat' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Pin size={14} className="text-yellow-400" />
              <h3 className={`text-xs font-semibold ${textSecondary}`}>Pinned Messages</h3>
            </div>
            <div className="space-y-2">
              {pinnedMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3 hover:shadow-md transition-all`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                          {msg.sender}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600/70'}`}>
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <p className={`${isDarkMode ? 'text-yellow-200' : 'text-yellow-900'} text-sm break-words`}>
                        {msg.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePinMessage(msg.id, !msg.isPinned)}
                      className={`${isDarkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-yellow-600 hover:text-yellow-700'} transition-colors flex-shrink-0`}
                      title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                    >
                      <Pin size={12} fill={msg.isPinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Chat Container */}
        <div className={`${bgSecondary} rounded-xl shadow-lg overflow-hidden border ${borderColor}`}>
          <div className={`flex gap-1 p-3 border-b ${borderColor} overflow-x-auto scrollbar-hide`}>
            {tabs.map(tab => {
              const IconComponent = tab.icon;
              const isActive = chatTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? `${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white shadow-md`
                      : `${textSecondary} ${hoverBg}`
                  }`}
                  onClick={() => setChatTab(tab.id)}
                >
                  <IconComponent size={16} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : `${isDarkMode ? 'bg-slate-600' : 'bg-gray-200'} ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={`h-[400px] overflow-y-auto ${bgTertiary} p-4 custom-scrollbar`}>
            {chatTab === 'chat' && (
              <div className="space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3 opacity-20">
                      <MessageSquare size={32} />
                    </div>
                    <h3 className={`text-lg font-semibold ${textSecondary} mb-1`}>No messages yet</h3>
                    <p className={`${textTertiary} text-sm`}>Start the conversation!</p>
                  </div>
                ) : (
                  filteredMessages.map((msg, index) => {
                    const showDate =
                      index === 0 ||
                      formatDate(filteredMessages[index - 1]?.timestamp) !== formatDate(msg.timestamp);
                    const isCurrentUser = msg.senderId === currentUser.id;
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center my-4">
                            <span
                              className={`${bgSecondary} ${textTertiary} text-xs px-3 py-1 rounded-full border ${borderColor} font-medium`}
                            >
                              {formatDate(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex gap-2 group ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`text-xs font-semibold ${isCurrentUser ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : textSecondary}`}
                              >
                                {msg.sender}
                                {isCurrentUser && ' (You)'}
                                {isCurrentUser && currentUser.isOrgAdmin && (
                                  <Crown className="w-3 h--3 text-purple-400 inline ml-1" />
                                )}
                              </span>
                              <span className={`text-xs ${textTertiary}`}>{formatTimestamp(msg.timestamp)}</span>
                            </div>
                            <div
                              className={`px-3 py-2 rounded-lg max-w-md relative group/msg shadow-sm break-words ${
                                isCurrentUser
                                  ? 'bg-blue-500 text-white rounded-br-sm'
                                  : `${isDarkMode ? 'bg-slate-700' : 'bg-white'} ${textPrimary} rounded-bl-sm border ${borderColor}`
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <button
                                onClick={() => handlePinMessage(msg.id, !msg.isPinned)}
                                className={`absolute -top-1 -right-1 p-1 rounded-full opacity-0 group-hover/msg:opacity-100 transition-opacity ${
                                  isCurrentUser
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : `${isDarkMode ? 'bg-slate-600' : 'bg-gray-200'} ${textSecondary} ${isDarkMode ? 'hover:bg-slate-500' : 'hover:bg-gray-300'}`
                                }`}
                                title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                              >
                                <Pin size={10} fill={msg.isPinned ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {chatTab === 'task' && (
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-3 opacity-20">
                      <CheckSquare size={32} />
                    </div>
                    <h3 className={`text-lg font-semibold ${textSecondary} mb-1`}>No tasks yet</h3>
                    <p className={`${textTertiary} text-sm`}>Create your first task!</p>
                  </div>
                ) : (
                  tasks.map(task => {
                    const canEdit = canEditTask(task);
                    const canUpdateStatus = canUpdateTaskStatus(task);
                    const isAssignee = task.assigneeId === currentUser.id;
                    const isCreator = task.createdById === currentUser.id;
                    const taskEditState = editableTasks[task.id] || {
                      title: task.title,
                      description: task.description,
                      assignee: task.assignee,
                      dueDate: task.dueDate ? new Date(task.dueDate.toDate()).toISOString().split('T')[0] : '',
                      isEditing: false
                    };
                    const availableStatusOptions = [
                      { value: 'todo', label: 'To Do', icon: Clock },
                      { value: 'in-progress', label: 'In Progress', icon: PlayCircle },
                      { value: 'review', label: 'Review', icon: CheckCircle2 },
                      { value: 'completed', label: 'Completed', icon: CheckCircle }
                    ].filter(opt => opt.value !== task.status);
                    return (
                      <div
                        key={task.id}
                        className={`${bgSecondary} rounded-lg p-4 shadow-sm border ${borderColor} transition-all hover:shadow-md ${isAssignee ? 'ring-1 ring-blue-500/20' : ''}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              {taskEditState.isEditing ? (
                                <input
                                  className={`w-full font-bold ${textPrimary} text-base bg-transparent border-b ${borderColor} focus:outline-none focus:border-blue-500 px-1 py-0.5`}
                                  value={taskEditState.title}
                                  onChange={e => handleEditableFieldChange(task.id, 'title', e.target.value)}
                                />
                              ) : (
                                <h3 className={`font-bold ${textPrimary} text-base break-words`}>{task.title}</h3>
                              )}
                              {canEdit && (
                                <div className="flex gap-1 flex-shrink-0">
                                  {taskEditState.isEditing ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveTask(task.id)}
                                        className="p-1 text-emerald-500 hover:text-emerald-400 transition-colors"
                                        title="Save changes"
                                      >
                                        <Save size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelEditTask(task.id, task)}
                                        className="p-1 text-red-500 hover:text-red-400 transition-colors"
                                        title="Cancel editing"
                                      >
                                        <CloseIcon size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleEditTask(task.id)}
                                      className="p-1 text-blue-500 hover:text-blue-400 transition-colors"
                                      title="Edit task"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {taskEditState.isEditing ? (
                              <textarea
                                className={`w-full ${textSecondary} leading-relaxed text-sm bg-transparent border-b ${borderColor} focus:outline-none focus:border-blue-500 resize-none px-1 py-0.5`}
                                value={taskEditState.description}
                                onChange={e => handleEditableFieldChange(task.id, 'description', e.target.value)}
                                rows={2}
                              />
                            ) : (
                              <p className={`${textSecondary} leading-relaxed text-sm break-words`}>{task.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 items-start lg:items-end">
                            <div className="flex gap-2 items-center flex-wrap">
                              <span
                                className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm whitespace-nowrap"
                                style={{ backgroundColor: getPriorityColor(task.priority) }}
                              >
                                {task.priority.toUpperCase()}
                              </span>
                              <select
                                value={task.status}
                                onChange={e => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                                className={`text-xs px-3 py-1 rounded-lg border ${borderColor} ${bgTertiary} focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm font-semibold cursor-pointer`}
                                style={{ color: getStatusColor(task.status) }}
                                disabled={!canUpdateStatus}
                              >
                                <option value="todo">To Do</option>
                                <option value="in-progress">In Progress</option>
                                <option value="review">Review</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                            {canUpdateStatus && availableStatusOptions.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {availableStatusOptions.map(option => {
                                  const IconComponent = option.icon;
                                  const isCurrentStatus = task.status === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      onClick={() => handleQuickStatusUpdate(task.id, option.value as Task['status'])}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                                        isCurrentStatus
                                          ? 'bg-blue-500 text-white shadow-md'
                                          : `${isDarkMode ? 'bg-slate-600 hover:bg-slate-500' : 'bg-gray-200 hover:bg-gray-300'} ${textSecondary}`
                                      }`}
                                      disabled={isCurrentStatus}
                                      title={`Mark as ${option.label}`}
                                    >
                                      <IconComponent size={12} />
                                      <span>{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs ${textTertiary} pt-3 border-t ${borderColor}`}>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3">
                            <div className="flex items-center gap-1">
                              <span>Assignee</span>
                              {taskEditState.isEditing && canAssignToOthers() && canEdit ? (
                                <select
                                  value={taskEditState.assignee}
                                  onChange={e => handleEditableFieldChange(task.id, 'assignee', e.target.value)}
                                  className={`bg-transparent ${textSecondary} font-medium border-b ${borderColor} focus:outline-none focus:border-blue-500 text-xs px-1`}
                                >
                                  {dfUsers.map(user => (
                                    <option key={user.id} value={user.name}>
                                      {user.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <strong className={textSecondary}>{task.assignee}</strong>
                              )}
                              {isAssignee && <span className="text-blue-400 text-xs">(You)</span>}
                            </div>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              Creator <strong className={textSecondary}>{task.createdBy}</strong>
                            </span>
                            {isCreator && <span className="text-green-400 text-xs">(Created by you)</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {taskEditState.isEditing && canEdit ? (
                              <input
                                type="date"
                                value={taskEditState.dueDate}
                                onChange={e => handleEditableFieldChange(task.id, 'dueDate', e.target.value)}
                                className={`bg-transparent ${textSecondary} font-medium border-b ${borderColor} focus:outline-none focus:border-blue-500 text-xs px-1`}
                              />
                            ) : (
                              <span className={`font-medium ${textSecondary}`}>
                                {task.dueDate ? new Date(task.dueDate.toDate()).toLocaleDateString() : 'No due date'}
                              </span>
                            )}
                          </div>
                        </div>
                        {canEdit && !taskEditState.isEditing && (
                          <div className="flex justify-end mt-2">
                            <span className="text-xs text-blue-400">
                              You can {currentUser.isOrgAdmin ? 'edit and reassign' : 'edit'} this task
                            </span>
                          </div>
                        )}
                        {canUpdateStatus && !canEdit && (
                          <div className="flex justify-end mt-2">
                            <span className="text-xs text-green-400">
                              You can update the status of this task
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {chatTab === 'status' && (
              <div className="space-y-4">
                {statusUpdates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3 opacity-20">
                      <Activity size={32} />
                    </div>
                    <h3 className={`text-lg font-semibold ${textSecondary} mb-1`}>No status updates</h3>
                    <p className={`${textTertiary} text-sm`}>Share your first status update!</p>
                  </div>
                ) : (
                  statusUpdates.map(status => {
                    const canEdit = canEditStatus(status);
                    const statusEditState = editableStatuses[status.id] || {
                      update: status.update,
                      mood: status.mood,
                      isEditing: false
                    };
                    return (
                      <div
                        key={status.id}
                        className={`${bgSecondary} rounded-lg p-4 shadow-sm border ${borderColor} transition-all hover:shadow-md`}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getMoodIcon(status.mood)}</span>
                            <div>
                              <h4 className={`font-bold ${textPrimary} text-base`}>{status.user}</h4>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`${textTertiary}`}>{formatTimestamp(status.timestamp)}</span>
                                <span className={`${textTertiary}`}>•</span>
                                <span className={`${textTertiary} font-medium`}>{formatDate(status.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusEditState.isEditing ? (
                              <select
                                value={statusEditState.mood}
                                onChange={e => handleEditableStatusFieldChange(status.id, 'mood', e.target.value)}
                                className={`text-xs px-3 py-1 rounded-lg border ${borderColor} ${bgTertiary} focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm font-semibold cursor-pointer`}
                                style={{ color: getStatusColor(statusEditState.mood) }}
                              >
                                <option value="good">On Track</option>
                                <option value="neutral">In Progress</option>
                                <option value="blocked">Blocked</option>
                              </select>
                            ) : (
                              <span
                                className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all shadow-sm w-fit"
                                style={{
                                  color: getStatusColor(status.mood),
                                  backgroundColor: `${getStatusColor(status.mood)}15`,
                                  borderColor: `${getStatusColor(status.mood)}30`
                                }}
                              >
                                {status.mood === 'good' && 'On Track'}
                                {status.mood === 'neutral' && 'In Progress'}
                                {status.mood === 'blocked' && 'Blocked'}
                              </span>
                            )}
                            {canEdit && (
                              <div className="flex gap-1">
                                {statusEditState.isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveStatus(status.id)}
                                      className="p-1 text-emerald-500 hover:text-emerald-400 transition-colors"
                                      title="Save changes"
                                    >
                                      <Save size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleCancelEditStatus(status.id, status)}
                                      className="p-1 text-red-500 hover:text-red-400 transition-colors"
                                      title="Cancel editing"
                                    >
                                      <CloseIcon size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleEditEditStatus(status.id)}
                                    className="p-1 text-blue-500 hover:text-blue-400 transition-colors"
                                    title="Edit status"
                                  >
                                    <Edit size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {statusEditState.isEditing ? (
                          <div className={`bg-gradient-to-r ${isDarkMode ? 'from-slate-700/50 to-slate-800/30' : 'from-gray-50 to-gray-100'} rounded-lg p-3 mt-2 border ${borderColor}`}>
                            <textarea
                              className={`w-full ${textPrimary} leading-relaxed text-sm bg-transparent border-b ${borderColor} focus:outline-none focus:border-orange-500 resize-none px-1 py-0.5`}
                              value={statusEditState.update}
                              onChange={e => handleEditableStatusFieldChange(status.id, 'update', e.target.value)}
                              rows={3}
                            />
                          </div>
                        ) : (
                          <div className={`bg-gradient-to-r ${isDarkMode ? 'from-slate-700/50 to-slate-800/30' : 'from-gray-50 to-gray-100'} rounded-lg p-3 mt-2 border ${borderColor}`}>
                            <p className={`${textPrimary} leading-relaxed text-sm break-words`}>{status.update}</p>
                          </div>
                        )}
                        {canEdit && !statusEditState.isEditing && (
                          <div className="flex justify-end mt-2">
                            <span className="text-xs text-blue-400">You can edit this status update</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className={`border-t ${borderColor} p-3 ${bgSecondary}`}>
            {chatTab === 'chat' && (
              <div className="flex gap-2">
                <input
                  className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} placeholder-${textTertiary} focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm`}
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button
                  className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            )}
            {chatTab === 'task' && (
              <div className="space-y-2">
                <input
                  className={`w-full px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} placeholder-${textTertiary} focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm`}
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                />
                <input
                  className={`w-full px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} placeholder-${textTertiary} focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm`}
                  placeholder="Task description"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm`}
                    value={newTask.assignee}
                    onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                  >
                    <option value="">{currentUser.isOrgAdmin ? 'Select Assignee' : 'Assign to yourself'}</option>
                    {currentUser.isOrgAdmin
                      ? dfUsers.map(user => (
                          <option key={user.id} value={user.name}>
                            {user.name} {user.name === currentUser.displayName ? '(You)' : ''}
                          </option>
                        ))
                      : (
                          <option value={currentUser.displayName}>
                            {currentUser.displayName} (You)
                          </option>
                        )}
                  </select>
                  <input
                    type="date"
                    className={`px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm`}
                    value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                  <select
                    className={`px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-semibold`}
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg whitespace-nowrap"
                    onClick={handleAddTask}
                    disabled={!newTask.title.trim() || !newTask.description.trim()}
                  >
                    <CheckSquare size={18} />
                  </button>
                </div>
                {!currentUser.isOrgAdmin && (
                  <div className="text-xs text-blue-400 flex items-center gap-1">
                    <span>Info</span>
                    <span>You can only assign tasks to yourself. Organization Administrators can assign to any team member.</span>
                  </div>
                )}
              </div>
            )}
            {chatTab === 'status' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className={`sm:w-36 px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm font-semibold`}
                  value={statusMood}
                  onChange={e => setStatusMood(e.target.value as any)}
                >
                  <option value="good">On Track</option>
                  <option value="neutral">In Progress</option>
                  <option value="blocked">Blocked</option>
                </select>
                <input
                  className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${bgTertiary} ${textPrimary} placeholder-${textTertiary} focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm`}
                  placeholder="Share your daily progress, accomplishments, and any blockers..."
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button
                  className="px-5 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg whitespace-nowrap"
                  onClick={handleAddStatus}
                  disabled={!newStatus.trim()}
                >
                  <Activity size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Team Members Section */}
        {selectedProject && (
          <div className={`${bgSecondary} rounded-xl p-5 mt-6 shadow-lg border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                <Users className="w-5 h-5 text-blue-400" />
                Team Members
              </h3>
              <button className={`p-2 ${bgTertiary} rounded-lg ${textSecondary} ${hoverBg} transition-all`}>
                <Users className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {selectedProject.teamMembers.map((member, index) => {
                const isCurrentUser = member.email?.toLowerCase() === currentUser.email.toLowerCase() ||
                  `${member.name.toLowerCase().replace(/\s+/g, '.')}@ubtiinc.com` === currentUser.email.toLowerCase();
                return (
                  <div
                    key={index}
                    className={`${bgTertiary} rounded-lg p-3 border ${borderColor} hover:shadow-md transition-all ${isCurrentUser ? 'ring-1 ring-blue-500/30' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${textPrimary} text-sm truncate`}>{member.name}</p>
                        <p className={`text-xs ${textTertiary} truncate`}>{member.role || 'Team Member'}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`${textSecondary}`}>{member.allocatedHours}h allocated</span>
                      {isCurrentUser && (
                        <span className="text-blue-400 font-medium">(You)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-8 text-center text-xs ${textTertiary}`}>
          <p>
            Powered by <span className="font-bold text-blue-400">Diligence Fabric</span> • Real-time Collaboration •
            Sentiment Analysis
          </p>
          <p className="mt-1">
            {new Date().getFullYear()} © UBTI Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;