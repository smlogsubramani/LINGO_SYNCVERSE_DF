// src/components/SupportDashboard.tsx
import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from '../firebase';
import ticketService, { Ticket as ServiceTicket } from "../services/ticketServices";
import { getDiligenceFabricSDK } from '../services/DFService';

// --- TYPE DEFINITIONS (Unchanged, for clarity and robustness) ---
interface User {
    id: string;
    name: string;
    role: 'client' | 'admin' | 'developer';
}
interface Ticket {
    id: string;
    ticketCode?: string;
    title: string;
    description: string;
    category?: string;
    subCategory?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status: 'open' | 'in-progress' | 'resolved' | 'rejected' | 'approved';
    createdBy: string;
    type?: 'client' | 'contact_request';
    createdAt: Date;
    updatedAt: Date;
    requestedDeveloper?: string;
    contactReason?: string;
    assignedToName?: string;
    rejectionReason?: string;
}
interface NewTicketData {
    category: string;
    subCategory: string;
    subject: string;
    description: string;
    priority: Ticket['priority'];
    requestedDeveloper?: string;
    contactReason?: string;
}
interface Developer {
    id: string;
    name: string;
    email: string;
    avatar: string;
}
interface SupportDashboardProps {
  user?: User;
}

// --- MOCK Internal user (fallback if no prop provided) ---
const mockUser: User = {
    id: 'user-xyz-123',
    name: 'Jane Doe',
    role: 'client'
};

const SupportDashboard: React.FC<SupportDashboardProps> = ({ user: userProp }) => {
    const user = userProp ?? mockUser;
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [showContactResource, setShowContactResource] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'new-ticket' | 'assigned-tickets'>('overview');
// Add this near your other state declarations
const [currentUserRole, setCurrentUserRole] = useState<'ORGADM' | 'TENUSER' | null>(null);
const [approle, setapprole] = useState<string>('');

// Add this useEffect to get user data
useEffect(() => {
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

  const userData = getUserData();
  setCurrentUserRole(userData.isOrgAdmin ? 'ORGADM' : 'TENUSER');
  
  UserAppInfo();
    }, []);
// Add this function inside your component
const UserAppInfo = async () => {
  try {
    const data = JSON.parse(localStorage.getItem('userData') || '{}');
    const tenantID = data.TenantID || 282;
    
    // You'll need to import your SDK and implement this properly
    // This is a simplified version - adapt from your ProjectDetails
    const sdk = getDiligenceFabricSDK(); // You'll need to import this
    const appRoleService = sdk.getApplicationRoleService();
    const response = await appRoleService.getUserAppRole({ tenantID }, 'read');
    
    const appRolesString = response?.Result?.[0]?.AppRoles;
    if (appRolesString) {
      const appRoles = JSON.parse(appRolesString);
      const adminRole = appRoles.find((role: any) => role.AppRoleName === 'Admin');
      if (adminRole) {
        setapprole(adminRole.AppRoleName);
        console.log('Admin role found:', adminRole.AppRoleName);    
        console.log('Tenuser or Orgadm:', currentUserRole);  
      } else {
        setapprole(appRoles[0]?.AppRoleName || '');
      }
    }
  } catch (error) {
    console.error('Error fetching user app role:', error);
  }
};

// Then call it in your useEffect
useEffect(() => {
  // ... existing getUserData logic
  UserAppInfo();
}, []);
    const ticketCategories: { [key: string]: string[] } = {
        'general-support': [
            'Platform Usage Help', 'Feature Requests', 'Bug Reports', 'How-to Guides', 'Contact Another Resource'
        ],
        'billing-payments': [
            'Invoice Issues', 'Payment Failures', 'Refund Requests', 'Billing Questions'
        ],
        'account-management': [
            'Password Reset', 'Profile Updates', 'Account Deactivation', 'Access Issues'
        ]
    };

    const availableDevelopers: Developer[] = [
        { id: 'dev001', name: 'Thameem', email: 'thameemmulansari.s@ubtiinc.com', avatar: '👨‍💻' },
        { id: 'dev002', name: 'Prathyusha', email: 'prathyusha.n@ubtiinc.com', avatar: '👩‍💻' },
        { id: 'dev002', name: 'suaman.m', email: 'sumana.m@ubtiinc.com', avatar: '👩‍💻' },
        
    ];

    const autoFillSubjects: { [key: string]: string } = {
        'Platform Usage Help': 'Need assistance with platform navigation and features',
        'Feature Requests': 'Feature enhancement request for the platform',
        'Bug Reports': 'Bug report - issue encountered while using platform',
        'Invoice Issues': 'Issue with invoice or billing statement',
        'Contact Another Resource': 'Request to contact different developer resource'
    };

    const faqs = [
        { question: "How quickly will my ticket be responded to?", answer: "General support tickets are typically responded to within 24 hours. Urgent priority tickets receive faster response times, usually within 4-6 hours during business days." },
        { question: "What information should I include in my ticket?", answer: "Please include detailed steps to reproduce the issue, screenshots if applicable, your platform/browser information, and any error messages you've encountered." },
        { question: "How do I request access to a different developer?", answer: "Select 'Contact Another Resource' in the Specific Issue dropdown, then choose the developer you need to contact and provide a reason for your request." },
        { question: "Can I update my ticket after submission?", answer: "Currently, tickets cannot be edited after submission. Please create a new ticket with additional information or follow-up questions." },
        { question: "What's the difference between ticket priorities?", answer: "Low: Non-urgent issues, Medium: Important but not critical, High: Affecting core functionality, Urgent: System down or critical business impact." }
    ];

    // ---------------- Firestore Subscription ----------------
    useEffect(() => {
      const q = collection(db, 'tickets');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const ticketData: Ticket[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Omit<Ticket, 'id'>;
            return { id: docSnap.id, ...data };
          });
          setTickets(ticketData);
        },
        (error) => {
          console.error('Error fetching tickets:', error);
        }
      );
      return () => unsubscribe();
    }, []);

    const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>, form: HTMLFormElement) => {
        const subCategory = e.target.value;
        setShowContactResource(subCategory === 'Contact Another Resource');
        const subjectInput = form.elements.namedItem('subject') as HTMLInputElement;
        if (subjectInput && autoFillSubjects[subCategory]) {
            subjectInput.value = autoFillSubjects[subCategory];
        } else if (subjectInput) {
            subjectInput.value = '';
        }
    };

    const handleCreateTicket = async (ticketData: NewTicketData) => {
  setLoading(true);
  try {
    const ticketCode = `TKT-${Date.now()}`;
    const payload: Omit<ServiceTicket, 'id' | 'createdAt' | 'updatedAt'> = {
      ticketCode,
      title: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category,
      subCategory: ticketData.subCategory,
      priority: ticketData.priority,
      status: 'open',
      createdBy: user.id,
      type: 'client',
    } as any;
    
    if (ticketData.subCategory === 'Contact Another Resource') {
      payload.requestedDeveloper = ticketData.requestedDeveloper;
      payload.contactReason = ticketData.contactReason;
      payload.type = 'contact_request';
    }

    console.log('📤 Creating ticket with payload:', payload);

    const ticketId = await ticketService.createTicket(payload);
    console.log('✅ Ticket created with ID:', ticketId);

    const optimisticTicket: Ticket = {
      ...payload as any,
      id: ticketId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setTickets((prev) => [optimisticTicket, ...prev]);
      // --- POWER AUTOMATE INTEGRATION START ---
        const powerAutomateUrl = 'https://default008502d63f7946f0ab379354e3fe80.ff.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/99d2f8ba050b43b0ac1a580efeab8e34/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=dJMsLW7J4p2qFnGCicP5dpufBuwVVOhEEFr-NZ5z3ZE';
        const emailPayload = {
          ticketCode: ticketCode,
          title: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          subCategory: ticketData.subCategory,
          priority: (ticketData.priority || 'medium').charAt(0).toUpperCase() + (ticketData.priority || 'medium').slice(1),
          createdBy: user.name,
          createdById: user.id,
          requestedDeveloper: ticketData.requestedDeveloper || null,
          contactReason: ticketData.contactReason || null,
          ticketId: ticketId,
          createdAt: new Date().toISOString()
        };
        fetch(powerAutomateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload)
        })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          console.log('Power Automate triggered successfully');
        })
        .catch(error => {
          console.error('Failed to trigger Power Automate:', error);
        });
        // --- POWER AUTOMATE INTEGRATION END ---
    
    alert('✅ Ticket created successfully! You can view it in the Tickets tab.');
    setActiveTab('tickets');
    
  } catch (error) {
    console.error('❌ Error creating ticket:', error);
    alert('Failed to create ticket. Please try again.');
  } finally {
    setLoading(false);
  }
};

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Log form data for debugging
    console.log('📋 Form data:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }

    const subCategory = formData.get('subCategory') as string;
    const ticketData: NewTicketData = {
        category: formData.get('category') as string,
        subCategory: subCategory,
        description: formData.get('description') as string,
        subject: formData.get('subject') as string,
        priority: formData.get('priority') as Ticket['priority'],
    };
   
    if (subCategory === 'Contact Another Resource') {
        const requestedDeveloper = formData.get('requestedDeveloper') as string;
        const contactReason = formData.get('contactReason') as string;
        
        console.log('👥 Contact request details:', { requestedDeveloper, contactReason });
        
        if (!requestedDeveloper || !contactReason) {
            alert('Please select a developer and provide a reason for contact.');
            return;
        }
        ticketData.requestedDeveloper = requestedDeveloper;
        ticketData.contactReason = contactReason;
    }
    
    console.log('🚀 Final ticket data:', ticketData);
    handleCreateTicket(ticketData);
    form.reset();
    setShowContactResource(false);
};

    const toggleFaq = (index: number) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    const getStatusColor = (status: Ticket['status'] | undefined) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            'open': { bg: '#FFFBEB', text: '#D97706', border: '#FBBF24' },
            'in-progress': { bg: '#EFF6FF', text: '#1D4ED8', border: '#60A5FA' },
            'resolved': { bg: '#F0FDF4', text: '#047857', border: '#34D399' },
            'rejected': { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
            'approved': { bg: '#ECFDF5', text: '#059669', border: '#10B981' }
        };
        const key = status?.toLowerCase()?.trim() ?? 'open';
        return colors[key] ?? colors['open'];
    };

    const getPriorityColor = (priority: Ticket['priority'] | undefined) => {
        const colors: Record<string, { bg: string; text: string }> = {
            'urgent': { bg: '#FEF2F2', text: '#DC2626' },
            'high': { bg: '#FFFBEB', text: '#D97706' },
            'medium': { bg: '#EFF6FF', text: '#1D4ED8' },
            'low': { bg: '#F8FAFC', text: '#64748B' }
        };
        const key = priority?.toLowerCase()?.trim() ?? 'medium';
        return colors[key] ?? colors['medium'];
    };

    // ------------------- Close Ticket Handler -------------------
    const handleCloseTicket = async (ticketId: string) => {
        if (!window.confirm('Are you sure you want to close this ticket?')) return;

        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            await updateDoc(ticketRef, {
                status: 'resolved',
                updatedAt: new Date()
            });
            setTickets((prev) =>
                prev.map(t =>
                    t.id === ticketId ? { ...t, status: 'resolved' as const, updatedAt: new Date() } : t
                )
            );
            alert('✅ Ticket closed successfully.');
        } catch (error) {
            console.error('Error closing ticket:', error);
            alert('Failed to close ticket. Please try again.');
        }
    };

    // ------------------- Approve / Reject Handler (with In-Progress transition) -------------------
    const handleTicketDecision = async (ticketId: string, decision: 'approved' | 'rejected') => {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            const currentTicket = tickets.find(t => t.id === ticketId);
            if (!currentTicket) return;

            const updates: any = {
                updatedAt: new Date()
            };

            if (decision === 'approved') {
                updates.status = 'in-progress';
                updates.assignedToName = currentTicket.requestedDeveloper;
            } else {
                updates.status = 'rejected';
                updates.rejectionReason = 'Request denied by support team.';
            }

            await updateDoc(ticketRef, updates);

            setTickets((prev) =>
                prev.map(t => {
                    if (t.id === ticketId) {
                        return {
                            ...t,
                            status: decision === 'approved' ? 'in-progress' as const : 'rejected' as const,
                            assignedToName: decision === 'approved' ? t.requestedDeveloper : t.assignedToName,
                            rejectionReason: decision === 'rejected' ? 'Request denied by support team.' : t.rejectionReason,
                            updatedAt: new Date()
                        };
                    }
                    return t;
                })
            );

            alert(`Ticket ${decision === 'approved' ? 'approved and in progress' : 'rejected'}.`);
        } catch (error) {
            console.error('Error updating ticket status:', error);
            alert('Failed to update ticket status. Please try again.');
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <>
                        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1F2937', marginBottom: '28px' }}>Dashboard Overview</h2>
                       
                        {/* Stats Cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '20px',
                            marginBottom: '32px'
                        }}>
                            {[
                                { title: 'Total Tickets', value: tickets.length, icon: '📋', color: '#3B82F6' },
                                { title: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, icon: '⏳', color: '#F59E0B' },
                                { title: 'In Progress', value: tickets.filter(t => t.status === 'in-progress').length, icon: '🔄', color: '#8B5CF6' },
                                { title: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, icon: '✅', color: '#10B981' }
                            ].map((stat, index) => (
                                <div
                                    key={index}
                                    className="glass-card hover-lift"
                                    style={{
                                        padding: '24px',
                                        borderRadius: '16px',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                                        border: `1px solid rgba(255, 255, 255, 0.3)`,
                                        background: 'white',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>{stat.title}</div>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '12px',
                                            background: `linear-gradient(135deg, ${stat.color}20 0%, ${stat.color}40 100%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                                        }}>{stat.icon}</div>
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>{stat.value}</div>
                                    <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>All time</div>
                                </div>
                            ))}
                        </div>
                       
                        {/* FAQs Section */}
                        <div className="glass-card" style={{
                            borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', background: 'white'
                        }}>
                            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1F2937' }}>Frequently Asked Questions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {faqs.map((faq, index) => (
                                    <div key={index} style={{
                                        border: '1px solid #F3F4F6', borderRadius: '12px', overflow: 'hidden', background: 'white'
                                    }}>
                                        <button
                                            onClick={() => toggleFaq(index)}
                                            style={{
                                                width: '100%', padding: '20px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', fontWeight: '600', color: '#374151', transition: 'background-color 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                        >
                                            {faq.question}
                                            <span style={{
                                                transform: activeFaq === index ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.3s ease', color: '#3B82F6'
                                            }}>▼</span>
                                        </button>
                                        {activeFaq === index && (
                                            <div style={{
                                                padding: '20px', borderTop: '1px solid #F3F4F6', fontSize: '14px',
                                                color: '#6B7280', lineHeight: '1.6', background: '#F9FAFB'
                                            }}>
                                                {faq.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );

            case 'tickets':
                return (
                    <div className="glass-card" style={{
                        borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', background: 'white'
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
                        }}>
                            <h2 style={{ margin: '0', fontSize: '24px', fontWeight: '600', color: '#1F2937' }}>My Active Tickets</h2>
                            <span style={{ padding: '4px 12px', background: '#E0F2F7', borderRadius: '20px', fontSize: '14px', fontWeight: '600', color: '#065F46' }}>
                                Total: {tickets.length}
                            </span>
                        </div>
                       
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '16px'
                        }}>
                            {tickets.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
                                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', fontSize: '16px' }}>No tickets found</p>
                                    <button
                                        onClick={() => setActiveTab('new-ticket')}
                                        style={{ marginTop: '16px', padding: '10px 20px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                    >Create New Ticket</button>
                                </div>
                            ) : (
                                tickets
                                .slice()
                                .map(ticket => {
                                    const statusColor = getStatusColor(ticket.status);
                                    const priorityColor = getPriorityColor(ticket.priority || 'medium');
                                    const showCloseButton = (ticket.status === 'open' || ticket.status === 'in-progress') && ticket.type !== 'contact_request';

                                    return (
                                        <div
                                            key={ticket.id}
                                            className="hover-lift"
                                            style={{ padding: '20px', border: `1px solid ${statusColor.border}20`, borderRadius: '12px', background: 'white', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = statusColor.border; e.currentTarget.style.boxShadow = '0 6px 15px rgba(0, 0, 0, 0.08)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${statusColor.border}20`; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#3B82F6', letterSpacing: '0.5px' }}>{ticket.ticketCode}</span>
                                                <span style={{ fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '20px', background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}30` }}>
                                                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('-', ' ')}
                                                </span>
                                            </div>
                                           
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', marginBottom: '12px', lineHeight: '1.4' }}>{ticket.title}</div>

                                            {/* Conditional Rendering for Contact Request Status */}
                                            {ticket.type === 'contact_request' && (
                                                <div style={{ marginBottom: '12px' }}>
                                                    {ticket.status === 'open' && (
                                                        <span style={{ fontSize: '12px', color: '#D97706', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>⏳</span> Waiting for approval
                                                        </span>
                                                    )}
                                                    {ticket.status === 'in-progress' && ticket.assignedToName && (
                                                        <span style={{ fontSize: '12px', color: '#059669', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>✅</span> Assigned to: **{ticket.assignedToName}**
                                                        </span>
                                                    )}
                                                    {ticket.status === 'rejected' && ticket.rejectionReason && (
                                                        <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>❌</span> Rejected: {ticket.rejectionReason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Close Button */}
                                            {showCloseButton && (
                                                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCloseTicket(ticket.id);
                                                        }}
                                                        style={{
                                                            padding: '6px 14px',
                                                            background: '#10B981',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Close Ticket
                                                    </button>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6B7280', borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                                                <span style={{ textTransform: 'capitalize' }}>{(ticket.category || '').replace('-', ' ')}</span>
                                                <span style={{ padding: '4px 10px', borderRadius: '12px', background: priorityColor.bg, color: priorityColor.text, fontWeight: '600', fontSize: '11px' }}>
                                                    {ticket.priority ? (ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)) : 'Medium'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );

            case 'new-ticket':
                return (
                    <div className="glass-card" style={{
                        borderRadius: '16px',
                        padding: '32px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                        background: 'white'
                    }}>
                        <h2 style={{
                            margin: '0 0 28px 0', fontSize: '24px', fontWeight: '600', color: '#1F2937'
                        }}>Create Support Ticket</h2>
                       
                        <form onSubmit={handleSubmit} style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '20px'
                        }}>
                            {/* Category Select */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Category</label>
                                <select name="category" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white' }} required>
                                    <option value="">Select Category</option>
                                    {Object.keys(ticketCategories).map((cat: string) => (
                                        <option key={cat} value={cat}>
                                            {cat.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Specific Issue Select */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Specific Issue</label>
                                <select name="subCategory" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white' }} required onChange={(e) => handleSubCategoryChange(e, e.target.form!)}>
                                    <option value="">Select Specific Issue</option>
                                    {Object.keys(ticketCategories).map((cat) => (
                                        ticketCategories[cat].map(subCat => (
                                            <option key={subCat} value={subCat}>{subCat}</option>
                                        ))
                                    ))}
                                </select>
                            </div>
                            {/* Requested Developer and Reason Fields (Conditional) */}
                            {showContactResource && (
                                <>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Requested Developer</label>
                                        <select name="requestedDeveloper" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white' }} required>
                                            <option value="">Select Developer</option>
                                            {availableDevelopers.map(dev => (
                                                <option key={dev.id} value={dev.name}>
                                                    {dev.avatar} {dev.name} ({dev.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Reason for Contact</label>
                                        <textarea name="contactReason" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }} required placeholder="Please explain why you need to contact this specific developer..."/>
                                    </div>
                                </>
                            )}
                            {/* Subject Input (Full width) */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Subject</label>
                                <input type="text" name="subject" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white' }} required placeholder="Brief summary of your issue"/>
                            </div>
                            {/* Detailed Description (Full width) */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Detailed Description</label>
                                <textarea name="description" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white', minHeight: '140px', resize: 'vertical', fontFamily: 'inherit' }} required placeholder="Please provide detailed information about your issue..."/>
                            </div>
                            {/* Priority Select */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Priority</label>
                                <select name="priority" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', backgroundColor: 'white' }} required defaultValue="medium">
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            {/* Submit Button */}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '24px' }}>
                                <button type="submit" style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', opacity: loading ? 0.7 : 1 }} disabled={loading}
                                    onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)'; }}}
                                    onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}}
                                >
                                    {loading ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                            Creating Ticket...
                                        </span>
                                    ) : (
                                        'Submit Ticket'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                );

            case 'assigned-tickets':
                const assignedTickets = tickets.filter(
                    t => t.subCategory === 'Contact Another Resource' && t.type === 'contact_request' && t.status === 'open'
                );
                return (
                    
                    <div className="glass-card" style={{
                        borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', background: 'white'
                    }}>
                        <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '600', color: '#1F2937' }}>Assigned Tickets</h2>
                        {assignedTickets.length === 0 ? (
                            <p style={{ color: '#9CA3AF' }}>No assigned tickets found.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {assignedTickets.map(ticket => {
                                    const statusColor = getStatusColor(ticket.status);
                                    return (
                                        <div key={ticket.id} style={{ padding: '16px', border: `1px solid ${statusColor.border}20`, borderRadius: '12px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{ticket.title}</div>
                                                <div style={{ fontSize: '12px', color: '#6B7280' }}>Requested: {ticket.requestedDeveloper}</div>
                                                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{ticket.contactReason}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    style={{ padding: '8px 16px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                    onClick={() => handleTicketDecision(ticket.id, 'approved')}
                                                >Approve</button>
                                                <button
                                                    style={{ padding: '8px 16px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                    onClick={() => handleTicketDecision(ticket.id, 'rejected')}
                                                >Reject</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="support-dashboard" style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '24px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .hover-lift:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
                }
                input:focus, textarea:focus, select:focus {
                    border-color: #3B82F6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        Support Dashboard
                    </h1>
                    <p style={{ margin: '0', color: '#64748B', fontSize: '14px' }}>
                        Get help and manage your support tickets
                    </p>
                </div>
               
            </div>

            {/* Navigation Tabs */}
            {/* Navigation Tabs */}
<div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'white', padding: '4px', borderRadius: '12px', border: '1px solid #E2E8F0', width: 'fit-content' }}>
  {['overview', 'tickets', 'new-ticket', ...(currentUserRole === 'ORGADM' && approle?.toLowerCase() === 'admin' ? ['assigned-tickets'] : [])].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        style={{
                            padding: '12px 24px', borderRadius: '8px', border: 'none',
                            background: activeTab === tab ? '#3B82F6' : 'transparent',
                            color: activeTab === tab ? 'white' : '#64748B',
                            fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                    >
                        {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default SupportDashboard;