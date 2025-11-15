import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  GitPullRequest, 
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Crown
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';

interface TeamMember {
  name: string;
  allocatedHours: number;
  userId: string;
  email?: string;
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
  projectId?: string;
  projectName?: string;
  projectManager?: string;
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
  displayName: string;
  email: string;
  id: string;
  role?: string;
  isOrgAdmin: boolean;
}

const PendingWork: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingChangeRequests, setPendingChangeRequests] = useState<ChangeRequest[]>([]);
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'change-requests' | 'projects'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPendingWork();
    }
  }, [currentUser]);

  // Get current user from localStorage and Microsoft authentication with role
  const fetchCurrentUser = () => {
    try {
      const data = JSON.parse(localStorage.getItem('userData') || '{}');
      let role = 'TENUSER';
      let isOrgAdmin = false;
      
      if (data.Token) {
        const base64Url = data.Token.split('.')[1] || '';
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const tokenClaims = JSON.parse(atob(base64));
        role = tokenClaims.Role || 'TENUSER';
        isOrgAdmin = role === 'ORGADM';
      }

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

      const { name, email } = buildNameAndEmail(data.UserName || 'TENUSER');
      
      setCurrentUser({
        displayName: name,
        email: email,
        id: data.UserName || 'current-user',
        role: role,
        isOrgAdmin: isOrgAdmin
      });

    } catch (error) {
      console.error('Error fetching user profile:', error);
      setCurrentUser({
        displayName: 'TENUSER',
        email: 'tenuser@ubtiinc.com',
        id: 'current-user',
        role: 'TENUSER',
        isOrgAdmin: false
      });
    }
  };

  // Check if user has access to project
  const userHasAccessToProject = (project: Project, userEmail: string) => {
    if (!project.teamMembers || project.teamMembers.length === 0) return false;
    
    // Check if user is in the team members list by email or name
    return project.teamMembers.some(member => {
      // If member has email, check directly
      if (member.email && member.email.toLowerCase() === userEmail.toLowerCase()) {
        return true;
      }
      // Otherwise check by name (build email from name)
      const memberEmail = `${member.name.toLowerCase().replace(/\s+/g, '.')}@ubtiinc.com`;
      return memberEmail === userEmail.toLowerCase();
    });
  };

  // Filter projects based on user role
  const filterProjectsByRole = (projectsList: Project[]): Project[] => {
    if (!currentUser) return [];
    
    if (currentUser.isOrgAdmin) {
      // OrgAdmin can see ALL projects
      return projectsList;
    } else {
      // Regular users only see projects they're involved in
      return projectsList.filter(project => 
        userHasAccessToProject(project, currentUser.email)
      );
    }
  };

  // Filter change requests based on user role
  const filterChangeRequestsByRole = (changeRequests: ChangeRequest[], projectsList: Project[]): ChangeRequest[] => {
    if (!currentUser) return [];
    
    if (currentUser.isOrgAdmin) {
      // OrgAdmin can see ALL change requests
      return changeRequests;
    } else {
      // Regular users only see change requests from projects they have access to
      const accessibleProjectIds = projectsList
        .filter(project => userHasAccessToProject(project, currentUser!.email))
        .map(project => project.id);
      
      return changeRequests.filter(cr => 
        cr.projectId && accessibleProjectIds.includes(cr.projectId)
      );
    }
  };

  const fetchPendingWork = async () => {
    try {
      setLoading(true);
      
      // Fetch all projects
      const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const allProjects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        teamMembers: doc.data().teamMembers || [],
        changeRequests: doc.data().changeRequests || [],
        remainingHours: doc.data().remainingHours || doc.data().totalEfforts,
        progress: doc.data().progress || 0
      })) as Project[];

      console.log('All projects:', allProjects);
      
      // Filter projects based on user role
      const accessibleProjects = filterProjectsByRole(allProjects);
      setProjects(accessibleProjects);

      // Extract pending change requests from accessible projects
      const allPendingCRs: ChangeRequest[] = [];
      const pendingProjectsList: Project[] = [];

      accessibleProjects.forEach(project => {
        console.log(`Processing project: ${project.name}`, {
          status: project.status,
          progress: project.progress,
          isActive: project.status === 'active',
          isIncomplete: project.progress < 100,
          shouldInclude: project.status === 'active' && project.progress < 100
        });

        // Collect pending change requests
        const projectPendingCRs = (project.changeRequests || [])
          .filter(cr => cr.status === 'pending')
          .map(cr => ({
            ...cr,
            projectId: project.id,
            projectName: project.name,
            projectManager: project.manager
          }));

        allPendingCRs.push(...projectPendingCRs);

        // IMPROVED: Identify pending projects - more inclusive criteria
        const isActiveProject = project.status === 'active';
        const isPlanningProject = project.status === 'planning';
        const isOnHoldProject = project.status === 'on-hold';
        const isIncomplete = (project.progress || 0) < 100;
        
        // Include active, planning, or on-hold projects that are not completed
        if ((isActiveProject || isPlanningProject || isOnHoldProject) && isIncomplete) {
          console.log(`Adding to pending projects: ${project.name}`);
          pendingProjectsList.push(project);
        }
      });

      // Filter change requests based on user role (additional filtering)
      const filteredPendingCRs = filterChangeRequestsByRole(allPendingCRs, allProjects);

      console.log('Pending Change Requests:', filteredPendingCRs);
      console.log('Pending Projects:', pendingProjectsList);

      setPendingChangeRequests(filteredPendingCRs);
      setPendingProjects(pendingProjectsList);

    } catch (error) {
      console.error('Error fetching pending work:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter change requests by priority
  const filteredChangeRequests = selectedPriority === 'all' 
    ? pendingChangeRequests 
    : pendingChangeRequests.filter(cr => cr.priority === selectedPriority);

  // Handle change request actions
  const handleChangeRequestAction = async (changeRequestId: string, projectId: string, action: 'approve' | 'reject') => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const updatedChangeRequests = project.changeRequests?.map(cr => 
        cr.id === changeRequestId 
          ? { ...cr, status: action === 'approve' ? 'approved' : 'rejected' }
          : cr
      );

      // Update project in Firestore
      await updateDoc(doc(db, 'projects', projectId), {
        changeRequests: updatedChangeRequests
      });

      // Update local state
      setPendingChangeRequests(prev => 
        prev.filter(cr => !(cr.id === changeRequestId && cr.status === 'pending'))
      );

      // Refresh data
      fetchPendingWork();

    } catch (error) {
      console.error('Error updating change request:', error);
      alert('Failed to update change request. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      case 'medium': return { bg: '#fffbeb', text: '#d97706', border: '#fed7aa' };
      case 'low': return { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
      default: return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
      case 'active': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
      case 'completed': return { bg: 'rgba(107, 114, 128, 0.1)', text: '#374151', border: 'rgba(107, 114, 128, 0.2)' };
      case 'on-hold': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
      default: return { bg: 'rgba(107, 114, 128, 0.1)', text: '#374151', border: 'rgba(107, 114, 128, 0.2)' };
    }
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading || !currentUser) {
    return (
      <div style={loadingContainerStyle}>
        <div style={loadingContentStyle}>
          <RefreshCw size={32} style={spinnerStyle} />
          <p style={loadingTextStyle}>Loading pending work...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <div>
              <div style={headerTitleContainerStyle}>
                <h1 style={titleStyle}>Pending Work</h1>
                {currentUser.isOrgAdmin && (
                  <div style={adminBadgeStyle}>
                    <Crown size={14} />
                    <span>Organization Admin</span>
                  </div>
                )}
              </div>
              <p style={subtitleStyle}>
                {pendingChangeRequests.length} pending change requests • {pendingProjects.length} incomplete projects
                {!currentUser.isOrgAdmin && (
                  <span style={accessNoteStyle}> • Showing only your projects</span>
                )}
              </p>
            </div>
            
            <div style={headerActionsStyle}>
              <div style={userInfoStyle}>
                <span style={userNameStyle}>{currentUser.displayName}</span>
                <span style={userRoleStyle}>
                  {currentUser.isOrgAdmin ? 'Admin' : 'User'}
                </span>
              </div>
              <button
                onClick={fetchPendingWork}
                style={refreshButtonStyle}
                title="Refresh data"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Access Info Banner */}
        {!currentUser.isOrgAdmin && (
          <div style={accessInfoBannerStyle}>
            <div style={accessInfoContentStyle}>
              <span style={accessInfoIconStyle}>ℹ️</span>
              <div>
                <strong>Limited Access:</strong> You are viewing pending work only from projects you are a member of.
                Organization Administrators can view all projects.
              </div>
            </div>
          </div>
        )}

        {/* Tabs and Filters */}
        <div style={filtersContainerStyle}>
          <div style={tabsStyle}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'all' ? activeTabButtonStyle : {})
              }}
            >
              All Pending Work
            </button>
            <button
              onClick={() => setActiveTab('change-requests')}
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'change-requests' ? activeTabButtonStyle : {})
              }}
            >
              Change Requests ({pendingChangeRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'projects' ? activeTabButtonStyle : {})
              }}
            >
              Incomplete Projects ({pendingProjects.length})
            </button>
          </div>

          {(activeTab === 'all' || activeTab === 'change-requests') && (
            <div style={priorityFilterStyle}>
              <Filter size={16} />
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                style={filterSelectStyle}
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={contentGridStyle}>
          {/* Change Requests Section */}
          {(activeTab === 'all' || activeTab === 'change-requests') && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <GitPullRequest size={20} style={{ color: '#f59e0b' }} />
                <h2 style={sectionTitleStyle}>Pending Change Requests</h2>
                <span style={countBadgeStyle}>{filteredChangeRequests.length}</span>
              </div>

              {filteredChangeRequests.length === 0 ? (
                <div style={emptyStateStyle}>
                  <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px' }} />
                  <h3 style={emptyStateTitleStyle}>No Pending Change Requests</h3>
                  <p style={emptyStateTextStyle}>
                    {currentUser.isOrgAdmin 
                      ? 'All change requests have been processed. Great work!' 
                      : 'No pending change requests in your projects.'
                    }
                  </p>
                </div>
              ) : (
                <div style={cardsContainerStyle}>
                  {filteredChangeRequests.map((cr, index) => {
                    const priorityColors = getPriorityColor(cr.priority);
                    const daysAgo = getDaysAgo(cr.requestedAt);
                    
                    return (
                      <div key={index} style={cardStyle}>
                        <div style={cardHeaderStyle}>
                          <div style={cardTitleStyle}>
                            {cr.title}
                          </div>
                          <span style={{
                            ...priorityBadgeStyle,
                            backgroundColor: priorityColors.bg,
                            color: priorityColors.text,
                            borderColor: priorityColors.border
                          }}>
                            {cr.priority} priority
                          </span>
                        </div>

                        <div style={cardContentStyle}>
                          <p style={descriptionStyle}>{cr.description}</p>
                          
                          <div style={cardDetailsStyle}>
                            <div style={detailItemStyle}>
                              <Users size={14} />
                              <span>Project: {cr.projectName}</span>
                            </div>
                            <div style={detailItemStyle}>
                              <Users size={14} />
                              <span>Manager: {cr.projectManager}</span>
                            </div>
                            <div style={detailItemStyle}>
                              <Clock size={14} />
                              <span>Impact: +{cr.hoursImpact}h</span>
                            </div>
                            <div style={detailItemStyle}>
                              <Calendar size={14} />
                            <span>Requested: {new Date(cr.requestedAt).toLocaleDateString()}</span>                            </div>
                          </div>
                        </div>

                        <div style={cardActionsStyle}>
                          <button
                            onClick={() => handleChangeRequestAction(cr.id, cr.projectId!, 'approve')}
                            style={approveButtonStyle}
                          >
                            <CheckCircle size={16} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleChangeRequestAction(cr.id, cr.projectId!, 'reject')}
                            style={rejectButtonStyle}
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Incomplete Projects Section */}
          {(activeTab === 'all' || activeTab === 'projects') && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <AlertCircle size={20} style={{ color: '#3b82f6' }} />
                <h2 style={sectionTitleStyle}>Incomplete Projects</h2>
                <span style={countBadgeStyle}>{pendingProjects.length}</span>
              </div>

              {pendingProjects.length === 0 ? (
                <div style={emptyStateStyle}>
                  <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px' }} />
                  <h3 style={emptyStateTitleStyle}>No Incomplete Projects</h3>
                  <p style={emptyStateTextStyle}>
                    {currentUser.isOrgAdmin
                      ? 'All projects are completed. Great work!'
                      : 'No incomplete projects in your assigned projects.'
                    }
                  </p>
                </div>
              ) : (
                <div style={tableContainerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={tableHeaderStyle}>
                        <th style={tableHeaderCellStyle}>Project Name</th>
                        <th style={tableHeaderCellStyle}>Status</th>
                        <th style={tableHeaderCellStyle}>Progress</th>
                        <th style={tableHeaderCellStyle}>Remaining Hours</th>
                        <th style={tableHeaderCellStyle}>Team Size</th>
                        <th style={tableHeaderCellStyle}>Days Remaining</th>
                        <th style={tableHeaderCellStyle}>Pending CRs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingProjects.map((project) => {
                        const pendingCRs = project.changeRequests?.filter(cr => cr.status === 'pending').length || 0;
                        const endDate = new Date(project.endDate);
                        const today = new Date();
                        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const statusColors = getStatusColor(project.status);
                        
                        return (
                          <tr key={project.id} style={tableRowStyle}>
                            <td style={tableCellStyle}>
                              <div style={projectInfoStyle}>
                                <div style={projectNameStyle}>{project.name}</div>
                                <div style={projectManagerStyle}>by {project.manager}</div>
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              <span style={{
                                ...statusBadgeStyle,
                                backgroundColor: statusColors.bg,
                                color: statusColors.text,
                                borderColor: statusColors.border
                              }}>
                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                              </span>
                            </td>
                            <td style={tableCellStyle}>
                              <div style={progressContainerStyle}>
                                <div style={progressBarBackgroundStyle}>
                                  <div style={{
                                    ...progressBarFillStyle,
                                    width: `${project.progress}%`,
                                    backgroundColor: project.progress < 30 ? '#ef4444' : 
                                                   project.progress < 70 ? '#f59e0b' : '#10b981'
                                  }} />
                                </div>
                                <span style={progressTextStyle}>{project.progress}%</span>
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              <div style={hoursStyle}>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>
                                  {project.remainingHours}h
                                </span>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  of {project.totalEfforts}h
                                </span>
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              <div style={teamSizeStyle}>
                                <Users size={14} style={{ color: '#3b82f6' }} />
                                {project.teamMembers.length} members
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              <div style={{
                                ...daysRemainingStyle,
                                color: daysRemaining < 0 ? '#dc2626' : 
                                       daysRemaining < 7 ? '#d97706' : '#059669'
                              }}>
                                {daysRemaining < 0 ? 'Overdue' : `${daysRemaining} days`}
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              {pendingCRs > 0 ? (
                                <span style={pendingCRsStyle}>
                                  {pendingCRs} pending
                                </span>
                              ) : (
                                <span style={noCRsStyle}>None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Updated and New Styles
const containerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  padding: '24px',
  boxSizing: 'border-box',
};

const contentStyle: React.CSSProperties = {
  maxWidth: '1400px',
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  marginBottom: '24px',
};

const headerContentStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  flexWrap: 'wrap',
  gap: '16px'
};

const headerTitleContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '800',
  background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
  marginBottom: '4px',
  margin: '0',
};

const adminBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  backgroundColor: 'rgba(168, 85, 247, 0.1)',
  color: '#8b5cf6',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
  border: '1px solid rgba(168, 85, 247, 0.2)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#64748b',
  fontWeight: '500',
  margin: '0',
};

const accessNoteStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#f59e0b',
  fontStyle: 'italic',
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
};

const userNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#1e293b',
};

const userRoleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '2px 8px',
  borderRadius: '12px',
};

const refreshButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
};

const accessInfoBannerStyle: React.CSSProperties = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fef3c7',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '24px',
};

const accessInfoContentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  fontSize: '14px',
  color: '#92400e',
};

const accessInfoIconStyle: React.CSSProperties = {
  fontSize: '16px',
  flexShrink: 0,
  marginTop: '2px',
};

const filtersContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '32px',
  flexWrap: 'wrap',
  gap: '16px'
};

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  backgroundColor: 'white',
  padding: '4px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const tabButtonStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease',
};

const activeTabButtonStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: 'white',
};

const priorityFilterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 16px',
  backgroundColor: 'white',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const filterSelectStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: '14px',
  backgroundColor: 'transparent',
  color: '#374151',
};

const contentGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #f1f5f9',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#1e293b',
  margin: 0,
};

const countBadgeStyle: React.CSSProperties = {
  padding: '4px 12px',
  backgroundColor: '#3b82f6',
  color: 'white',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
};

const cardsContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
  gap: '20px',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: 'white',
  transition: 'all 0.2s ease',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '16px',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1e293b',
  flex: 1,
  marginRight: '12px',
};

const priorityBadgeStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: '600',
  border: '1px solid',
  whiteSpace: 'nowrap',
};

const cardContentStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#64748b',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const cardDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const detailItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#475569',
};

const cardActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
};

const approveButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#10b981',
  color: 'white',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
  flex: 1,
  justifyContent: 'center',
};

const rejectButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
  flex: 1,
  justifyContent: 'center',
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const tableHeaderStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
};

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '16px 20px',
  textAlign: 'left',
  fontSize: '14px',
  fontWeight: '600',
  color: '#475569',
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px 20px',
  verticalAlign: 'middle',
};

const projectInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const projectNameStyle: React.CSSProperties = {
  fontWeight: '600',
  color: '#1e293b',
  fontSize: '14px',
};

const projectManagerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: '600',
  border: '1px solid',
};

const progressContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: '120px',
};

const progressBarBackgroundStyle: React.CSSProperties = {
  flex: 1,
  height: '6px',
  backgroundColor: '#f1f5f9',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
};

const progressTextStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#475569',
  minWidth: '30px',
};

const hoursStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const teamSizeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  color: '#475569',
};

const daysRemainingStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '600',
};

const pendingCRsStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '8px',
  backgroundColor: '#fef3c7',
  color: '#d97706',
  fontSize: '11px',
  fontWeight: '600',
};

const noCRsStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  fontStyle: 'italic',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '60px 20px',
  textAlign: 'center',
  color: '#64748b',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const emptyStateTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '8px',
};

const emptyStateTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#64748b',
};

const loadingContainerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const loadingContentStyle: React.CSSProperties = {
  textAlign: 'center',
};

const spinnerStyle: React.CSSProperties = {
  animation: 'spin 1s linear infinite',
  color: '#3b82f6',
};

const loadingTextStyle: React.CSSProperties = {
  marginTop: '16px',
  color: '#64748b',
  fontSize: '14px',
};

// Add this to your global CSS or in a style tag
const style = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

export default PendingWork;