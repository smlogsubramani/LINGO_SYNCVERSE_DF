import React from 'react';
import { User, Settings, LogOut, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DfLogo from '../images/DF-Logo.svg';
 
interface NavbarProps {
  username: string;
  roles: string[];
  notificationCount: number;
  showProfile: boolean;
  onProfileToggle: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onMenuToggle: () => void;
}
 
const Navbar: React.FC<NavbarProps> = ({
  username,
  roles,
  showProfile,
  onProfileToggle,
  onNavigate,
  onLogout,
  onMenuToggle,
}) => {
  const profileRef = React.useRef<HTMLDivElement>(null);
 
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        onProfileToggle();
      }
    };
   
    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
   
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfile, onProfileToggle]);
 
  return (
    <nav className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Section - Menu Button and Logo */}
          <div className="flex items-center">
            <button
              onClick={onMenuToggle}
              className="text-gray-600 hover:text-indigo-600 hover:bg-gray-100 p-2 rounded-lg transition-colors mr-2 md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center">
              {/* SVG Logo - Hidden on mobile, visible on medium screens and up */}
              <img
                src={DfLogo}
                alt="Sync Verse Logo"
                className="hidden md:block h-14 w-18 object-contain mr-3"
              />
            </div>
          </div>
         
          {/* Centered Sync Verse Text - Responsive positioning */}
          <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:ml-4">
            <div className="text-lg sm:text-xl font-bold text-gray-800 tracking-wider">
              Sync <span className="text-indigo-600">Verse</span>
            </div>
          </div>
         
          {/* Right Section - Notifications and Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            {/* Notification Icon */}
            {/* <div className="relative">
              <button className="text-gray-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell size={18} className="sm:w-5" />
              </button>
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                  <span className="relative text-[10px]">{notificationCount}</span>
                </span>
              )}
            </div> */}
           
            {/* User Profile Dropdown Toggle */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={onProfileToggle}
                className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition duration-150"
              >
                <div className="h-7 w-7 sm:h-8 sm:w-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {username.charAt(0).toUpperCase()}
                </div>
                {/* User info - Hidden on small mobile, visible on small screens and up */}
                <div className="hidden sm:block text-left">
                  <span className="text-sm font-medium text-gray-700 block">
                    {username.split(' ')[0]}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {roles[0] || 'Guest'}
                  </span>
                </div>
              </button>
 
              {/* Dropdown Menu */}
              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50"
                  >
                    <div className="p-4 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{username}</p>
                      <p className="text-xs text-indigo-600 capitalize mt-1">{roles[0] || 'Guest'}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => onNavigate('/profile')}
                        className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md mx-2 transition duration-100 w-full text-left"
                      >
                        <User size={16} className="mr-3" /> Profile
                      </button>
                      <button
                        onClick={() => onNavigate('/infos')}
                        className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md mx-2 transition duration-100 w-full text-left"
                      >
                        <Settings size={16} className="mr-3" /> Infos
                      </button>
                      <button
                        onClick={() => onNavigate('/change-password')}
                        className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md mx-2 transition duration-100 w-full text-left"
                      >
                        <Settings size={16} className="mr-3" /> Change Password
                      </button>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-md mx-2 transition duration-100"
                      >
                        <LogOut size={16} className="mr-3" /> Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
 
export default Navbar;
 