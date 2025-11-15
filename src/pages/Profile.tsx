'use client';

import React, { useState, useEffect } from 'react';
import {
  Edit2,
  Save,
  X,
  Users,
  User,
  Mail,
  Briefcase,
  Award,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  collection,
  getDocs,
  doc as firestoreDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getDiligenceFabricSDK } from '../services/DFService';

// 1. STYLES (all typed as React.CSSProperties)

//POP UP CSS

const popupStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "#fff",
  borderRadius: "12px",
  padding: "24px",
  width: "360px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  zIndex: 10000,
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0, 0, 0, 0.4)",
  zIndex: 9999,
};

const cancelButton: React.CSSProperties = {
  background: "#e5e7eb",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};

const deleteButton: React.CSSProperties = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};

// OTHER CSS

const modalOverlayStyle: React.CSSProperties = {
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
};

const modalContentStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '20px',
  padding: '32px',
  maxWidth: '600px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1e293b',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '8px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  outline: 'none',
  marginBottom: '12px',
};

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  marginTop: '32px',
  paddingTop: '24px',
  borderTop: '1px solid #e5e7eb',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: 'white',
  color: '#64748b',
  fontWeight: '600',
  fontSize: '14px',
  cursor: 'pointer',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  color: 'white',
  fontWeight: '600',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const addSkillButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  color: 'white',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const skillTagStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)',
  border: '1px solid rgba(59, 130, 246, 0.2)',
  color: '#1e40af',
  fontSize: '12px',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const removeSkillButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  padding: '2px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
};

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '16px 20px',
  textAlign: 'left',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  borderBottom: '2px solid #e2e8f0',
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px 20px',
  verticalAlign: 'top',
};

const skillChipStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.1) 100%)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  color: '#065f46',
  fontSize: '12px',
  fontWeight: '500',
};

const moreSkillsStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '12px',
  background: 'rgba(156, 163, 175, 0.1)',
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '500',
};

const noSkillsStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '12px',
  background: 'rgba(156, 163, 175, 0.1)',
  color: '#6b7280',
  fontSize: '12px',
  fontStyle: 'italic',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const editButtonStyle: React.CSSProperties = {
  padding: '6px',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  backgroundColor: 'white',
  cursor: 'pointer',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const deleteButtonStyle: React.CSSProperties = {
  padding: '6px',
  borderRadius: '6px',
  border: '1px solid #fecaca',
  backgroundColor: '#fef2f2',
  cursor: 'pointer',
  color: '#dc2626',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// 2. TYPES
interface UserProfile {
  name: string;
  email: string;
  dateOfJoining: string;
  role: string;
  experience: string;
  skills: string[];
  bio: string;
  isDFUser?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  dateOfJoining?: string;
  role?: string;
  experience?: string;
  skills?: string[];
  status?: string;
  isDFUser?: boolean;
  [key: string]: any;
}

interface DFUser {
  id: string;
  name: string;
  email: string;
  organization?: string;
}

// 3. MAIN COMPONENT
const Profile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'team'>('profile');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [newSkill, setNewSkill] = useState<string>('');
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState<TeamMember | null>(null);
  //pop up
  const [confirmData, setConfirmData] = useState<{ id: string; name: string } | null>(null);
  const [newMember, setNewMember] = useState<TeamMember>({
    id: '',
    name: '',
    email: '',
    dateOfJoining: '',
    role: '',
    experience: '',
    skills: [],
    status: 'Active',
  });
  const [tempSkill, setTempSkill] = useState<string>('');
  const [dfUsers, setDfUsers] = useState<DFUser[]>([]);
  const [loadingDFUsers, setLoadingDFUsers] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('');
  const [isOrgAdmin, setIsOrgAdmin] = useState<boolean>(false);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    email: '',
    dateOfJoining: '',
    role: '',
    experience: '',
    skills: [],
    bio: '',
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  // 4. HELPERS
  const getUserData = () => {
    const data = JSON.parse(localStorage.getItem('userData') || '{}');
    let role = 'TENUSER';
    try {
      if (data.Token) {
        const base64Url = data.Token.split('.')[1] || '';
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const tokenClaims = JSON.parse(atob(base64));
        role = tokenClaims.Role || 'TENUSER';
      }
    } catch {
      // ignore
    }
    return {
      token: data.Token,
      tenantID: data.TenantID,
      userName: data.UserName || 'TENUSER',
      role,
    };
  };

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

  const getUsernameFromEmail = (email: string) => {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    return atIndex === -1 ? email : email.substring(0, atIndex);
  };

  // 5. FETCH CURRENT USER PROFILE
  const fetchCurrentUserProfile = async () => {
    const userData = getUserData();
    try {
      setProfileLoading(true);
      setUserRole(userData.role);
      setIsOrgAdmin(userData.role === 'ORGADM');

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

      const username = getUsernameFromEmail(userEmail);
      const userProfileRef = firestoreDoc(db, 'users', username);

      const snapshot = await getDocs(collection(db, 'users'));
      let existingProfile: any = null;
      snapshot.forEach((doc) => {
        if (doc.id === username) existingProfile = { id: doc.id, ...doc.data() };
      });

      if (existingProfile) {
        const trimmed = buildNameAndEmail(existingProfile.name || userName).name;
        setUserProfile({
          name: trimmed,
          email: existingProfile.email || userEmail,
          dateOfJoining: existingProfile.dateOfJoining || new Date().toISOString().split('T')[0],
          role: existingProfile.role || 'TENUSER',
          experience: existingProfile.experience || '',
          skills: existingProfile.skills || [],
          bio: existingProfile.bio || `Diligence Fabric user - ${trimmed}`,
        });
      } else {
        const trimmed = buildNameAndEmail(userName).name;
        const profileData = {
          name: trimmed,
          email: userEmail,
          dateOfJoining: new Date().toISOString().split('T')[0],
          role: userData.role || 'TENUSER',
          experience: '',
          skills: [],
          bio: `Diligence Fabric user - ${trimmed}`,
          isDFUser: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userProfileRef, profileData);
        setUserProfile(profileData);
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      const trimmed = buildNameAndEmail(userData.userName).name;
      setUserProfile({
        name: trimmed,
        email: userData.userName ? `${userData.userName}@ubtiinc.com` : 'user@ubtiinc.com',
        dateOfJoining: new Date().toISOString().split('T')[0],
        role: 'TENUSER',
        experience: '',
        skills: [],
        bio: `User profile`,
      });
      setUserRole('TENUSER');
      console.log(userRole)
      setIsOrgAdmin(false);
    } finally {
      setProfileLoading(false);
    }
  };

  // 6. FETCH DF USERS
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
        const users: DFUser[] = response.Result.map((user: any) => {
          const { name, email } = buildNameAndEmail(user.UserName);
          return {
            id: user.UserID,
            name,
            email,
            organization: user.OrganizationName || 'N/A',
          };
        });
        setDfUsers(users);
      }
    } catch (error) {
      console.error('Error fetching DF users:', error);
      setDfUsers([]);
    } finally {
      setLoadingDFUsers(false);
    }
  };

  // 7. LOAD TEAM MEMBERS
  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const members: TeamMember[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...(docSnap.data() || {}) } as TeamMember;
        data.name = buildNameAndEmail(data.name).name;
        members.push(data);
      });
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUserProfile();
    loadTeamMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showAddMemberModal) fetchDFUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMemberModal]);

  // 8. SAVE PROFILE
  const handleSaveProfile = async () => {
    try {
      setIsEditing(false);
      const userData = getUserData();
      let userEmail = userProfile.email || userData.userName;
      if (userEmail && !userEmail.includes('@')) {
        userEmail = `${userEmail}@ubtiinc.com`;
        setUserProfile((p) => ({ ...p, email: userEmail }));
      }
      if (!userEmail) throw new Error('No user email found');

      const username = getUsernameFromEmail(userEmail);
      const snapshot = await getDocs(collection(db, 'users'));
      let exists = false;
      snapshot.forEach((d) => {
        if (d.id === username) exists = true;
      });
      if (!exists) {
        alert('Team member profile should be created first before updating. Please contact your administrator.');
        setIsEditing(true);
        return;
      }

      const ref = firestoreDoc(db, 'users', username);
      const updateData = {
        updatedAt: new Date().toISOString(),
        bio: userProfile.bio,
        skills: userProfile.skills,
      };
      await setDoc(ref, updateData, { merge: true });
      // alert('Profile updated successfully!');
      await loadTeamMembers();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(`Error: ${error.message}`);
      setIsEditing(true);
    }
  };

  // 9. SKILL HANDLERS
  const handleAddSkill = () => {
    if (newSkill.trim() && !userProfile.skills.includes(newSkill.trim())) {
      setUserProfile((p) => ({
        ...p,
        skills: [...p.skills, newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (s: string) =>
    setUserProfile((p) => ({ ...p, skills: p.skills.filter((x) => x !== s) }));

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  // 10. ADD TEAM MEMBER
  const handleAddTeamMember = async () => {
    if (!newMember.name.trim() || !newMember.email.trim()) {
      alert('Please fill in at least name and email');
      return;
    }
    let memberEmail = newMember.email;
    if (memberEmail && !memberEmail.includes('@')) {
      memberEmail = `${memberEmail}@ubtiinc.com`;
      setNewMember((p) => ({ ...p, email: memberEmail }));
    }

    const isDF = dfUsers.some((u) => buildNameAndEmail(u.name).email === memberEmail);
    if (!isDF) {
      alert('Only Diligence Fabric users can be added as team members');
      return;
    }

    try {
      const username = getUsernameFromEmail(memberEmail);
      await setDoc(
        firestoreDoc(db, 'users', username),
        {
          name: newMember.name,
          email: memberEmail,
          dateOfJoining: newMember.dateOfJoining || new Date().toISOString().split('T')[0],
          role: newMember.role,
          experience: newMember.experience,
          skills: newMember.skills,
          status: newMember.status,
          isDFUser: true,
          addedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await loadTeamMembers();
      setNewMember({
        id: '',
        name: '',
        email: '',
        dateOfJoining: '',
        role: '',
        experience: '',
        skills: [],
        status: 'Active',
      });
      setShowAddMemberModal(false);
      alert('Team member added successfully!');
    } catch (e) {
      console.error(e);
      alert('Error adding team member');
    }
  };

   
  // 11. EDIT / DELETE TEAM MEMBER
   
  const handleEditTeamMember = async (memberId: string, updates: Partial<TeamMember>) => {
    try {
      const ref = firestoreDoc(db, 'users', memberId);
      const payload: any = { updatedAt: new Date().toISOString() };
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.experience !== undefined) payload.experience = updates.experience;
      if (updates.skills !== undefined) payload.skills = updates.skills;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.dateOfJoining !== undefined) payload.dateOfJoining = updates.dateOfJoining;
      await setDoc(ref, payload, { merge: true });
      await loadTeamMembers();
      setShowEditMemberModal(null);
      alert('Team member updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Error updating');
    }
  };

  // const handleDeleteTeamMember = async (id: string, name: string) => {
  //   if (window.confirm(`Are you sure you want to delete ${name}?`)) {
  //     try {
  //       await deleteDoc(firestoreDoc(db, 'users', id));
  //       await loadTeamMembers();
  //       alert('Deleted');
  //     } catch (e) {
  //       console.error(e);
  //       alert('Error deleting');
  //     }
  //   }
  // };
   const handleDeleteTeamMember = (id: string, name: string) => {
    setConfirmData({ id, name });
  };

  // 🔹 Confirm deletion
  const confirmDelete = async () => {
    if (!confirmData) return;
    setLoading(true);
    try {
      await deleteDoc(firestoreDoc(db, "users", confirmData.id));
      await loadTeamMembers();
      alert("Deleted successfully");
    } catch (error) {
      console.error(error);
      alert("Error deleting user");
    } finally {
      setLoading(false);
      setConfirmData(null);
    }
  };

  // 🔹 Cancel deletion
  const cancelDelete = () => setConfirmData(null);

   
  // 12. TEMP SKILL HANDLERS
   
  const handleAddTempSkill = () => {
    if (tempSkill.trim() && !newMember.skills?.includes(tempSkill.trim())) {
      setNewMember((p) => ({
        ...p,
        skills: [...(p.skills || []), tempSkill.trim()],
      }));
      setTempSkill('');
    }
  };

  const handleRemoveTempSkill = (s: string) =>
    setNewMember((p) => ({
      ...p,
      skills: (p.skills || []).filter((x) => x !== s),
    }));

  const handleTempSkillKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTempSkill();
    }
  };

  const handleDFUserSelect = (user: DFUser) => {
    const { name, email } = buildNameAndEmail(user.name);
    setNewMember((p) => ({ ...p, name, email }));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Active':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: '#065f46', border: 'rgba(16, 185, 129, 0.3)' };
      case 'On Leave':
        return { bg: 'rgba(245, 158, 11, 0.1)', text: '#92400e', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Inactive':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: '#991b1b', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.1)', text: '#374151', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

   
  // 13. EDIT MODAL
   
  interface EditTeamMemberModalProps {
    member: TeamMember;
    onClose: () => void;
    onSave: (id: string, updates: Partial<TeamMember>) => void;
  }

  const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({ member, onClose, onSave }) => {
    const [formData, setFormData] = useState<TeamMember>({
      id: member.id,
      name: member.name,
      email: member.email,
      dateOfJoining: member.dateOfJoining,
      role: member.role,
      experience: member.experience,
      skills: member.skills || [],
      status: member.status,
    });
    const [editTempSkill, setEditTempSkill] = useState<string>('');

    const handleAdd = () => {
      if (editTempSkill.trim() && !formData.skills?.includes(editTempSkill.trim())) {
        setFormData((p) => ({
          ...p,
          skills: [...(p.skills || []), editTempSkill.trim()],
        }));
        setEditTempSkill('');
      }
    };

    const handleRemove = (s: string) =>
      setFormData((p) => ({
        ...p,
        skills: (p.skills || []).filter((x) => x !== s),
      }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave(member.id, formData);
    };

    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={modalHeaderStyle}>
            <h3 style={modalTitleStyle}>Edit Team Member</h3>
            <button onClick={onClose} style={closeButtonStyle}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" value={formData.name} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={formData.email} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                  style={inputStyle}
                  placeholder="Enter role"
                />
              </div>
              <div>
                <label style={labelStyle}>Experience</label>
                <input
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData((p) => ({ ...p, experience: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g., 2 years"
                />
              </div>
              <div>
                <label style={labelStyle}>Date of Joining</label>
                <input
                  type="date"
                  value={formData.dateOfJoining || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, dateOfJoining: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Skills</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={editTempSkill}
                  onChange={(e) => setEditTempSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  placeholder="Add a skill and press Enter"
                />
                <button type="button" onClick={handleAdd} style={addSkillButtonStyle}>
                  <Plus size={16} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(formData.skills || []).map((s, i) => (
                  <div key={i} style={skillTagStyle}>
                    {s}
                    <button type="button" onClick={() => handleRemove(s)} style={removeSkillButtonStyle}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(formData.skills || []).length === 0 && (
                  <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
                    No skills added yet
                  </div>
                )}
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>
                Cancel
              </button>
              <button type="submit" style={saveButtonStyle}>
                <Save size={16} /> Update Member
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

   
  // 14. RENDER
   
  if (profileLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e2e8f0',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#64748b', fontSize: '16px' }}>Loading your profile...</p>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        padding: '32px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn .3s ease; }
        @keyframes modalFadeIn { from { opacity:0; transform:scale(.9); } to { opacity:1; transform:scale(1); } }
        .modal-fade-in { animation: modalFadeIn .3s ease; }
        @media (max-width:768px) { .profile-container{padding:20px !important;} .stats-grid{grid-template-columns:1fr !important;} .content-grid{grid-template-columns:1fr !important;} }
        .glass-card{background:rgba(255,255,255,.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);}
        .hover-lift{transition:all .3s cubic-bezier(.4,0,.2,1);}
        .hover-lift:hover{transform:translateY(-2px);}
      `}</style>

      {/* ADD MEMBER MODAL */}
      {showAddMemberModal && isOrgAdmin && (
        <div style={modalOverlayStyle}>
          <div className="modal-fade-in" style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Add Team Member</h3>
              <button onClick={() => setShowAddMemberModal(false)} style={closeButtonStyle}>
                <X size={24} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ ...labelStyle, display: 'block' }}>
                Select Diligence Fabric User *
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px', fontWeight: 'normal' }}>
                  (Only DF users can be added)
                </span>
              </label>

              {loadingDFUsers ? (
                <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'center' }}>
                  Loading DF users...
                </div>
              ) : (
                <select
                  value={newMember.email || ''}
                  onChange={(e) => {
                    const u = dfUsers.find((x) => x.email === e.target.value);
                    if (u) handleDFUserSelect(u);
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
                  }}
                >
                  <option value="">Select a user...</option>
                  {dfUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} - {u.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  value={newMember.name}
                  style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b' }}
                  readOnly
                />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={newMember.email}
                  style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b' }}
                  readOnly
                />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <input
                  type="text"
                  value={newMember.role}
                  onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))}
                  style={inputStyle}
                  placeholder="Enter role"
                />
              </div>
              <div>
                <label style={labelStyle}>Experience</label>
                <input
                  type="text"
                  value={newMember.experience}
                  onChange={(e) => setNewMember((p) => ({ ...p, experience: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g., 2 years"
                />
              </div>
              <div>
                <label style={labelStyle}>Date of Joining</label>
                <input
                  type="date"
                  value={newMember.dateOfJoining || ''}
                  onChange={(e) => setNewMember((p) => ({ ...p, dateOfJoining: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={newMember.status}
                  onChange={(e) => setNewMember((p) => ({ ...p, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Skills</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={tempSkill}
                  onChange={(e) => setTempSkill(e.target.value)}
                  onKeyPress={handleTempSkillKeyPress}
                  style={{ flex: 1, ...inputStyle, marginBottom: 0 }}
                  placeholder="Add a skill and press Enter"
                />
                <button type="button" onClick={handleAddTempSkill} style={addSkillButtonStyle}>
                  <Plus size={16} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(newMember.skills || []).map((s, i) => (
                  <div key={i} style={skillTagStyle}>
                    {s}
                    <button type="button" onClick={() => handleRemoveTempSkill(s)} style={removeSkillButtonStyle}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(newMember.skills || []).length === 0 && (
                  <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
                    No skills added yet
                  </div>
                )}
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button type="button" onClick={() => setShowAddMemberModal(false)} style={cancelButtonStyle}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeamMember}
                disabled={!newMember.name || !newMember.email}
                style={{
                  ...saveButtonStyle,
                  background: newMember.name && newMember.email
                    ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                    : '#cbd5e1',
                  cursor: newMember.name && newMember.email ? 'pointer' : 'not-allowed',
                }}
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {showEditMemberModal && isOrgAdmin && (
        <EditTeamMemberModal
          member={showEditMemberModal}
          onClose={() => setShowEditMemberModal(null)}
          onSave={handleEditTeamMember}
        />
      )}

      {/* MAIN LAYOUT */}
      <div className="profile-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              marginBottom: '8px',
            }}
          >
            Profile Management
          </h1>
          <p style={{ fontSize: '16px', color: '#64748b' }}>
            Manage your profile and team information
            {isOrgAdmin && (
              <span
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#1e40af',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                Org Admin
              </span>
            )}
          </p>
        </div>

        {/* STATS CARDS */}
        <div
          className="stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div className="glass-card hover-lift" style={{
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{teamMembers.length}</div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Team Members</div>
              </div>
            </div>
          </div>
          <div className="glass-card hover-lift" style={{
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <Award size={24} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{userProfile.experience || '0 years'}</div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Your Experience</div>
              </div>
            </div>
          </div>
          <div className="glass-card hover-lift" style={{
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <Briefcase size={24} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{userProfile.skills.length}</div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Your Skills</div>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255,255,255,.6)',
            padding: '6px',
            borderRadius: '14px',
            border: '1px solid rgba(226,232,240,.6)',
            backdropFilter: 'blur(10px)',
          }}>
            {[
              { id: 'profile', label: 'My Profile', icon: User },
              { id: 'team', label: 'Team', icon: Users },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === t.id ? 'rgba(255,255,255,.9)' : 'transparent',
                    color: activeTab === t.id ? '#1e293b' : '#64748b',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all .2s ease',
                    boxShadow: activeTab === t.id ? '0 4px 12px rgba(0,0,0,.1)' : 'none',
                  }}
                  onClick={() => setActiveTab(t.id as any)}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'team' && isOrgAdmin && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all .2s ease',
                boxShadow: '0 4px 12px rgba(16,185,129,.3)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(16,185,129,.4)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(16,185,129,.3)';
              }}
            >
              <Plus size={16} /> Add Team Member
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div
          className="content-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: activeTab === 'profile' ? '1fr 400px' : '1fr',
            gap: '32px',
          }}
        >
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <>
              <div className="glass-card fade-in" style={{
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 4px 24px rgba(0,0,0,.06)',
                background: 'rgba(255,255,255,.8)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                  <h2 style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Personal Information</h2>
                  <button
                    onClick={() => (isEditing ? handleSaveProfile() : setIsEditing(true))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isEditing ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all .2s ease',
                      boxShadow: '0 4px 12px rgba(59,130,246,.3)',
                    }}
                  >
                    {isEditing ? <Save size={16} /> : <Edit2 size={16} />}
                    {isEditing ? 'Save Changes' : 'Edit Profile'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input type="text" value={userProfile.name} style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b' }} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b' }}>
                      <Mail size={16} />
                      {userProfile.email}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Date of Joining</label>
                    <input type="date" value={userProfile.dateOfJoining || ''} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Role</label>
                    <input type="text" value={userProfile.role} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} readOnly />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Bio</label>
                  <textarea
                    value={userProfile.bio}
                    onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                    disabled={!isEditing}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px',
                      backgroundColor: isEditing ? 'white' : '#f8fafc',
                      color: '#1e293b',
                      outline: 'none',
                      minHeight: '100px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div className="glass-card fade-in" style={{
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 4px 24px rgba(0,0,0,.06)',
                background: 'rgba(255,255,255,.8)',
                height: 'fit-content',
              }}>
                <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>Skills & Expertise</h3>
                {isEditing && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add a new skill..."
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}
                    />
                    <button onClick={handleAddSkill} style={addSkillButtonStyle}>
                      <Plus size={16} /> Add
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {userProfile.skills.map((skill, index) => (
                    <div key={index} style={skillTagStyle}>
                      {skill}
                      {isEditing && (
                        <button onClick={() => handleRemoveSkill(skill)} style={removeSkillButtonStyle}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {userProfile.skills.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>No skills added yet</div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TEAM TAB */}
          {activeTab === 'team' && (
            <div className="glass-card fade-in" style={{
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 24px rgba(0,0,0,.06)',
              background: 'rgba(255,255,255,.8)',
              overflow: 'hidden',
            }}>
              <h2 style={{ margin: '0 0 32px 0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Team </h2>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: '#64748b' }}>Loading team members...</div>
              ) : teamMembers.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', color: '#64748b', textAlign: 'center' }}>
                  <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Team Members</h3>
                  <p style={{ margin: 0 }}>Get started by adding your first team member.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  {confirmData && (
                  <>
                    <div style={backdropStyle} onClick={cancelDelete} />
                    <div style={popupStyle}>
                      <h3 style={{ marginBottom: "12px" }}>Confirm Deletion</h3>
                      <p style={{ marginBottom: "20px", color: "#374151" }}>
                        Are you sure you want to delete <b>{confirmData.name}</b>?
                      </p>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button onClick={cancelDelete} style={cancelButton}>
                          Cancel
                        </button>
                        <button onClick={confirmDelete} style={deleteButton} disabled={loading}>
                          {loading ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                        <th style={tableHeaderCellStyle}>Name</th>
                        <th style={tableHeaderCellStyle}>Role</th>
                        <th style={tableHeaderCellStyle}>Experience</th>
                        <th style={tableHeaderCellStyle}>Skills</th>
                        <th style={tableHeaderCellStyle}>Join Date</th>
                        <th style={tableHeaderCellStyle}>Status</th>
                        {isOrgAdmin && <th style={tableHeaderCellStyle}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member, index) => {
                        const statusColor = getStatusColor(member.status);
                        const isCurrentUser = member.email === userProfile.email;

                        return (
                          <tr
                            key={member.id}
                            style={{
                              backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc',
                              transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = index % 2 === 0 ? 'white' : '#fafbfc'}
                          >
                            <td style={tableCellStyle}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                  {member.name}
                                  {member.isDFUser && (
                                    <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#1e40af', fontSize: '10px', fontWeight: '500' }}>DF User</span>
                                  )}
                                  {isCurrentUser && (
                                    <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#065f46', fontSize: '10px', fontWeight: '500' }}>You</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{member.email}</div>
                              </div>
                            </td>
                            <td style={tableCellStyle}>{member.role}</td>
                            <td style={tableCellStyle}>{member.experience}</td>
                            <td style={tableCellStyle}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '200px' }}>
                                {(member.skills || []).slice(0, 3).map((skill, i) => (
                                  <span key={i} style={skillChipStyle}>{skill}</span>
                                ))}
                                {member.skills && member.skills.length > 3 && <span style={moreSkillsStyle}>+{member.skills.length - 3} more</span>}
                                {(!member.skills || member.skills.length === 0) && <span style={noSkillsStyle}>No skills</span>}
                              </div>
                            </td>
                            <td style={tableCellStyle}>{member.dateOfJoining ? new Date(member.dateOfJoining).toLocaleDateString() : 'N/A'}</td>
                            <td style={tableCellStyle}>
                              <span style={{ ...statusBadgeStyle, backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}>
                                {member.status}
                              </span>
                            </td>
                            {isOrgAdmin && (
                              <td style={tableCellStyle}>
                                <div style={actionsStyle}>
                                  <button onClick={() => setShowEditMemberModal(member)} style={editButtonStyle} title="Edit Member">
                                    <Edit2 size={14} />
                                  </button>
                                  {!isCurrentUser && (
                                    <button onClick={() => handleDeleteTeamMember(member.id, member.name)} style={deleteButtonStyle} title="Delete Member">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
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

export default Profile;