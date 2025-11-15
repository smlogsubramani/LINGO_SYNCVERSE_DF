import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import {
    Clock, 
    CheckCircle, 
    Activity,
    Calendar,
    Users,
    Target,
    ArrowUp,
    ArrowDown,
    AlertTriangle,
    MessageSquare,
    Crown,
    FolderOpen,
    TrendingUp,
    Newspaper,
    ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/Authcontext';
import { db } from '../firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy,
    onSnapshot 
} from 'firebase/firestore';
import { getDiligenceFabricSDK } from '../services/DFService';

// Register ChartJS components once
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Interface Definitions (Kept as is)
interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    status: 'Active' | 'Inactive';
    experience: number;
    skills: string[];
    dateOfJoining: string;
    createdAt: string;
    updatedAt: string;
    isDFUser: boolean;
}

interface ChangeRequest {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'in-progress';
    priority: 'low' | 'medium' | 'high' | 'critical';
    requestedBy: string;
    requestedAt: string;
    hoursImpact: number;
}

interface Task {
    id: string;
    title: string;
    description: string;
    status: 'todo' | 'in-progress' | 'review' | 'completed';
    assignee: string;
    dueDate: string;
    estimatedHours: number;
    actualHours: number;
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    updatedAt: string;
}

interface Message {
    id: string;
    content: string;
    sender: string;
    senderName: string;
    timestamp: string;
    type: 'text' | 'file' | 'system';
}

interface Project {
    id: string;
    name: string;
    description: string;
    status: 'planning' | 'active' | 'in-progress' | 'on-hold' | 'completed';
    manager: string;
    startDate: string;
    endDate: string;
    progress: number;
    remainingHours: number;
    teamMembers: any[];
    changeRequests: ChangeRequest[];
    totalEfforts: number;
    createdAt: string;
    updatedAt: string;
}

interface ProjectWithDetails extends Project {
    tasks?: Task[];
    messages?: Message[];
    teamMembersDetails?: User[];
}

interface KPICard {
    value: string | number;
    label: string;
    icon: React.ComponentType<any>;
    color: string;
    change?: string;
    trend?: 'up' | 'down';
    isDate?: boolean;
}

interface DFUser {
    id: string;
    name: string;
    email: string;
    organization: string;
}

interface TeamMemberStats {
    name: string;
    projectsCount: number;
    completedTasks: number;
    totalTasks: number;
    efficiency: number;
    role?: string;
}

// News interfaces
interface NewsArticle {
    source: { id: string | null; name: string };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string;
}

interface NewsResponse {
    status: string;
    totalResults: number;
    articles: NewsArticle[];
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<ProjectWithDetails[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<'ORGADM' | 'TENUSER' | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [teamMemberStats, setTeamMemberStats] = useState<TeamMemberStats[]>([]);

    // News state
    const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(false);
    const [lastNewsFetch, setLastNewsFetch] = useState<number>(0);

    // Professional color palette
    const colors = {
        primary: '#3b82f6',     // Blue (Indigo/Sky-600)
        secondary: '#8b5cf6',   // Purple (Violet-500)
        success: '#10b981',     // Green (Emerald-500)
        warning: '#f59e0b',     // Amber (Amber-500)
        danger: '#ef4444',      // Red (Red-500)
        info: '#06b6d4',        // Cyan (Cyan-600)
        dark: '#1e293b',        // Slate (Slate-800)
        light: '#64748b'        // Slate light (Slate-500)
    };

    // Get current user data from localStorage and DF (Kept as is for functionality)
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
            }
        } catch {
            // ignore
        }
        return {
            token: data.Token,
            tenantID: data.TenantID,
            userName: data.UserName || 'TENUSER',
            role,
            isOrgAdmin
        };
    };

    // Fetch DF Users and determine current user role (Kept as is for functionality)
    const fetchDFUsersAndRole = async () => {
        try {
            const userData = getUserData();
            if (!userData.token) throw new Error('No authentication token found.');

            const client = getDiligenceFabricSDK();
            if (!client) throw new Error('Failed to initialize Diligence Fabric SDK');
            client.setAuthUser({ Token: userData.token });

            const requestBody = { tenantID: userData.tenantID };
            const appRoleService = client.getApplicationRoleService();
            const response = await appRoleService.getUserAppRole(requestBody);

            let userEmail = userData.userName || '';
            let userName = userData.userName || '';
            let userRole: 'ORGADM' | 'TENUSER' = 'TENUSER';

            // Build proper email and extract username
            if (userEmail && !userEmail.includes('@')) {
                userEmail = `${userEmail}@ubtiinc.com`;
            }
            // Extract username from email (shreemathi.d@ubtiinc.com -> shreemathi.d)
            if (userEmail.includes('@')) {
                userName = userEmail.split('@')[0];
            }

            if (Array.isArray(response?.Result) && response.Result.length > 0) {
                const currentUser = response.Result.find(
                    (u: any) => u.UserName === userEmail || u.UserName === userData.userName
                );
                if (currentUser) {
                    userEmail = currentUser.UserName;
                    userName = userEmail.split('@')[0];
                }
                // Set role from DF response
                userRole = userData.isOrgAdmin ? 'ORGADM' : 'TENUSER';
            }

            // Set current user role and email
            setCurrentUserRole(userRole);
            setCurrentUserEmail(userEmail.toLowerCase());
            setCurrentUserName(userName.toLowerCase());

        } catch (error) {
            console.error('Error fetching DF users and role:', error);
            const userData = getUserData();
            setCurrentUserRole(userData.isOrgAdmin ? 'ORGADM' : 'TENUSER');
            setCurrentUserEmail(userData.userName?.toLowerCase() || '');
            setCurrentUserName(userData.userName?.toLowerCase() || '');
        }
    };

    // News Card Component for Vertical Layout (Refined Styling)
    const NewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => {
        const date = new Date(article.publishedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        
        return (
            <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white rounded-lg border border-gray-100 hover:border-indigo-400 hover:shadow-md transition-all duration-200 group"
            >
                <div className="flex gap-3">
                    {article.urlToImage && (
                        <div className="flex-shrink-0 w-16 h-16">
                            <img
                                src={article.urlToImage}
                                alt={`Image for ${article.title}`}
                                className="w-full h-full object-cover rounded-lg"
                                loading="lazy"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                            {article.title}
                        </h4>
                        {article.description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                {article.description}
                            </p>
                        )}
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-50/50">
                            <span className="text-indigo-600 font-medium truncate max-w-[50%]">{article.source.name}</span>
                            <div className="flex items-center gap-1 text-gray-500">
                                <span className="flex-shrink-0">{date}</span>
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                        </div>
                    </div>
                </div>
            </a>
        );
    };

    // === FETCH NEWS === (Kept as is for functionality)
    useEffect(() => {
        const NEWS_API_URL = 'https://newsapi.org/v2/everything?q=microsoft&from=2025-11-10&sortBy=popularity&language=en&apiKey=99635d58b7f54f069aee2d10aafee4cb';
        const FIVE_MIN = 5 * 60 * 1000;
        const now = Date.now();
        if (now - lastNewsFetch < FIVE_MIN && newsArticles.length) {
            setNewsLoading(false);
            return;
        }
        let cancelled = false;
        const fetchNews = async () => {
            try {
                const res = await fetch(NEWS_API_URL);
                if (!res.ok) throw new Error();
                const json: NewsResponse = await res.json();
                if (!cancelled) {
                    setNewsArticles(json.articles || []);
                    setLastNewsFetch(now);
                    setNewsError(false);
                }
            } catch {
                if (!cancelled) setNewsError(true);
            } finally {
                if (!cancelled) setNewsLoading(false);
            }
        };
        fetchNews();
        return () => {
            cancelled = true;
        };
    }, [newsArticles.length, lastNewsFetch]);

    // Extract team member names from project data (Kept as is for functionality)
    const extractTeamMemberNames = (teamMembers: any[]): string[] => {
        const names: string[] = [];
        
        teamMembers.forEach(member => {
            if (typeof member === 'string') {
                names.push(member.toLowerCase());
            } else if (typeof member === 'object' && member !== null) {
                if (member.name) {
                    names.push(member.name.toLowerCase());
                }
                if (member.email) {
                    const memberName = member.email.split('@')[0];
                    names.push(memberName.toLowerCase());
                }
            }
        });
        
        return [...new Set(names)]; // Remove duplicates
    };

    // Calculate team member statistics including project assignments (Kept as is for functionality)
    const calculateTeamMemberStats = (projects: ProjectWithDetails[]): TeamMemberStats[] => {
        const memberStatsMap: {
            [key: string]: {
                projects: Set<string>;
                completedTasks: number;
                totalTasks: number;
            };
        } = {};

        projects.forEach(project => {
            const projectMembers = extractTeamMemberNames(project.teamMembers || []);
            
            projectMembers.forEach(memberName => {
                if (!memberStatsMap[memberName]) {
                    memberStatsMap[memberName] = {
                        projects: new Set(),
                        completedTasks: 0,
                        totalTasks: 0,
                    };
                }

                memberStatsMap[memberName].projects.add(project.id);

                const memberTasks = project.tasks?.filter(task => {
                    const taskAssignee = task.assignee?.toLowerCase();
                    return (
                        taskAssignee === memberName ||
                        taskAssignee === memberName.replace('.', ' ') ||
                        taskAssignee?.includes(memberName)
                    );
                }) || [];

                memberStatsMap[memberName].totalTasks += memberTasks.length;
                memberStatsMap[memberName].completedTasks += memberTasks.filter(
                    task => task.status === 'completed'
                ).length;
            });
        });

        return Object.entries(memberStatsMap)
            .map(([name, stats]) => {
                const projectsCount = stats.projects.size;
                const taskCompletionRate =
                    stats.totalTasks > 0
                        ? Math.round(
                            (stats.completedTasks / Math.max(stats.totalTasks, 1)) * 100
                        )
                        : projectsCount > 0
                        ? 100
                        : 0;

                return {
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    projectsCount,
                    completedTasks: stats.completedTasks,
                    totalTasks: stats.totalTasks,
                    efficiency: taskCompletionRate,
                };
            })
            .sort((a, b) => b.projectsCount - a.projectsCount);
    };

    // Check if user has access to project based on team members (Kept as is for functionality)
    const userHasAccessToProject = (project: Project, userName: string) => {
        if (!project.teamMembers || project.teamMembers.length === 0) return false;
        
        // Check if user is in the team members list
        return project.teamMembers.some(member => {
            if (typeof member === 'string') {
                return member.toLowerCase() === userName.toLowerCase();
            } else if (typeof member === 'object' && member !== null) {
                const memberObj = member as any;
                if (memberObj.name) {
                    return memberObj.name.toLowerCase() === userName.toLowerCase();
                }
                if (memberObj.email) {
                    const memberName = memberObj.email.split('@')[0];
                    return memberName.toLowerCase() === userName.toLowerCase();
                }
            }
            return false;
        });
    };

    // Filter projects based on user role and access (Kept as is for functionality)
    const filterProjectsByRole = (allProjects: ProjectWithDetails[]) => {
        if (currentUserRole === 'ORGADM') {
            // OrgAdmin sees all projects
            return allProjects;
        } else {
            // Regular users only see projects they are part of
            return allProjects.filter(project => 
                userHasAccessToProject(project, currentUserName)
            );
        }
    };

    // Fetch real data from Firestore (Kept as is for functionality)
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // First, fetch user role and DF data
                await fetchDFUsersAndRole();
                
                // Fetch users
                const usersQuery = query(collection(db, 'users'));
                const usersSnapshot = await getDocs(usersQuery);
                const usersData = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as User[];
                setUsers(usersData);

                // Fetch all projects
                const projectsQuery = query(collection(db, 'projects'));
                const projectsSnapshot = await getDocs(projectsQuery);
                const projectsData = await Promise.all(
                    projectsSnapshot.docs.map(async (doc) => {
                        const projectData = {
                            id: doc.id,
                            ...doc.data()
                        } as ProjectWithDetails;

                        // Fetch tasks for each project
                        try {
                            const tasksQuery = query(
                                collection(db, 'projects', doc.id, 'tasks'),
                                orderBy('createdAt', 'desc')
                            );
                            const tasksSnapshot = await getDocs(tasksQuery);
                            projectData.tasks = tasksSnapshot.docs.map(taskDoc => ({
                                id: taskDoc.id,
                                ...taskDoc.data()
                            })) as Task[];
                        } catch (error) {
                            console.log(`No tasks for project ${doc.id}`);
                            projectData.tasks = [];
                        }

                        // Fetch messages for each project
                        try {
                            const messagesQuery = query(
                                collection(db, 'projects', doc.id, 'messages'),
                                orderBy('timestamp', 'desc')
                            );
                            const messagesSnapshot = await getDocs(messagesQuery);
                            projectData.messages = messagesSnapshot.docs.map(msgDoc => ({
                                id: msgDoc.id,
                                ...msgDoc.data()
                            })) as Message[];
                        } catch (error) {
                            console.log(`No messages for project ${doc.id}`);
                            projectData.messages = [];
                        }

                        return projectData;
                    })
                );

                setProjects(projectsData);

                // Extract all change requests
                const allChangeRequests = projectsData.flatMap(project => 
                    project.changeRequests?.map(cr => ({
                        ...cr,
                        projectId: project.id,
                        projectName: project.name
                    })) || []
                );
                setChangeRequests(allChangeRequests);

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter projects when projects or user role changes (Kept as is for functionality)
    useEffect(() => {
        if (projects.length > 0 && currentUserRole && currentUserName) {
            const filtered = filterProjectsByRole(projects);
            setFilteredProjects(filtered);
            
            // Calculate team member statistics
            const memberStats = calculateTeamMemberStats(filtered);
            setTeamMemberStats(memberStats);
            
            console.log('Current user:', currentUserName);
            console.log('Filtered projects:', filtered);
            console.log('Team member stats:', memberStats);
        }
    }, [projects, currentUserRole, currentUserName]);

    // Memoized calculations for better performance - using filteredProjects (Kept as is for functionality)
    const kpis = useMemo(() => {
        if (loading || !currentUserRole) {
            return {
                completed: 0,
                active: 0,
                inProgress: 0,
                planning: 0,
                onHold: 0,
                totalProjects: 0,
                totalEfforts: 0,
                burntEfforts: 0,
                efficiency: 0,
                totalTeam: 0,
                activeUsers: 0,
                pendingChangeRequests: 0,
                nearestDeadline: 'N/A',
                totalTasks: 0,
                completedTasks: 0,
                avgTeamEfficiency: 0,
            };
        }

        const completed = filteredProjects.filter(p => p.status === 'completed').length;
        const active = filteredProjects.filter(p => p.status === 'active').length;
        const inProgress = filteredProjects.filter(p => p.status === 'in-progress').length;
        const planning = filteredProjects.filter(p => p.status === 'planning').length;
        const onHold = filteredProjects.filter(p => p.status === 'on-hold').length;
        const totalProjects = filteredProjects.length;
        
        // Calculate efforts from project totalEfforts and remainingHours
        const totalEfforts = filteredProjects.reduce((sum, project) => 
            sum + (project.totalEfforts || 0), 0);
        
        const burntEfforts = filteredProjects.reduce((sum, project) => 
            sum + ((project.totalEfforts || 0) - (project.remainingHours || 0)), 0);

        // Calculate resource efficiency properly
        const efficiency = totalEfforts > 0 ? Math.round((burntEfforts / totalEfforts) * 100) : 0;
        
        const totalTeam = users.filter(u => u.status === 'Active').length;
        const activeUsers = users.filter(u => u.status === 'Active').length;
        
        // Filter change requests based on accessible projects
        const accessibleProjectIds = filteredProjects.map(p => p.id);
        const accessibleChangeRequests = changeRequests.filter(cr => 
            accessibleProjectIds.includes((cr as any).projectId)
        );
        const pendingChangeRequests = accessibleChangeRequests.filter(cr => cr.status === 'pending').length;

        const nearestDeadline = filteredProjects
            .filter(p => !['completed', 'cancelled'].includes(p.status) && p.endDate)
            .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0]?.endDate || 'N/A';

        const totalTasks = filteredProjects.reduce((sum, project) => sum + (project.tasks?.length || 0), 0);
        const completedTasks = filteredProjects.reduce((sum, project) => 
            sum + (project.tasks?.filter(task => task.status === 'completed').length || 0), 0);

        // Calculate average team efficiency properly
        const validEfficiencies = teamMemberStats.filter(member => member.totalTasks > 0);
        const avgTeamEfficiency = validEfficiencies.length > 0 
            ? Math.round(validEfficiencies.reduce((sum, member) => sum + member.efficiency, 0) / validEfficiencies.length)
            : teamMemberStats.length > 0 ? 100 : 0; 

        return {
            completed,
            active,
            inProgress,
            planning,
            onHold,
            totalProjects,
            totalEfforts,
            burntEfforts,
            efficiency,
            totalTeam,
            activeUsers,
            pendingChangeRequests,
            nearestDeadline,
            totalTasks,
            completedTasks,
            avgTeamEfficiency,
        };
    }, [filteredProjects, users, changeRequests, teamMemberStats, loading, currentUserRole]);

    // Memoized KPI cards with professional colors (Kept as is for functionality)
    const kpiCards: KPICard[] = useMemo(() => [
        {
            value: kpis.totalProjects,
            label: 'Total Projects',
            icon: FolderOpen,
            color: colors.primary,
            change: `${kpis.active + kpis.inProgress} active`,
        },
        {
            value: kpis.completed,
            label: 'Completed Projects',
            icon: CheckCircle,
            color: colors.success,
            change: `${Math.round((kpis.completed / Math.max(kpis.totalProjects, 1)) * 100)}% completion rate`,
            trend: kpis.completed > 0 ? 'up' : 'down',
        },
        {
            value: `${kpis.efficiency}%`,
            label: 'Resource Efficiency',
            icon: TrendingUp,
            color: colors.secondary,
            trend: kpis.efficiency > 75 ? 'up' : kpis.efficiency < 50 ? 'down' : undefined,
        },
        {
            value: kpis.burntEfforts,
            label: 'Hours Utilized',
            icon: Clock,
            color: colors.info,
            change: `${kpis.totalEfforts} total allocated`,
        },
        {
            value: teamMemberStats.length,
            label: 'Active Team Members',
            icon: Users,
            color: colors.primary,
            change: `${kpis.totalTeam} total users`,
            trend: 'up',
        },
        {
            value: kpis.pendingChangeRequests,
            label: 'Pending Change Requests',
            icon: AlertTriangle,
            color: colors.danger,
            trend: kpis.pendingChangeRequests > 5 ? 'down' : 'up',
        },
        {
            value: `${kpis.avgTeamEfficiency}%`,
            label: 'Team Efficiency Avg',
            icon: Activity,
            color: colors.success,
            trend: kpis.avgTeamEfficiency > 75 ? 'up' : kpis.avgTeamEfficiency < 50 ? 'down' : undefined,
        },
        {
            value: kpis.nearestDeadline === 'N/A' ? 'N/A' : new Date(kpis.nearestDeadline).toLocaleDateString(),
            label: 'Next Deadline',
            icon: Calendar,
            color: colors.info,
            isDate: true,
        },
    ], [kpis, teamMemberStats, colors]);

    // Memoized chart data for performance optimization (Kept as is for functionality)
    const chartData = useMemo(() => {
        if (loading || !currentUserRole) {
            return {
                barData: { labels: [], datasets: [] },
                lineData: { labels: [], datasets: [] },
                statusData: { labels: [], datasets: [] },
                priorityData: { labels: [], datasets: [] },
                teamProjectsData: { labels: [], datasets: [] },
            };
        }

        // Project Efforts vs Burnt Chart - Using actual project data
        const barData = {
            labels: filteredProjects.map(p => p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name),
            datasets: [
                {
                    label: 'Total Hours Allocated',
                    data: filteredProjects.map(p => p.totalEfforts || 0),
                    backgroundColor: `${colors.primary}CC`,
                    borderColor: colors.primary,
                    borderWidth: 1,
                    borderRadius: 6,
                },
                {
                    label: 'Hours Utilized',
                    data: filteredProjects.map(p => (p.totalEfforts || 0) - (p.remainingHours || 0)),
                    backgroundColor: `${colors.success}CC`,
                    borderColor: colors.success,
                    borderWidth: 1,
                    borderRadius: 6,
                }
            ],
        };

        // Progress trend based on project completion
        const lineData = {
            labels: filteredProjects.map(p => p.name.length > 8 ? p.name.substring(0, 8) + '...' : p.name),
            datasets: [{
                label: 'Project Progress %',
                data: filteredProjects.map(p => p.progress || 0),
                borderColor: colors.success,
                backgroundColor: `${colors.success}20`,
                tension: 0.4,
                borderWidth: 3,
                fill: true,
                pointBackgroundColor: colors.success,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
            }],
        };

        // Project Status Distribution with professional colors - INCLUDING 'active' status
        const statusData = {
            labels: ['Completed', 'Active', 'In Progress', 'Planning', 'On Hold'],
            datasets: [{
                data: [
                    kpis.completed,
                    kpis.active,
                    kpis.inProgress,
                    kpis.planning,
                    kpis.onHold,
                ],
                backgroundColor: [
                    `${colors.success}CC`,
                    `${colors.primary}CC`,
                    `${colors.info}CC`,
                    `${colors.warning}CC`,
                    `${colors.light}CC`
                ],
                borderColor: [
                    colors.success,
                    colors.primary,
                    colors.info,
                    colors.warning,
                    colors.dark
                ],
                borderWidth: 2,
                hoverOffset: 15
            }],
        };

        // Change Request Priority Distribution - only for accessible projects
        const accessibleProjectIds = filteredProjects.map(p => p.id);
        const accessibleChangeRequests = changeRequests.filter(cr => 
            accessibleProjectIds.includes((cr as any).projectId)
        );

        const priorityData = {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{
                data: [
                    accessibleChangeRequests.filter(cr => cr.priority === 'critical').length,
                    accessibleChangeRequests.filter(cr => cr.priority === 'high').length,
                    accessibleChangeRequests.filter(cr => cr.priority === 'medium').length,
                    accessibleChangeRequests.filter(cr => cr.priority === 'low').length,
                ],
                backgroundColor: [
                    `${colors.danger}CC`,
                    `${colors.warning}CC`,
                    `${colors.info}CC`,
                    `${colors.success}CC`
                ],
                borderColor: [
                    colors.danger,
                    colors.warning,
                    colors.info,
                    colors.success
                ],
                borderWidth: 2,
                hoverOffset: 15
            }],
        };

        // Team Member Projects Chart
        const topTeamMembers = teamMemberStats.slice(0, 6); // Show top 6 team members
        const teamProjectsData = {
            labels: topTeamMembers.map(member => member.name),
            datasets: [
                {
                    label: 'Projects Assigned',
                    data: topTeamMembers.map(member => member.projectsCount),
                    backgroundColor: `${colors.primary}CC`,
                    borderColor: colors.primary,
                    borderWidth: 1,
                    borderRadius: 6,
                },
                {
                    label: 'Task Completion Rate',
                    data: topTeamMembers.map(member => member.efficiency),
                    backgroundColor: `${colors.success}CC`,
                    borderColor: colors.success,
                    borderWidth: 1,
                    borderRadius: 6,
                }
            ],
        };

        return { barData, lineData, statusData, priorityData, teamProjectsData };
    }, [filteredProjects, changeRequests, teamMemberStats, loading, currentUserRole, kpis, colors]);

    // Recent activities from messages and tasks (Kept as is for functionality)
    const recentActivities = useMemo(() => {
        if (loading || !currentUserRole) return [];

        const activities: Array<{
            project: string;
            action: string;
            time: string;
            status: 'completed' | 'in-progress' | 'system';
            type: 'task' | 'message' | 'change';
        }> = [];

        // Add task activities
        filteredProjects.forEach(project => {
            project.tasks?.slice(0, 2).forEach(task => {
                activities.push({
                    project: project.name,
                    action: `Task: ${task.title} - ${task.status}`,
                    time: new Date(task.updatedAt || task.createdAt).toLocaleDateString(),
                    status: task.status === 'completed' ? 'completed' : 'in-progress',
                    type: 'task'
                });
            });

            // Add message activities with proper sender names
            project.messages?.slice(0, 2).forEach(message => {
                // Use senderName if available, otherwise use sender or default
                const senderDisplayName = message.senderName || message.sender || 'Team Member';
                activities.push({
                    project: project.name,
                    action: `Message from ${senderDisplayName}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
                    time: new Date(message.timestamp).toLocaleDateString(),
                    status: 'system',
                    type: 'message'
                });
            });

            // Add change request activities
            project.changeRequests?.slice(0, 2).forEach(cr => {
                activities.push({
                    project: project.name,
                    action: `Change Request: ${cr.title} - ${cr.status}`,
                    time: new Date(cr.requestedAt).toLocaleDateString(),
                    status: cr.status === 'approved' ? 'completed' : 'in-progress',
                    type: 'change'
                });
            });
        });

        return activities
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 8);
    }, [filteredProjects, loading, currentUserRole]);

    // Chart options (Kept as is for customization)
    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index' as const,
        },
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: { size: 12 },
                    color: '#64748b'
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 14, weight: 'bold' as const },
                bodyFont: { size: 12 },
                cornerRadius: 8,
                padding: 12,
            },
            title: {
                display: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#94a3b8',
                    maxTicksLimit: 6,
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    borderDash: [5, 5],
                    drawBorder: false
                }
            },
            x: {
                ticks: {
                    color: '#94a3b8',
                    maxRotation: 45,
                },
                grid: {
                    display: false
                }
            }
        }
    }), []);

    const pieChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: { size: 12 },
                    color: '#64748b'
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 14, weight: 'bold' as const },
                bodyFont: { size: 12 },
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    label: function(context: any) {
                        const label = context.label || '';
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = Math.round((value / Math.max(total, 1)) * 100);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        },
    }), []);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            {/* Enhanced responsive styles - Inlined for component encapsulation */}
            <style>{`
                .hover-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 0 40px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                .chart-container {
                    position: relative;
                    height: 280px;
                    width: 100%;
                }
                @media (max-width: 639px) { 
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 0.75rem !important;
                    }
                }
            `}</style>
            
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-500 mb-1">
                                Project Management Dashboard
                            </h1>
                            <p className="text-sm text-gray-500">
                                Welcome back, <span className="font-semibold text-gray-700">{user?.Roles || 'User'} {user?.FirstName || user?.UserName || 'User'}</span>! 
                                {currentUserRole === 'ORGADM' ? ' Complete organizational overview.' : ' Your project dashboard.'}
                                {currentUserRole === 'TENUSER' && (
                                    <span className="ml-1 text-blue-600 font-medium">({filteredProjects.length} accessible projects)</span>
                                )}
                            </p>
                        </div>
                        {currentUserRole === 'ORGADM' && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-400/30 rounded-full flex-shrink-0">
                                <Crown className="w-4 h-4 text-purple-600" />
                                <span className="text-purple-600 text-xs font-bold uppercase">Admin</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Grid - Fully Responsive: default 2 cols, sm 3, lg 4. */}
                <div className="grid kpi-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                    {kpiCards.map((kpi, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            className="kpi-card hover-card bg-white rounded-xl p-4 shadow-lg border border-gray-100 relative overflow-hidden"
                        >
                            <div 
                                className="absolute top-0 left-0 w-full h-1 rounded-t-xl" 
                                style={{ background: kpi.color }} 
                            />
                            <div className="flex items-start justify-between mb-3">
                                <div 
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border-2 flex-shrink-0"
                                    style={{ 
                                        backgroundColor: `${kpi.color}20`, 
                                        borderColor: `${kpi.color}40`, 
                                    }}
                                >
                                    {React.createElement(kpi.icon, { 
                                        size: 20, 
                                        color: kpi.color, 
                                        strokeWidth: 2 
                                    })}
                                </div>
                                {kpi.change && (
                                    <div 
                                        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                                            kpi.trend === 'up' ? 'text-emerald-600 bg-emerald-100' : 
                                            kpi.trend === 'down' ? 'text-red-600 bg-red-100' :
                                            'text-gray-600 bg-gray-100'
                                        }`}
                                    >
                                        {kpi.trend === 'up' && <ArrowUp size={10} />}
                                        {kpi.trend === 'down' && <ArrowDown size={10} />}
                                        <span className="truncate max-w-[80px]">{kpi.change}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className={`kpi-value text-gray-900 font-bold mb-1 ${kpi.isDate ? 'text-lg' : 'text-xl sm:text-2xl lg:text-3xl'}`}>
                                {kpi.value}
                            </div>
                            
                            <div className="text-xs sm:text-sm text-gray-500 font-medium">
                                {kpi.label}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Main Content Grid: 2/3 for Charts, 1/3 for Sidebar Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Charts Section (2/3 width on large screens, full width on small) */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Top Charts Row - 2 equal columns (full width on small) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Project Hours Chart */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.4 }}
                                className="hover-card bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Project Hours Allocation</h3>
                                {filteredProjects.length > 0 ? (
                                    <div className="chart-container">
                                        <Bar data={chartData.barData} options={chartOptions} />
                                    </div>
                                ) : (
                                    <div className="chart-container flex items-center justify-center text-gray-500">
                                        No projects available to display
                                    </div>
                                )}
                            </motion.div>

                            {/* Team Member Projects */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.4 }}
                                className="hover-card bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Team Member Assignments</h3>
                                {teamMemberStats.length > 0 ? (
                                    <div className="chart-container">
                                        <Bar data={chartData.teamProjectsData} options={chartOptions} />
                                    </div>
                                ) : (
                                    <div className="chart-container flex items-center justify-center text-gray-500">
                                        No team member data available
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Bottom Charts Row - 2 equal columns (full width on small) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Project Status */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.4 }}
                                className="hover-card bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Project Status Distribution</h3>
                                {filteredProjects.length > 0 ? (
                                    <div className="chart-container">
                                        <Pie data={chartData.statusData} options={pieChartOptions} />
                                    </div>
                                ) : (
                                    <div className="chart-container flex items-center justify-center text-gray-500">
                                        No projects available to display
                                    </div>
                                )}
                            </motion.div>

                            {/* Change Request Priority */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6, duration: 0.4 }}
                                className="hover-card bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Change Request Priority</h3>
                                {filteredProjects.length > 0 ? (
                                    <div className="chart-container">
                                        <Doughnut 
                                            data={chartData.priorityData} 
                                            options={{
                                                ...pieChartOptions,
                                                cutout: '60%',
                                            }} 
                                        />
                                    </div>
                                ) : (
                                    <div className="chart-container flex items-center justify-center text-gray-500">
                                        No change requests available
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>

                    {/* Sidebar Section (1/3 width on large screens, full width on small) */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Recent Activities – with max-height on desktop but full flow on mobile */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7, duration: 0.4 }}
                            className="bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-5 border-b pb-3 border-gray-100">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Recent Activities</h3>
                                <MessageSquare size={18} className="text-indigo-500" />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-96 lg:max-h-80 xl:max-h-96">
                                {recentActivities.length > 0 ? (
                                    recentActivities.map((activity, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-start gap-3 p-3 rounded-lg transition duration-200 cursor-pointer ${
                                                index === 0 ? 'bg-indigo-50/50 border border-indigo-200' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        activity.status === 'completed' ? colors.success :
                                                        activity.status === 'in-progress' ? colors.primary : colors.secondary,
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 mb-0.5 break-words line-clamp-2">
                                                    <span className="font-semibold">{activity.project}:</span> {activity.action}
                                                </div>
                                                <div className="text-xs text-gray-500">{activity.time}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-500 py-4">No recent activities</div>
                                )}
                            </div>
                        </motion.div>

                        {/* Team Performance – always visible, scrollable if necessary */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.4 }}
                            className="bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-5 border-b pb-3 border-gray-100">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Team Performance</h3>
                                <Activity size={18} className="text-green-500" />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-96 lg:max-h-80 xl:max-h-96">
                                {teamMemberStats.length > 0 ? (
                                    teamMemberStats.slice(0, 10).map((member, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition duration-200"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className='truncate min-w-0'>
                                                    <div className="text-sm font-medium text-gray-900 truncate">{member.name}</div>
                                                    <div className="text-xs text-gray-500 truncate">
                                                        {member.projectsCount} projects • {member.completedTasks}/{member.totalTasks} tasks
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className={`text-sm font-bold flex-shrink-0 ${
                                                    member.efficiency >= 80 ? 'text-green-600' :
                                                    member.efficiency >= 60 ? 'text-blue-600' : 'text-red-600'
                                                }`}
                                            >
                                                {member.efficiency}%
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-500 py-4">No team member data</div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
                
                {/* News Section - Full Width on the bottom, or can be adjusted to its own column on large screens */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                    className="bg-white rounded-xl p-4 sm:p-5 shadow-lg border border-gray-100 flex flex-col mt-6"
                >
                    <div className="flex items-center justify-between mb-5 border-b pb-3 border-gray-100">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Newspaper size={18} className="text-indigo-500" /> Technology News Feed
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-hidden">
                        {newsLoading ? (
                            <div className="col-span-full flex items-center justify-center h-20 text-gray-500">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-2"></div>
                                Loading news…
                            </div>
                        ) : newsError ? (
                            <div className="col-span-full flex items-center justify-center h-20 text-red-600">Failed to load news.</div>
                        ) : newsArticles.length > 0 ? (
                            newsArticles.slice(0, 4).map((article, index) => ( // Display top 4 news articles horizontally
                                <NewsCard key={index} article={article} />
                            ))
                        ) : (
                            <div className="col-span-full flex items-center justify-center h-20 text-gray-500">No news available.</div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;