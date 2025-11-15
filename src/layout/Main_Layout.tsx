import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { MenuItem } from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/Authcontext';

const Main_Layout: React.FC = () => {
  const { user } = useAuth(); // This is now safe to use
  const navigate = useNavigate();
  const location = useLocation();
  
  // State management for layout
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>(
    location.pathname.split('/')[1] || 'dashboard'
  );
  const [openMenus, setOpenMenus] = useState<{ [key: number]: boolean }>({});
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Update active menu when route changes
  useEffect(() => {
    const currentPath = location.pathname.split('/')[1] || 'dashboard';
    setActiveMenu(currentPath);
  }, [location.pathname]);

  // Optimized event handlers using useCallback
  const handleProfileToggle = useCallback(() => {
    setShowProfile(prev => !prev);
  }, []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    setShowProfile(false);
    setSidebarOpen(false);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    console.log('Logging out...');
    navigate('/login');
  }, [navigate]);

  const handleMenuClick = useCallback((id: string, route: string) => {
    setActiveMenu(id);
    if (route && route !== '#') {
      navigate(route);
    }
    setSidebarOpen(false);
  }, [navigate]);

  const generateRoute = useCallback((item: MenuItem): string => {
  // Use AppMenuURL directly if it exists, otherwise fall back to converting label
    let route = item.AppMenuURL;
    
    if (!route && item.AppMenuLabel) {
      // Convert label to lowercase route as fallback
      route = '/' + item.AppMenuLabel.toLowerCase().replace(/\s+/g, '-');
    }
    
    return route || '/dashboard';
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-inter flex flex-col">
      {/* Mobile sidebar overlay */}
      <style>{`
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 40;
        }

        @media (min-width: 768px) {
          .sidebar-overlay {
            display: none;
          }
        }
      `}</style>
      
      {/* Navbar */}
      <Navbar
        username={user?.FirstName || user?.UserName || 'User'}
        roles={user?.Roles ? [user.Roles] : ['Guest']}
        notificationCount={3}
        showProfile={showProfile}
        onProfileToggle={handleProfileToggle}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onMenuToggle={toggleSidebar}
      />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeMenu={activeMenu}
          openMenus={openMenus}
          handleMenuClick={handleMenuClick}
          setOpenMenus={setOpenMenus}
          generateRoute={generateRoute}
          isMobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area - This renders all page components */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Main_Layout;