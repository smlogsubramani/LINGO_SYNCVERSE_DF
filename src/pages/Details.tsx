import React, { useState, useEffect } from 'react';
import {
  Users,
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
  Search,
  GitPullRequest,
  Eye
} from 'lucide-react';
import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
// import { useAuth } from '../contexts/Authcontext';
import { getDiligenceFabricSDK } from '../services/DFService';
import { GetUserAppRole } from '@ubti/diligence-fabric-sdk/build/main/types/userapprole/request/get-user-app-role';

// === INTERFACES ===
interface TeamMember {
  name: string;
  allocatedHours: number;
}
interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  hoursImpact: number;
  priority: 'low' | 'medium' | 'high';
  applied?: boolean; // indicates if we've already applied approved CR to project
  estimatedEndDate?: string | null; // NEW: optional estimated end date from CR
}
interface Project {
  id: string;
  name: string;
  description: string;
  teamMembers: TeamMember[];
  totalEfforts: number;
  remainingHours: number;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  manager: string;
  createdAt: string;
  changeRequests?: ChangeRequest[];
}
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'Active' | 'Inactive';
}
interface DFUser {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role?: string; // Add role field
  appRoles?: any[]; // Add app roles array
}
interface AddProjectModalProps {
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'remainingHours'>) => void;
  adminEmail: string;
  fetchDFUsers: () => Promise<void>;
  dfUsers: DFUser[]; // Add this line
  loadingDFUsers: boolean; // Add this line
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const ProjectDetails: React.FC = () => {
  // const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState<Project | null>(null);
  const [showChangeRequest, setShowChangeRequest] = useState<Project | null>(null);
  const [showCRHistory, setShowCRHistory] = useState<Project | null>(null); // NEW: CR history modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  // Get the organization role
  const [currentUserRole, setCurrentUserRole] = useState<'ORGADM' | 'TENUSER' | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  //app roles state
  const [approle, setapprole] = useState<string>(''); // Example : Admin , sub-admin , foreign-admin
  const [adminEmail, setAdminEmail] = useState<string>(''); // if admin this state will be filled
  // NEW: delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  //*df users 
  const [dfUsers, setDfUsers] = useState<DFUser[]>([]);
  const [loadingDFUsers, setLoadingDFUsers] = useState<boolean>(false);

  const projectsCollection = collection(db, 'projects');
  const usersCollection = collection(db, 'users');

  // === USER DATA FROM TOKEN & LOCALSTORAGE ===
  const getUserData = () => {
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

        return {
          token: data.Token,
          tenantID: data.TenantID,
          userEmail: tokenClaims.Email || tokenClaims.UserName || '',
          userName: tokenClaims.UserName || '',
          role,
          isOrgAdmin
        };
      }
    } catch (error) {
      console.error('Error parsing token:', error);
    }
    return {
      token: data.Token,
      tenantID: data.TenantID,
      userEmail: data.UserName || '',
      userName: data.UserName || '',
      role: 'TENUSER',
      isOrgAdmin: false
    };
  };

  // === HARD DELETE FUNCTION ===
 // === HARD DELETE FUNCTION ===
const hardDeleteProject = async (projectId: string) => {
  try {
    setDeletingProjectId(projectId);
    console.log('Attempting to delete project:', projectId);
    const projectRef = doc(db, 'projects', projectId);
    
    await deleteDoc(projectRef);
    
    console.log('Project successfully deleted from Firestore:', projectId);

    // Remove from local state immediately for responsive UI
    setProjects(prev => prev.filter(project => project.id !== projectId));
    
  } catch (error) {
    console.error('Error deleting project from Firestore:', error);
    console.error('Project ID that failed to delete:', projectId);
    throw error;
  } finally {
    setDeletingProjectId(null);
  }
};

  // Add this function near your other helper functions
 const fetchDFUsers = async () => {
  try {
    setLoadingDFUsers(true);
    const userData = getUserData();
    if (!userData.token) throw new Error('No authentication token found.');

    const client = getDiligenceFabricSDK();
    if (!client) throw new Error('Failed to initialize Diligence Fabric SDK');
    client.setAuthUser({ Token: userData.token });

    const requestBody = { tenantID: userData.tenantID };
    const appRoleService = client.getApplicationRoleService();
    const response = await appRoleService.getUserAppRole(requestBody);

    if (Array.isArray(response?.Result)) {
      const users: DFUser[] = await Promise.all(
        response.Result.map(async (user: any) => {
          // Build name and email
          const { name, email } = buildNameAndEmail(user.UserName);
          
          // Parse app roles if available
          let role = 'User'; // Default role
          let appRoles: any[] = [];
          
          try {
            if (user.AppRoles) {
              appRoles = JSON.parse(user.AppRoles);
              // Find the highest role or specific role logic
              const adminRole = appRoles.find((r: any) => r.AppRoleName === 'Admin');
              if (adminRole) {
                role = 'Admin';
              } else if (appRoles.length > 0) {
                role = appRoles[0].AppRoleName || 'User';
              }
            }
          } catch (error) {
            console.error('Error parsing app roles for user:', user.UserName, error);
          }

          return {
            id: user.UserID,
            name,
            email,
            organization: user.OrganizationName || 'N/A',
            role,
            appRoles
          };
        })
      );
      
      setDfUsers(users);
      console.log('DF Users with roles:', users);
    }
  } catch (error) {
    console.error('Error fetching DF users:', error);
    setDfUsers([]);
  } finally {
    setLoadingDFUsers(false);
  }
};
  // Add near your other helper functions
  const buildNameAndEmail = (dfUserName: string) => {
    if (!dfUserName || typeof dfUserName !== 'string') {
      return { name: 'Unknown User', email: 'unknown@ubtiinc.com' };
    }
    const atIndex = dfUserName.indexOf('@');
    if (atIndex === -1) {
      return { name: dfUserName, email: `${dfUserName}@ubtiinc.com` };
    }
    const namePart = dfUserName.substring(0, atIndex);
    return { name: namePart, email: dfUserName };
  };

  // === CONFIRMATION HANDLER ===
const confirmHardDelete = async (projectId: string) => {
  try {
    await hardDeleteProject(projectId);
    console.log('Project permanently deleted successfully');
  } catch (err: any) {
    console.error('Hard delete failed', err);
    alert(`Failed to delete project: ${err.message || 'Unknown error'}`);
  } finally {
    // Only close the modal after deletion is complete (success or failure)
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  }
};

  // === FETCH USERS & RESOLVE CURRENT USER ===
  const fetchUsersAndCurrentUser = async () => {
    try {
      const userData = getUserData();
      setCurrentUserRole(userData.isOrgAdmin ? 'ORGADM' : 'TENUSER');
      setCurrentUserEmail(userData.userEmail.toLowerCase());

      const usersQuery = query(usersCollection);
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);
      console.log(users)

      const currentUser = usersData.find(u =>
        u.email.toLowerCase() === userData.userEmail.toLowerCase() ||
        u.name.toLowerCase() === userData.userName.toLowerCase()
      );

      let resolvedName = '';
      if (currentUser) {
        resolvedName = currentUser.name;
      } else {
        resolvedName = userData.userName || userData.userEmail.split('@')[0] || 'unknown_user';
      }

      setCurrentUserName(resolvedName.toLowerCase());
      console.log('Resolved currentUserName:', resolvedName);
    } catch (error) {
      console.error('Error fetching users:', error);
      const userData = getUserData();
      setCurrentUserRole(userData.isOrgAdmin ? 'ORGADM' : 'TENUSER');
      setCurrentUserEmail(userData.userEmail.toLowerCase());
      const fallbackName = userData.userName || userData.userEmail.split('@')[0] || 'unknown';
      setCurrentUserName(fallbackName.toLowerCase());
    }
  };

  // === GET APP ROLE INFO === //
  const UserAppInfo = async () => {
    try {
      const userData = getUserData();
      // Use tenantID from token/localstorage if available otherwise fallback to 282
      const tenantID = userData.tenantID || 282;
      const dummy: GetUserAppRole = {
        tenantID,
      };
      const sdk = getDiligenceFabricSDK();
      const appRoleService = sdk.getApplicationRoleService();
      const response = await appRoleService.getUserAppRole(dummy, 'read');
      console.log('Response:', response);

      const appRolesString = response?.Result?.[0]?.AppRoles;
      const adminemail = response?.Result?.[0]?.UserName;

      if (!appRolesString) {
        console.warn('⚠️ No AppRoles found in the response.');
        return;
      }

      const appRoles = JSON.parse(appRolesString);
      console.log('Parsed AppRoles:', appRoles);

      // find Admin role (case-sensitive in payload) and fallback to first role
      const adminRole = appRoles.find((role: any) => role.AppRoleName === 'Admin');
      if (adminRole) {
        const formattedEmail = adminemail ? adminemail.split('@')[0] : '';
        setAdminEmail(formattedEmail);
        setapprole(adminRole.AppRoleName); // string "Admin"
        console.log('✅ Admin Role Found:', adminRole);
      } else {
        // fallback to first role or empty string
        const firstRoleName = appRoles[0]?.AppRoleName || '';
        setapprole(firstRoleName);
        console.log('❌ Admin role not found. Using first role:', firstRoleName);
      }
    } catch (error) {
      console.error('Error fetching user app role:', error);
    }
  };

  // === TYPE GUARD ===
  const isTeamMemberObject = (member: any): member is TeamMember => {
    return typeof member === 'object' && member !== null && 'name' in member;
  };

  // === ACCESS CHECK ===
  const userHasAccessToProject = (project: Project, userName: string) => {
    if (!project.teamMembers || project.teamMembers.length === 0) return false;

    return project.teamMembers.some((member: TeamMember | string) => {
      if (typeof member === 'string') {
        return member.toLowerCase() === userName.toLowerCase();
      } else if (isTeamMemberObject(member)) {
        if (member.name) {
          return member.name.toLowerCase() === userName.toLowerCase();
        }
      }
      const memberObj = member as any;
      if (memberObj.email) {
        const memberName = memberObj.email.split('@')[0];
        return memberName.toLowerCase() === userName.toLowerCase();
      }
      return false;
    });
  };

  // === RESPONSIVE CHECK ===
  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Add this useEffect in the main component to fetch DF users when edit modal opens
  useEffect(() => {
    if (showEditProject && dfUsers.length === 0) {
      fetchDFUsers();
    }
  }, [showEditProject, dfUsers.length, fetchDFUsers]);

  // Fetch DF users when add project modal opens
  useEffect(() => {
    if (showAddProject) {
      fetchDFUsers();
    }
  }, [showAddProject]);

  // === FETCH PROJECTS ===
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        await fetchUsersAndCurrentUser();
        await UserAppInfo();

        const q = query(projectsCollection, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const projectsList = querySnapshot.docs
          .map(doc => {
            const projectData = doc.data();
            return { id: doc.id, ...projectData } as any;
          })
          .map(projectData => {
            const totalEfforts = projectData.totalEfforts || 0;
            const remainingHours = calculateRemainingHoursByDates(
              projectData.startDate,
              projectData.endDate,
              totalEfforts
            );

            return {
              id: projectData.id,
              ...projectData,
              teamMembers: projectData.teamMembers || [],
              changeRequests: projectData.changeRequests || [],
              remainingHours
            } as Project;
          });

        setProjects(projectsList);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === ORGADM: SEE ALL PROJECTS ===
  useEffect(() => {
    if (currentUserRole === 'ORGADM' && projects.length > 0) {
      setFilteredProjects(projects);
    }
  }, [projects, currentUserRole]);

  // === TENUSER: SEE ONLY THEIR PROJECTS ===
  useEffect(() => {
    if (!projects || projects.length === 0) { //**handle last project delete
      setFilteredProjects([]);
      return;
    }
    if (currentUserRole === 'TENUSER' && currentUserName && projects.length > 0) {
      const filtered = projects.filter(project =>
        userHasAccessToProject(project, currentUserName)
      );
      setFilteredProjects(filtered);
    } else if (currentUserRole === 'TENUSER' && projects.length > 0) {
      setFilteredProjects([]); // Safety
    }
  }, [projects, currentUserRole, currentUserName]);

  // === DYNAMIC CALCULATION FUNCTIONS ===
  const calculateProgressByDates = (startDate: string, endDate: string): number => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();

    if (isNaN(start) || isNaN(end)) return 0;
    if (now < start) return 0;
    if (now >= end || start === end) return 100;

    const totalDuration = end - start;
    const elapsedDuration = now - start;
    const progress = Math.round((elapsedDuration / totalDuration) * 100);
    return Math.min(Math.max(progress, 0), 100);
  };

  const calculateRemainingHoursByDates = (startDate: string, endDate: string, totalEfforts: number): number => {
    const progress = calculateProgressByDates(startDate, endDate);
    const remainingPercentage = (100 - progress) / 100;
    const remainingHours = Math.round(totalEfforts * remainingPercentage);
    return Math.max(0, remainingHours);
  };

  // === AUTO UPDATE PROGRESS AND REMAINING HOURS (unchanged) ===
  useEffect(() => {
    const updateRealTimeMetrics = () => {
      setProjects(prevProjects =>
        prevProjects.map(project => {
          if (project.status === 'active') {
            const realTimeProgress = calculateProgressByDates(project.startDate, project.endDate);
            const realTimeRemainingHours = calculateRemainingHoursByDates(
              project.startDate, 
              project.endDate, 
              project.totalEfforts
            );
            
            if (Math.abs(realTimeProgress - project.progress) >= 1 || 
                Math.abs(realTimeRemainingHours - project.remainingHours) >= 1) {
              
              updateDoc(doc(db, 'projects', project.id), {
                progress: realTimeProgress,
                remainingHours: realTimeRemainingHours
              }).catch(console.error);
              
              return { 
                ...project, 
                progress: realTimeProgress, 
                remainingHours: realTimeRemainingHours 
              };
            }
          }
          return project;
        })
      );
    };

    updateRealTimeMetrics();
    const interval = setInterval(updateRealTimeMetrics, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // === NEW: Automatically apply approved (but not-yet-applied) change requests ===
  useEffect(() => {
    // Process each project with approved & not-applied CRs
    const processApprovedChangeRequests = async () => {
      // gather projects that need processing
      for (const project of projects) {
        const crs = project.changeRequests || [];
        // find approved CRs that are not yet applied
        const pendingApprovedCRs = crs.filter(cr => cr.status === 'approved' && !cr.applied);
        if (pendingApprovedCRs.length === 0) continue;

        try {
          // sum hoursImpact for all un-applied approved CRs for this project
          const totalHoursImpact = pendingApprovedCRs.reduce((acc, cr) => acc + (cr.hoursImpact || 0), 0);
          // If any CR provides an estimatedEndDate, prefer the latest date among them (you can change behavior)
          const estimatedDates = pendingApprovedCRs
            .map(cr => cr.estimatedEndDate)
            .filter(Boolean) as string[];
          // choose latest date if multiple provided
          let newEndDate = project.endDate;
          if (estimatedDates.length > 0) {
            const latest = estimatedDates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
            newEndDate = latest;
          }

          const newTotalEfforts = (project.totalEfforts || 0) + totalHoursImpact;

          // compute new progress & remainingHours according to project.status and possibly updated endDate
          let newProgress = project.progress;
          let newRemainingHours = project.remainingHours;

          if (project.status === 'completed') {
            newProgress = 100;
            newRemainingHours = 0;
          } else if (project.status === 'planning') {
            newProgress = 0;
            newRemainingHours = newTotalEfforts;
          } else if (project.status === 'on-hold') {
            // preserve progress, but increase remaining by the hoursImpact
            newRemainingHours = Math.max(0, (project.remainingHours || 0) + totalHoursImpact);
          } else {
            // active or other -> calculate by dates using updated total efforts and possibly updated endDate
            newProgress = calculateProgressByDates(project.startDate, newEndDate);
            newRemainingHours = calculateRemainingHoursByDates(project.startDate, newEndDate, newTotalEfforts);
          }

          // mark these CRs as applied so they won't be applied again
          const updatedCRs = crs.map(cr => {
            if (cr.status === 'approved' && !cr.applied) {
              return { ...cr, applied: true };
            }
            return cr;
          });

          const updates: any = {
            totalEfforts: newTotalEfforts,
            progress: newProgress,
            remainingHours: newRemainingHours,
            changeRequests: updatedCRs
          };

          // Only set endDate if we have a newEndDate different from current
          if (newEndDate && newEndDate !== project.endDate) {
            updates.endDate = newEndDate;
          }

          // Persist the updates for this project to Firestore
          await updateDoc(doc(db, 'projects', project.id), updates);

          // Update local state for this single project (keeps UI in sync)
          setProjects(prev =>
            prev.map(p => (p.id === project.id ? { ...p, ...updates } : p))
          );
        } catch (err) {
          console.error('Error processing approved change requests for project', project.id, err);
          // continue processing other projects
        }
      }
    };

    // fire and forget (but we await inside loop). Called whenever projects changes.
    processApprovedChangeRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // === UTILS ===
  const generateProjectId = (projectName: string): string => {
    if (!projectName || typeof projectName !== 'string') return '';
    return projectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const getRealTimeProgress = (project: Project): number => {
    if (project.status === 'completed') return 100;
    if (project.status === 'planning') return 0;
    if (project.status === 'on-hold') return project.progress;
    return calculateProgressByDates(project.startDate, project.endDate);
  };

  const getRealTimeRemainingHours = (project: Project): number => {
    if (project.status === 'completed') return 0;
    if (project.status === 'planning') return project.totalEfforts;
    if (project.status === 'on-hold') return project.remainingHours;
    return calculateRemainingHoursByDates(project.startDate, project.endDate, project.totalEfforts);
  };

  const addProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'remainingHours'>) => {
    try {
      const projectId = generateProjectId(projectData.name);
      if (!projectId) throw new Error('Project name is required and must contain valid characters.');
      const existingProject = projects.find(p => p.id === projectId);
      if (existingProject) throw new Error('A project with this name already exists.');

      let progress = projectData.progress;
      let remainingHours = projectData.totalEfforts;

      if (projectData.status === 'active') {
        progress = calculateProgressByDates(projectData.startDate, projectData.endDate);
        remainingHours = calculateRemainingHoursByDates(
          projectData.startDate, 
          projectData.endDate, 
          projectData.totalEfforts
        );
      } else if (projectData.status === 'planning') {
        progress = 0;
        remainingHours = projectData.totalEfforts;
      } else if (projectData.status === 'completed') {
        progress = 100;
        remainingHours = 0;
      }

      const projectRef = doc(db, 'projects', projectId);
      const payload = {
        ...projectData,
        progress,
        remainingHours,
        createdAt: new Date().toISOString(),
      };
      await setDoc(projectRef, payload);
      const newProject: Project = { id: projectId, ...payload };
      setProjects(prev => [newProject, ...prev]);
      return projectId;
    } catch (error: any) {
      console.error('Error adding project:', error);
      alert(error.message || 'Failed to create project.');
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const currentProject = projects.find(p => p.id === projectId);
      if (!currentProject) return;

      let progress = updates.progress !== undefined ? updates.progress : currentProject.progress;
      let remainingHours = updates.remainingHours !== undefined ? updates.remainingHours : currentProject.remainingHours;

      if (updates.status === 'active' || 
          (updates.startDate || updates.endDate) && 
          updates.status !== 'completed') {
        
        const startDate = updates.startDate || currentProject.startDate;
        const endDate = updates.endDate || currentProject.endDate;
        const totalEfforts = updates.totalEfforts || currentProject.totalEfforts;
        
        progress = calculateProgressByDates(startDate, endDate);
        remainingHours = calculateRemainingHoursByDates(startDate, endDate, totalEfforts);
        
        updates.progress = progress;
        updates.remainingHours = remainingHours;
      }

      if (updates.status === 'completed') {
        updates.progress = 100;
        updates.remainingHours = 0;
      }
      if (updates.status === 'planning') {
        updates.progress = 0;
        updates.remainingHours = updates.totalEfforts || currentProject.totalEfforts;
      }

      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, updates);
      setProjects(prev =>
        prev.map(project =>
          project.id === projectId ? { ...project, ...updates } : project
        )
      );
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  // NOTE: when creating a new CR we set applied: false explicitly and collect estimatedEndDate
  const addChangeRequest = async (projectId: string, changeRequest: Omit<ChangeRequest, 'id'>) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const newChangeRequest: ChangeRequest = { ...changeRequest, id: Date.now().toString(), applied: false };
      const updatedChangeRequests = [...(project.changeRequests || []), newChangeRequest];
      await updateDoc(doc(db, 'projects', projectId), { changeRequests: updatedChangeRequests });
      setProjects(prev =>
        prev.map(p =>
          p.id === projectId ? { ...p, changeRequests: updatedChangeRequests } : p
        )
      );
    } catch (error) {
      console.error('Error adding change request:', error);
      throw error;
    }
  };

  const allocateHoursToTeamMembers = (teamMembers: TeamMember[], totalEfforts: number) => {
    if (teamMembers.length === 0) return [];
    const equalShare = Math.floor(totalEfforts / teamMembers.length);
    const remainder = totalEfforts % teamMembers.length;
    return teamMembers.map((member, index) => ({
      ...member,
      allocatedHours: equalShare + (index < remainder ? 1 : 0)
    }));
  };

  const searchedProjects = filteredProjects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
      case 'active': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
      case 'completed': return { bg: 'rgba(107, 114, 128, 0.1)', text: '#374151', border: 'rgba(107, 114, 128, 0.2)' };
      case 'on-hold': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
      default: return { bg: 'rgba(107, 114, 128, 0.1)', text: '#374151', border: 'rgba(107, 114, 128, 0.2)' };
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return '#ef4444';
    if (progress < 70) return '#f59e0b';
    return '#10b981';
  };

  // === MODALS ===
  const AddProjectModal: React.FC<AddProjectModalProps> = ({ 
    onClose, 
    onSave, 
    adminEmail, 
    dfUsers,
    loadingDFUsers 
  }) => {   
    const [formData, setFormData] = useState({
      name: '', description: '', teamMembers: [] as TeamMember[], totalEfforts: 0,
      startDate: '', endDate: '', progress: 0, status: 'planning' as any, manager: adminEmail ||'',
    });
    const [error, setError] = useState('');
       const [suggestions, setSuggestions] = useState<Array<{
      email: string;
      name: string;
      score: number;
      reason: string;
    }>>([]);
    const [suggLoading, setSuggLoading] = useState(false);
    const [suggError, setSuggError] = useState<string | null>(null);

    const debouncedDesc = useDebounce(formData.description, 600);

    useEffect(() => {
      if (!debouncedDesc.trim() || dfUsers.length === 0) {
        setSuggestions([]);
        return;
      }

      const run = async () => {
        setSuggLoading(true);
        setSuggError(null);
        try {
          const payload = {
            projectDescription: debouncedDesc,
            developers: dfUsers.map(u => ({
              name: u.name,
              email: u.email,
              skills: [],
              experience: 0,
              bio: '',
            })),
          };

          const res = await fetch('https://document-summarizer-a5dk.onrender.com/api/match-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error('Failed to fetch matches');

          const data = await res.json();
          const matches = (data.matches || [])
            .slice(0, 3)
            .map((m: any) => {
              const user = dfUsers.find(u => u.email === m.email);
              return {
                email: m.email,
                name: user?.name ?? m.email.split('@')[0],
                score: m.score,
                reason: m.reason,
              };
            });
          setSuggestions(matches);
        } catch (e: any) {
          setSuggError(e.message ?? 'Error');
          setSuggestions([]);
        } finally {
          setSuggLoading(false);
        }
      };

      run();
    }, [debouncedDesc, dfUsers]);

    const removeTeamMember = (memberName: string) => {
      const newTeamMembers = formData.teamMembers.filter(m => m.name !== memberName);
      const allocatedMembers = allocateHoursToTeamMembers(newTeamMembers, formData.totalEfforts);
      setFormData(prev => ({ ...prev, teamMembers: allocatedMembers }));
    };

    const handleTotalEffortsChange = (efforts: number) => {
      const allocatedMembers = allocateHoursToTeamMembers(formData.teamMembers, efforts);
      setFormData(prev => ({ ...prev, totalEfforts: efforts, teamMembers: allocatedMembers }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); setError('');
      if (formData.teamMembers.length === 0) { setError('Please add at least one team member'); return; }
      try { await onSave(formData); onClose(); } catch (error: any) { setError(error.message || 'Error saving project'); }
    };

    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={modalHeaderStyle}>
            <h2 style={modalTitleStyle}>Add New Project</h2>
            <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div><label style={labelStyle}>Project Name *</label><input type="text" required value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} style={inputStyle} placeholder="Enter project name" />
                <div style={helperTextStyle}>ID: {generateProjectId(formData.name) || 'project-name'}</div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} style={{...inputStyle, resize: 'vertical'}} placeholder="Project description..." />
                
                <div style={{ marginTop: '8px' }}>
                  {suggLoading && <div style={{ color: '#64748b', fontSize: '13px' }}>Searching best developers…</div>}
                  {suggError && <div style={{ color: '#dc2626', fontSize: '13px' }}>{suggError}</div>}
                  {suggestions.length > 0 && (
  <div style={{
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '13px'
  }}>
    <div style={{
      fontWeight: '600',
      color: '#1e293b',
      marginBottom: '8px',
      fontSize: '14px'
    }}>
      Top Developer Matches
    </div>

    {suggestions.map((s, idx) => (
      <div
        key={s.email}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '8px 0',
          borderBottom: idx < suggestions.length - 1 ? '1px solid #e2e8f0' : 'none',
          gap: '12px'
        }}
      >
        {/* LEFT: Name + Email */}
        <div style={{
          flex: '1 1 55%',
          minWidth: '140px',
          overflow: 'hidden'
        }}>
          <div style={{
            fontWeight: '600',
            color: '#1e293b',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {s.name}
          </div>
          <div style={{
            color: '#64748b',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {s.email.split('@')[0]}
          </div>
        </div>

        {/* RIGHT: Score + Reason */}
        <div style={{
          flex: '1 1 45%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          textAlign: 'right'
        }}>
          <div style={{
            fontWeight: '700',
            fontSize: '14px',
            color:
              s.score >= 0.8 ? '#10b981' :
              s.score >= 0.6 ? '#f59e0b' :
              '#ef4444'
          }}>
            {(s.score * 100).toFixed(0)}%
          </div>
          <div style={{
            color: '#475569',
            fontSize: '11px',
            lineHeight: '1.3',
            maxWidth: '180px',
            wordWrap: 'break-word'
          }}>
            {s.reason}
          </div>
        </div>
      </div>
    ))}
  </div>
  
)}
  </div>            </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Start Date *</label><input type="date" required value={formData.startDate} onChange={e => setFormData(p => ({...p, startDate: e.target.value}))} style={inputStyle} /></div>
                <div><label style={labelStyle}>End Date *</label><input type="date" required value={formData.endDate} onChange={e => setFormData(p => ({...p, endDate: e.target.value}))} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Total Efforts (hours) *</label><input type="number" required min="0" value={formData.totalEfforts} onChange={e => handleTotalEffortsChange(parseInt(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Progress (%)</label><input type="number" min="0" max="100" value={formData.progress} onChange={e => setFormData(p => ({...p, progress: parseInt(e.target.value) || 0}))} style={inputStyle} disabled={formData.status === 'active'} />
                  {formData.status === 'active' && <div style={helperTextStyle}>Progress auto-calculated for active projects</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Status *</label><select value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value as any}))} style={inputStyle}>
                  <option value="planning">Planning</option><option value="active">Active</option><option value="on-hold">On Hold</option><option value="completed">Completed</option>
                </select></div>
                <div><label style={labelStyle}>Manager *</label><input type="text" required value={formData.manager} onChange={e => setFormData(p => ({...p, manager: e.target.value}))} style={inputStyle} placeholder="Project manager name" /></div>
              </div>
              <div>
                <label style={labelStyle}>Add Team Member from DF Users</label>
                {loadingDFUsers ? (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'center', marginBottom: '12px' }}>
                    Loading DF users...
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                    <select
                      onChange={(e) => {
                        const selectedUser = dfUsers.find(u => u.email === e.target.value);
                        if (selectedUser) {
                          const { name } = buildNameAndEmail(selectedUser.name);
                          if (!formData.teamMembers.some(m => m.name === name.trim())) {
                            const newTeamMembers = [...formData.teamMembers, { name: name.trim(), allocatedHours: 0 }];
                            const allocatedMembers = allocateHoursToTeamMembers(newTeamMembers, formData.totalEfforts);
                            setFormData(prev => ({ ...prev, teamMembers: allocatedMembers }));
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        color: '#1e293b',
                        outline: 'none',
                        marginBottom: '12px'
                      }}
                      defaultValue=""
                    >
                      <option value="">Select a DF user to add as team member...</option>
                      {dfUsers
                        .filter(user => {
                          if (currentUserRole === 'ORGADM') {
                            const isCurrentUser = user.email.toLowerCase() === currentUserEmail.toLowerCase();
                            return !isCurrentUser;
                          }
                          return true;
                        })
                        .map((user) => (
                          <option key={user.id} value={user.email}>
                            {user.name} - {user.email} {user.role ? `(${user.role})` : ''}
                          </option>
                        ))}
                    </select>
                    <div style={helperTextStyle}>
                      Only Diligence Fabric users can be added as team members
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  {formData.teamMembers.length > 0 ? (
                    <div style={teamMembersContainerStyle}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                        Team Members ({formData.teamMembers.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {formData.teamMembers.map((member, i) => (
                          <div key={i} style={teamMemberTagStyle}>
                            <Users size={12} style={{ color: '#3b82f6' }} />
                            <span style={{ fontWeight: '500' }}>{member.name}</span>
                            <span style={{ fontWeight: '600', color: '#3b82f6' }}>{member.allocatedHours}h</span>
                            <button type="button" onClick={() => removeTeamMember(member.name)} style={removeMemberButtonStyle}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={noMembersStyle}>No team members added yet</div>
                  )}
                </div>
              </div>
            </div>
            <div style={modalActionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
              <button type="submit" style={saveButtonStyle}><Save size={16} /> Save Project</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Update the EditProjectModal to fix the blinking issue
  const EditProjectModal: React.FC<{ 
    project: Project; 
    onClose: () => void; 
    onSave: (projectId: string, updates: Partial<Project>) => void; 
    adminEmail: string;
    fetchDFUsers: () => Promise<void>;
    dfUsers: DFUser[];
    loadingDFUsers: boolean;
  }> = ({ project, onClose, onSave, fetchDFUsers, dfUsers, loadingDFUsers }) => {
    const [formData, setFormData] = useState({
      name: project.name, 
      description: project.description, 
      teamMembers: project.teamMembers,
      totalEfforts: project.totalEfforts, 
      startDate: project.startDate, 
      endDate: project.endDate,
      progress: project.progress, 
      status: project.status, 
      manager: project.manager,
    });
    const [currentMember, setCurrentMember] = useState('');
    const [showMemberInput, setShowMemberInput] = useState(false);
    const [error, setError] = useState('');
    const [hasFetchedDFUsers, setHasFetchedDFUsers] = useState(false);

    // Fetch DF users when modal opens - only once
    useEffect(() => {
      if (!hasFetchedDFUsers && dfUsers.length === 0) {
        fetchDFUsers();
        setHasFetchedDFUsers(true);
      }
    }, [fetchDFUsers, dfUsers.length, hasFetchedDFUsers]);

    const addTeamMember = () => {
      if (currentMember.trim()) {
        if (formData.teamMembers.some(m => m.name === currentMember.trim())) {
          setError('Team member already exists'); 
          return;
        }
        const newTeamMembers = [...formData.teamMembers, { name: currentMember.trim(), allocatedHours: 0 }];
        const allocatedMembers = allocateHoursToTeamMembers(newTeamMembers, formData.totalEfforts);
        setFormData(prev => ({ ...prev, teamMembers: allocatedMembers }));
        setCurrentMember(''); 
        setShowMemberInput(false); 
        setError('');
      }
    };

    const removeTeamMember = (memberName: string) => {
      const newTeamMembers = formData.teamMembers.filter(m => m.name !== memberName);
      const allocatedMembers = allocateHoursToTeamMembers(newTeamMembers, formData.totalEfforts);
      setFormData(prev => ({ ...prev, teamMembers: allocatedMembers }));
    };

    const handleTotalEffortsChange = (efforts: number) => {
      const allocatedMembers = allocateHoursToTeamMembers(formData.teamMembers, efforts);
      setFormData(prev => ({ ...prev, totalEfforts: efforts, teamMembers: allocatedMembers }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); 
      setError('');
      if (formData.teamMembers.length === 0) { 
        setError('Please add at least one team member'); 
        return; 
      }
      try { 
        await onSave(project.id, formData); 
        onClose(); 
      } catch (error: any) { 
        setError(error.message || 'Error updating project'); 
      }
    };

    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={modalHeaderStyle}>
            <h2 style={modalTitleStyle}>Edit Project</h2>
            <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Project Name *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                  style={inputStyle} 
                />
                <div style={helperTextStyle}>Project ID: {project.id}</div>
              </div>
              
              <div>
                <label style={labelStyle}>Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData(p => ({...p, description: e.target.value}))} 
                  rows={3} 
                  style={{...inputStyle, resize: 'vertical'}} 
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Start Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.startDate} 
                    onChange={e => setFormData(p => ({...p, startDate: e.target.value}))} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.endDate} 
                    onChange={e => setFormData(p => ({...p, endDate: e.target.value}))} 
                    style={inputStyle} 
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Total Efforts (hours) *</label>
                  <input 
                    type="number" 
                    required 
                    min="0" 
                    value={formData.totalEfforts} 
                    onChange={e => handleTotalEffortsChange(parseInt(e.target.value) || 0)} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>Progress (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={formData.progress} 
                    onChange={e => setFormData(p => ({...p, progress: parseInt(e.target.value) || 0}))} 
                    style={inputStyle} 
                    disabled={formData.status === 'active'} 
                  />
                  {formData.status === 'active' && <div style={helperTextStyle}>Progress auto-calculated for active projects</div>}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Status *</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData(p => ({...p, status: e.target.value as any}))} 
                    style={inputStyle}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Manager *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.manager} 
                    onChange={e => setFormData(p => ({...p, manager: e.target.value}))} 
                    style={inputStyle} 
                  />
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Add Team Member from DF Users</label>
                
                {loadingDFUsers ? (
                  <div style={{ 
                    padding: '12px 16px', 
                    borderRadius: '10px', 
                    border: '1px solid #e2e8f0', 
                    backgroundColor: '#f8fafc', 
                    color: '#64748b', 
                    textAlign: 'center',
                    marginBottom: '12px'
                  }}>
                    Loading DF users...
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                   <select
  onChange={(e) => {
    const selectedUser = dfUsers.find(u => u.email === e.target.value);
    if (selectedUser) {
      const { name } = buildNameAndEmail(selectedUser.name);
      if (!formData.teamMembers.some(m => m.name === name.trim())) {
        const newTeamMembers = [...formData.teamMembers, { 
          name: name.trim(), 
          allocatedHours: 0,
          email: selectedUser.email,
          role: selectedUser.role
        }];
        const allocatedMembers = allocateHoursToTeamMembers(newTeamMembers, formData.totalEfforts);
        setFormData(prev => ({ ...prev, teamMembers: allocatedMembers }));
      }
    }
  }}
  style={{
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    backgroundColor: 'white',
    color: '#1e293b',
    outline: 'none',
    marginBottom: '12px'
  }}
  defaultValue=""
>
  <option value="">Select a DF user to add as team member...</option>
  {dfUsers
    .filter(user => {
      // Skip if this is the current ORGADM user
      if (currentUserRole === 'ORGADM') {
        const isCurrentUser = user.email.toLowerCase() === currentUserEmail.toLowerCase();
        return !isCurrentUser;
      }
      return true; // Show all users for non-ORGADM
    })
    .map((user) => (
      <option key={user.id} value={user.email}>
        {user.name} - {user.email} {user.role ? `(${user.role})` : ''}
      </option>
    ))}
</select>
                    <div style={helperTextStyle}>
                      Only Diligence Fabric users can be added as team members
                    </div>
                  </div>
                )}

                {/* Team members display */}
                <div style={{ marginBottom: '16px' }}>
                  {formData.teamMembers.length > 0 ? (
                    <div style={teamMembersContainerStyle}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                        Team Members ({formData.teamMembers.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {formData.teamMembers.map((member, i) => (
                          <div key={i} style={teamMemberTagStyle}>
                            <Users size={12} style={{ color: '#3b82f6' }} />
                            <span style={{ fontWeight: '500' }}>{member.name}</span>
                            <span style={{ fontWeight: '600', color: '#3b82f6' }}>{member.allocatedHours}h</span>
                            <button 
                              type="button" 
                              onClick={() => removeTeamMember(member.name)} 
                              style={removeMemberButtonStyle}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={noMembersStyle}>No team members added yet</div>
                  )}
                </div>

                {/* Keep the manual input option as fallback */}
                {showMemberInput ? (
                  <div style={addMemberContainerStyle}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={currentMember} 
                        onChange={e => setCurrentMember(e.target.value)} 
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTeamMember())} 
                        style={{...inputStyle, flex: 1, marginBottom: 0}} 
                        placeholder="Enter team member name" 
                        autoFocus 
                      />
                      <button type="button" onClick={addTeamMember} style={confirmAddButtonStyle}>
                        <Plus size={16} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowMemberInput(false); setCurrentMember(''); setError(''); }} 
                        style={cancelAddButtonStyle}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {error && <div style={errorTextStyle}>{error}</div>}
                  </div>
                ) : null}
                
                {formData.teamMembers.length > 0 && formData.totalEfforts > 0 && (
                  <div style={allocationInfoStyle}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Total: {formData.totalEfforts}h | {formData.teamMembers.length} members | Avg: {Math.floor(formData.totalEfforts / formData.teamMembers.length)}h
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div style={modalActionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
              <button type="submit" style={saveButtonStyle}>
                <Save size={16} /> Update Project
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ChangeRequestModal: React.FC<{ project: Project; onClose: () => void; onSave: (projectId: string, changeRequest: Omit<ChangeRequest, 'id'>) => void }> = ({ project, onClose, onSave }) => {
    const [formData, setFormData] = useState({
      title: '', description: '', hoursImpact: 0, priority: 'medium' as 'low' | 'medium' | 'high',
      estimatedEndDate: '' as string, // NEW: estimated end date input
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await onSave(project.id, {
          ...formData,
          requestedBy: currentUserName || 'Manager',
          requestedAt: new Date().toISOString(),
          status: 'pending',
          estimatedEndDate: formData.estimatedEndDate || null
        } as any);
        onClose();
      } catch (error) {
        console.error('Error adding change request:', error);
      }
    };

    return (
      <div style={modalOverlayStyle}>
        <div style={{ ...modalContentStyle, maxWidth: '520px' }}>
          <div style={modalHeaderStyle}>
            <h2 style={modalTitleStyle}>Add Change Request</h2>
            <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div><label style={labelStyle}>Title *</label><input type="text" required value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} style={inputStyle} placeholder="Brief title" /></div>
              <div><label style={labelStyle}>Description *</label><textarea required value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} style={{...inputStyle, resize: 'vertical'}} placeholder="Details..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Hours Impact *</label><input type="number" required min="0" value={formData.hoursImpact} onChange={e => setFormData(p => ({...p, hoursImpact: parseInt(e.target.value) || 0}))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Priority *</label><select value={formData.priority} onChange={e => setFormData(p => ({...p, priority: e.target.value as any}))} style={inputStyle}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Estimated End Date (optional)</label>
                  <input type="date" value={formData.estimatedEndDate} onChange={e => setFormData(p => ({...p, estimatedEndDate: e.target.value}))} style={inputStyle} />
                  <div style={helperTextStyle}>If provided and the CR is approved, project's End Date will be updated to this value.</div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1' }}>Project: {project.name}</div>
                <div style={{ fontSize: '12px', color: '#0c4a6e' }}>Current: {project.totalEfforts}h | Remaining: {getRealTimeRemainingHours(project)}h</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
              <button type="submit" style={saveButtonStyle}><GitPullRequest size={16} /> Submit Request</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

const DeleteConfirmationModal: React.FC<{ 
  project: Project | null; 
  onClose: () => void; 
  onConfirm: (projectId: string) => void;
  deletingProjectId: string | null;
}> = ({ project, onClose, onConfirm, deletingProjectId }) => {
  if (!project) return null;

  const isDeleting = deletingProjectId === project.id;

  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalContentStyle, maxWidth: '520px' }}>
        <div style={modalHeaderStyle}>
          <h2 style={modalTitleStyle}>
            {isDeleting ? 'Deleting Project...' : 'Confirm Permanent Delete'}
          </h2>
          {!isDeleting && (
            <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
          )}
        </div>

        <div style={{ padding: '8px 0 16px 0', color: '#374151' }}>
          {isDeleting ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Deleting project "{project.name}"...</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '16px' }}>
                Are you sure you want to permanently delete "{project.name}"?
              </div>
            </>
          )}
        </div>

        {!isDeleting && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={cancelButtonStyle}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(project.id)}
              style={{ 
                ...saveButtonStyle, 
                backgroundColor: '#dc2626',
                opacity: isDeleting ? 0.6 : 1
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

  // === NEW: CR History Modal ===
  const CRHistoryModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
    const crs = project.changeRequests || [];

    const formatDate = (iso?: string | null) => {
      if (!iso) return '-';
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    };

    const statusBadge = (status: ChangeRequest['status']) => {
      switch (status) {
        case 'approved':
          return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', label: 'Approved' };
        case 'rejected':
          return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', label: 'Rejected' };
        case 'pending':
        default:
          return { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: 'Pending' };
      }
    };

    return (
     <div style={modalOverlayStyle}>
  <div style={{ ...modalContentStyle, maxWidth: '1000px', width: '95%', maxHeight: '90vh' }}>
    <div style={modalHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '4px',
          height: '24px',
          backgroundColor: '#3b82f6',
          borderRadius: '2px'
        }} />
        <h2 style={modalTitleStyle}>Change Request History — {project.name}</h2>
      </div>
      <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
    </div>

    {crs.length === 0 ? (
      <div style={{ 
        padding: '60px 24px', 
        textAlign: 'center', 
        color: '#64748b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#f8fafc',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <GitPullRequest size={24} color="#94a3b8" />
        </div>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>No change requests</div>
        <div style={{ fontSize: '14px' }}>This project has no change requests yet.</div>
      </div>
    ) : (
      <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'separate', 
          borderSpacing: 0,
          minWidth: 900
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f8fafc',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              {[
                'Title',
                'Description', 
                'Requested By',
                'Requested At',
                'Status',
                'Hours',
                'Priority',
                'Estimated End',
                'Applied'
              ].map((header) => (
                <th key={header} style={{ 
                  padding: '16px 12px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e2e8f0',
                  whiteSpace: 'nowrap'
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crs.map((cr, index) => {
              const s = statusBadge(cr.status);
              const priorityConfig = {
                low: { color: '#10b981', bg: '#ecfdf5' },
                medium: { color: '#f59e0b', bg: '#fffbeb' },
                high: { color: '#ef4444', bg: '#fef2f2' }
              };
              const priority = priorityConfig[cr.priority] || priorityConfig.medium;
              
              return (
                <tr 
                  key={cr.id} 
                  style={{ 
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    transition: 'background-color 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                  }}
                >
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GitPullRequest size={14} color="#64748b" />
                      {cr.title}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top', 
                    color: '#475569',
                    maxWidth: '260px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {cr.description}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    fontSize: '14px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div style={{ fontWeight: '500' }}>{cr.requestedBy}</div>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    fontSize: '14px',
                    color: '#64748b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    {formatDate(cr.requestedAt)}
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <span style={{ 
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: s.bg,
                      color: s.color,
                      border: `1px solid ${s.border}`,
                      fontWeight: 600,
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    {cr.hoursImpact ?? '-'}h
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: priority.bg,
                      color: priority.color,
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {cr.priority}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    fontSize: '14px',
                    color: '#64748b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    {cr.estimatedEndDate ? new Date(cr.estimatedEndDate).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    verticalAlign: 'top',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: cr.applied ? '#dcfce7' : '#fef2f2',
                      color: cr.applied ? '#166534' : '#dc2626',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {cr.applied ? 'Applied' : 'Not Applied'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 0 0 0',
      borderTop: '1px solid #e2e8f0',
      marginTop: '20px'
    }}>
      <div style={{ fontSize: '14px', color: '#64748b' }}>
        Showing {crs.length} change request{crs.length !== 1 ? 's' : ''}
      </div>
      <button onClick={onClose} style={{
        padding: '10px 20px',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}>
        Close
      </button>
    </div>
  </div>
</div>
    );
  };

  const ProjectRow: React.FC<{ project: Project }> = ({ project }) => {
    const statusColors = getStatusColor(project.status);
    const realTimeProgress = getRealTimeProgress(project);
    const realTimeRemainingHours = getRealTimeRemainingHours(project);
    const progressColor = getProgressColor(realTimeProgress);

    // Helper for admin role check (case-insensitive)
    const isAdmin = approle?.toLowerCase() === 'admin';
    if (isAdmin) {
      console.log("Admin Access test", currentUserRole);
      console.log("Admin Access", dfUsers);
    }

    if (isMobile) {
      return (
        <div style={mobileCardStyle}>
          <div style={mobileCardHeaderStyle}>
            <div style={mobileProjectInfoStyle}>
              <div style={mobileProjectNameStyle}>{project.name}</div>
              <div style={mobileProjectManagerStyle}>Manager: {project.manager}</div>
            </div>
          </div>
          <div style={mobileQuickStatsStyle}>
            <div style={mobileStatStyle}><span style={mobileStatLabelStyle}>Status</span><span style={{...mobileStatusBadgeStyle, backgroundColor: statusColors.bg, color: statusColors.text, borderColor: statusColors.border}}>{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</span></div>
            <div style={mobileStatStyle}><span style={mobileStatLabelStyle}>Progress</span><span style={{ color: progressColor, fontWeight: '600' }}>{realTimeProgress}%</span></div>
            <div style={mobileStatStyle}><span style={mobileStatLabelStyle}>Hours</span><span style={{ fontWeight: '600', color: '#1e293b' }}>{project.totalEfforts}h</span></div>
            <div style={mobileStatStyle}><span style={mobileStatLabelStyle}>Remaining</span><span style={{ fontWeight: '600', color: '#ef4444' }}>{realTimeRemainingHours}h</span></div>
          </div>
          <div style={mobileActionsStyle}>
            {/* Eye button for mobile */}
            <button onClick={() => setShowCRHistory(project)} style={mobileChangeRequestButtonStyle}><Eye size={14} /> View CRs</button>

            {currentUserRole === 'ORGADM' && (
              <button onClick={() => setShowEditProject(project)} style={mobileEditButtonStyle}><Edit3 size={14} /> Edit</button>
            )}
            {/* Change request creation remains available to non-admins */}
            {currentUserRole === 'TENUSER' && (
              <button onClick={() => setShowChangeRequest(project)} style={mobileChangeRequestButtonStyle}><GitPullRequest size={14} /> Change</button>
            )}
            {currentUserRole === 'ORGADM' && (
              <button
                onClick={() => { setProjectToDelete(project); setShowDeleteConfirm(true); }}
                style={deleteButtonStyle}
                title="Delete"
                disabled={deletingProjectId === project.id}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
     <tr style={tableRowStyle}>
  <td style={tableCellStyle}><div><div style={projectNameStyle}>{project.name}</div><div style={projectDescriptionStyle}>{project.description}</div></div></td>
  <td style={tableCellStyle}>{project.manager}</td>
  <td style={tableCellStyle}>
    <div style={teamMembersStyle}>
      {project.teamMembers.map((member, i) => (
        <div key={i} style={teamMemberStyle}><Users size={12} style={{ color: '#3b82f6' }} /><span>{member.name}</span><span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '11px' }}>({member.allocatedHours}h)</span></div>
      ))}
    </div>
  </td>
  <td style={tableCellStyle}><div style={hoursStyle}><div style={{ fontWeight: '600', color: '#1e293b' }}>{project.totalEfforts}h</div><div style={{ fontSize: '12px', color: '#ef4444' }}>{realTimeRemainingHours}h remaining</div></div></td>
  <td style={tableCellStyle}>{new Date(project.startDate).toLocaleDateString()}</td>
  <td style={tableCellStyle}>{new Date(project.endDate).toLocaleDateString()}</td>
  <td style={tableCellStyle}>
    <div style={progressContainerStyle}>
      <div style={progressBarBackgroundStyle}><div style={{...progressBarFillStyle, width: `${realTimeProgress}%`, backgroundColor: progressColor}} /></div>
      <span style={progressTextStyle}>{realTimeProgress}%</span>
    </div>
  </td>
  <td style={tableCellStyle}><span style={{...statusBadgeStyle, backgroundColor: statusColors.bg, color: statusColors.text, borderColor: statusColors.border}}>{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</span></td>
  <td style={tableCellStyle}>
    <div style={changeRequestsStyle}>
      {project.changeRequests && project.changeRequests.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {project.changeRequests.map(cr => {
            const statusConfig = {
              approved: {
                label: cr.applied ? 'Approved' : 'Approved',
                bgColor: cr.applied ? '#dcfce7' : '#dbeafe',
                textColor: cr.applied ? '#166534' : '#1e40af',
                borderColor: cr.applied ? '#bbf7d0' : '#bfdbfe',
                icon: '✓'
              },
              rejected: {
                label: 'Rejected',
                bgColor: '#fee2e2',
                textColor: '#dc2626',
                borderColor: '#fecaca',
                icon: '✕'
              },
              pending: {
                label: 'Pending',
                bgColor: '#fffbeb',
                textColor: '#d97706',
                borderColor: '#fde68a',
                icon: '⏳'
              }
            };
            
            const config = statusConfig[cr.status] || statusConfig.pending;
            
            return (
              <div key={cr.id} style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${config.borderColor}`,
                backgroundColor: config.bgColor,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease'
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: config.textColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: config.textColor,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {config.icon}
                  </span>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={noChangesStyle}>None</div>
      )}
    </div>
  </td>
  <td style={stickyActionsCellStyle}>
    <div style={responsiveActionsStyle}>
      {/* Eye - show CR history (available to all roles) */}
      <button onClick={() => setShowCRHistory(project)} style={{ ...editButtonStyle, border: '1px solid #e6eefb', backgroundColor: '#f8fbff' }} title="View CRs"><Eye size={14} /></button>

      {currentUserRole === 'ORGADM' && (
        <button onClick={() => setShowEditProject(project)} style={editButtonStyle} title="Edit"><Edit3 size={14} /></button>
      )}
      {currentUserRole === 'TENUSER' && (
        <button onClick={() => setShowChangeRequest(project)} style={changeRequestButtonStyle} title="Change"><GitPullRequest size={14} /></button>
      )}
      {currentUserRole === 'ORGADM' && (
        <button
          onClick={() => { setProjectToDelete(project); setShowDeleteConfirm(true); }}
          style={deleteButtonStyle}
          title="Delete"
          disabled={deletingProjectId === project.id}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  </td>
</tr>
    );
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{responsiveStyles}</style>
      <div style={contentStyle}>
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <div>
              <h1 style={titleStyle}>Project Details</h1>
              <p style={subtitleStyle}>
                {currentUserRole === 'ORGADM' ? 'All Projects' : `Your Projects (${searchedProjects.length})`}
                {currentUserRole === 'TENUSER' && <span style={{ fontSize: '12px', color: '#3b82f6', marginLeft: '8px' }}>(User: {currentUserName})</span>}
              </p>
            </div>
            <div style={headerActionsStyle}>
              <div style={searchContainerStyle}>
                <Search size={18} style={searchIconStyle} />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={searchInputStyle} />
              </div>
              {currentUserRole === 'ORGADM' && (
                <button onClick={() => setShowAddProject(true)} style={addButtonStyle}><Plus size={20} /> Add Project</button>
              )}
            </div>
          </div>
        </div>

        <div style={tableContainerStyle}>
          <table style={responsiveTableStyle} className="desktop-table">
            <thead>
              <tr style={tableHeaderStyle}>
                <th style={tableHeaderCellStyle}>Project</th>
                <th style={tableHeaderCellStyle}>Manager</th>
                <th style={tableHeaderCellStyle}>Team</th>
                <th style={tableHeaderCellStyle}>Hours</th>
                <th style={tableHeaderCellStyle}>Start</th>
                <th style={tableHeaderCellStyle}>End</th>
                <th style={tableHeaderCellStyle}>Progress</th>
                <th style={tableHeaderCellStyle}>Status</th>
                <th style={tableHeaderCellStyle}>Changes</th>
                <th style={responsiveActionsHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchedProjects.map(p => <ProjectRow key={p.id} project={p} />)}
            </tbody>
          </table>

          <div style={mobileViewContainerStyle} className="mobile-cards">
            {searchedProjects.map(p => <ProjectRow key={p.id} project={p} />)}
          </div>

          {searchedProjects.length === 0 && (
            <div style={emptyStateStyle}>
              {searchQuery ? 'No matching projects.' : currentUserRole === 'ORGADM' ? 'No projects yet. Create one!' : `No projects assigned to ${currentUserName}.`}
            </div>
          )}
        </div>
      </div>

      {showAddProject && (
        <AddProjectModal 
          onClose={() => setShowAddProject(false)} 
          onSave={addProject} 
          adminEmail={adminEmail} 
          fetchDFUsers={fetchDFUsers}
          dfUsers={dfUsers}
          loadingDFUsers={loadingDFUsers}
        />
      )}      
      {showEditProject && (
        <EditProjectModal 
          project={showEditProject} 
          onClose={() => {
            setShowEditProject(null);
            // Reset any loading states if needed
          }} 
          onSave={updateProject} 
          adminEmail={adminEmail}
          fetchDFUsers={fetchDFUsers}
          dfUsers={dfUsers}
          loadingDFUsers={loadingDFUsers}
        />
      )}    
      {showDeleteConfirm && projectToDelete && (
        <DeleteConfirmationModal
          project={projectToDelete}
          onClose={() => { setShowDeleteConfirm(false); setProjectToDelete(null); }}
          onConfirm={confirmHardDelete}
          deletingProjectId={deletingProjectId}
        />
      )}

      {showChangeRequest && <ChangeRequestModal project={showChangeRequest} onClose={() => setShowChangeRequest(null)} onSave={addChangeRequest} />}

      {/* NEW: CR History modal */}
      {showCRHistory && <CRHistoryModal project={showCRHistory} onClose={() => setShowCRHistory(null)} />}
    </div>
  );
};

// === STYLES ===
const responsiveStyles = `
  @media (max-width: 768px) {
    .desktop-table { display: none !important; }
    .mobile-cards { display: flex !important; }
    .header-actions { flex-direction: column; gap: 12px; }
    .search-input { min-width: 200px !important; }
  }
  @media (min-width: 769px) {
    .mobile-cards { display: none !important; }
    .desktop-table { display: table !important; }
  }
  @media (max-width: 1024px) {
    .sticky-actions-header { position: sticky !important; right: 0 !important; background: #f8fafc !important; z-index: 20 !important; }
  }
`;

const containerStyle: React.CSSProperties = { width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '16px', boxSizing: 'border-box' };
const contentStyle: React.CSSProperties = { maxWidth: '100%', margin: '0 auto', overflowX: 'auto' };
const headerStyle: React.CSSProperties = { marginBottom: '32px' };
const headerContentStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' };
const titleStyle: React.CSSProperties = { fontSize: '32px', fontWeight: '800', background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', marginBottom: '8px' };
const subtitleStyle: React.CSSProperties = { fontSize: '15px', color: '#64748b', fontWeight: '500' };
const headerActionsStyle: React.CSSProperties = { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' };
const searchContainerStyle: React.CSSProperties = { position: 'relative' };
const searchIconStyle: React.CSSProperties = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInputStyle: React.CSSProperties = { padding: '12px 16px 12px 44px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '14px', minWidth: '250px', width: '100%', maxWidth: '300px', outline: 'none', boxSizing: 'border-box' };
const addButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer' };
const tableContainerStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'auto', width: '100%' };
const responsiveTableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: '1200px' };
const tableHeaderStyle: React.CSSProperties = { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' };
const tableHeaderCellStyle: React.CSSProperties = { padding: '16px 12px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' };
const responsiveActionsHeaderStyle: React.CSSProperties = { ...tableHeaderCellStyle, minWidth: '140px', width: '140px', position: 'sticky', right: 0, backgroundColor: '#f8fafc' };
const tableRowStyle: React.CSSProperties = { borderBottom: '1px solid #f1f5f9' };
const tableCellStyle: React.CSSProperties = { padding: '16px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' };
const stickyActionsCellStyle: React.CSSProperties = { ...tableCellStyle, position: 'sticky', right: 0, backgroundColor: 'white', boxShadow: '-2px 0 5px rgba(0,0,0,0.1)', minWidth: '140px', width: '140px' };
const projectNameStyle: React.CSSProperties = { fontWeight: 600, color: '#1e293b', marginBottom: '4px', fontSize: '14px' };
const projectDescriptionStyle: React.CSSProperties = { fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const teamMembersStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '150px' };
const teamMemberStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '2px 0' };
const hoursStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px' };
const progressContainerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' };
const progressBarBackgroundStyle: React.CSSProperties = { flex: 1, height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' };
const progressBarFillStyle: React.CSSProperties = { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' };
const progressTextStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '30px' };
const statusBadgeStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, border: '1px solid', whiteSpace: 'nowrap' };
const changeRequestsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center' };
const noChangesStyle: React.CSSProperties = { color: '#64748b', fontSize: '12px', fontStyle: 'italic' };
const responsiveActionsStyle: React.CSSProperties = { display: 'flex', gap: '6px', justifyContent: 'flex-start', minWidth: '120px' };
const editButtonStyle: React.CSSProperties = { padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' };
const changeRequestButtonStyle: React.CSSProperties = { padding: '6px 8px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#dbeafe', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' };
const deleteButtonStyle: React.CSSProperties = { padding: '6px 8px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' };
const mobileViewContainerStyle: React.CSSProperties = { display: 'none', flexDirection: 'column', gap: '12px', padding: '16px' };
const mobileCardStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const mobileCardHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' };
const mobileProjectInfoStyle: React.CSSProperties = { flex: 1 };
const mobileProjectNameStyle: React.CSSProperties = { fontWeight: 600, color: '#1e293b', fontSize: '16px', marginBottom: '4px' };
const mobileProjectManagerStyle: React.CSSProperties = { fontSize: '12px', color: '#64748b' };
const mobileQuickStatsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' };
const mobileStatStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1, minWidth: '60px' };
const mobileStatLabelStyle: React.CSSProperties = { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 };
const mobileStatusBadgeStyle: React.CSSProperties = { padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, border: '1px solid', textAlign: 'center' };
const mobileActionsStyle: React.CSSProperties = { display: 'flex', gap: '8px', justifyContent: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' };
const mobileEditButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', color: '#64748b', fontSize: '12px', fontWeight: 500, flex: 1, justifyContent: 'center', minWidth: '80px' };
const mobileChangeRequestButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#dbeafe', cursor: 'pointer', color: '#3b82f6', fontSize: '12px', fontWeight: 500, flex: 1, justifyContent: 'center', minWidth: '80px' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalContentStyle: React.CSSProperties = { width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', padding: '32px', backgroundColor: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' };
const modalTitleStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 };
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: '#64748b' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' };
const modalActionsStyle: React.CSSProperties = { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' };
const cancelButtonStyle: React.CSSProperties = { padding: '12px 24px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: 600 };
const saveButtonStyle: React.CSSProperties = { padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' };
const errorStyle: React.CSSProperties = { padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '14px', fontWeight: 500, marginBottom: '16px' };
const helperTextStyle: React.CSSProperties = { fontSize: '12px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' };
const teamMembersContainerStyle: React.CSSProperties = { padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' };
const noMembersStyle: React.CSSProperties = { padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '14px', fontStyle: 'italic' };
const teamMemberTagStyle: React.CSSProperties = { 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px', 
  padding: '8px 12px', 
  backgroundColor: 'white', 
  borderRadius: '8px', 
  border: '1px solid #e5e7eb', 
  fontSize: '12px', 
  fontWeight: 500,
  position: 'relative'
};const removeMemberButtonStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: '4px', color: '#6b7280', display: 'flex', alignItems: 'center' };
const addMemberContainerStyle: React.CSSProperties = { marginBottom: '12px' };
const confirmAddButtonStyle: React.CSSProperties = { padding: '12px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const cancelAddButtonStyle: React.CSSProperties = { padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const errorTextStyle: React.CSSProperties = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };
const allocationInfoStyle: React.CSSProperties = { marginTop: '8px', padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' };
const emptyStateStyle: React.CSSProperties = { padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px', width: '100%' };
const loadingContainerStyle: React.CSSProperties = { width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export default ProjectDetails;