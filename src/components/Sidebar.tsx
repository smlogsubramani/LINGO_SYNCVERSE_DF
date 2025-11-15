import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getDiligenceFabricSDK } from "../services/DFService";

export interface MenuItem {
  AppMenuID: number;
  AppMenuLabel: string;
  AppMenuURL?: string;
  ParenAppMenuID: number;
  children: MenuItem[];
}

interface SidebarProps {
  activeMenu: string;
  openMenus: { [key: number]: boolean };
  handleMenuClick: (id: string, route: string) => void;
  setOpenMenus: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
  generateRoute: (item: MenuItem) => string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  openMenus,
  handleMenuClick,
  setOpenMenus,
  generateRoute,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Get user token + tenant info from localStorage
  const getUserData = () => {
    const data = JSON.parse(localStorage.getItem("userData") || "{}");
    return {
      token: data.Token,
      tenantID: data.TenantID,
    };
  };

  // Fetch Menu Items from Diligence Fabric SDK
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const { token, tenantID } = getUserData();
        if (!token || !tenantID) throw new Error("Missing auth details");

        const client = getDiligenceFabricSDK();
        client.setAuthUser({ Token: token });

        const response = await client
          .getApplicationRoleService()
          .getAllAccessibleMenus();

        if (!Array.isArray(response)) throw new Error("Invalid menu response");

        const nested = buildNestedMenu(response);
        setMenuItems(nested);
      } catch (err: any) {
        console.error("Sidebar menu fetch error:", err);
        setError("Failed to load menu. Please login again.");
        setTimeout(() => navigate("/login"), 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, [navigate]);

  // Build Nested Menu Tree
  const buildNestedMenu = (items: MenuItem[]): MenuItem[] => {
    const map = new Map<number, MenuItem>();
    const roots: MenuItem[] = [];

    items.forEach((item) => map.set(item.AppMenuID, { ...item, children: [] }));

    items.forEach((item) => {
      if (item.ParenAppMenuID && map.has(item.ParenAppMenuID)) {
        map.get(item.ParenAppMenuID)!.children.push(map.get(item.AppMenuID)!);
      } else {
        roots.push(map.get(item.AppMenuID)!);
      }
    });

    return roots;
  };

  // Handle menu item click
  const handleItemClick = (item: MenuItem) => {
    if (item.children.length > 0) {
      setOpenMenus((prev) => ({
        ...prev,
        [item.AppMenuID]: !prev[item.AppMenuID],
      }));
    } else {
      const route = generateRoute(item);
      if (route && route !== "/") {
        handleMenuClick(item.AppMenuID.toString(), route);
        // Close sidebar on mobile after navigation
        if (onMobileClose) {
          onMobileClose();
        }
      }
    }
  };

  // Render Recursive Menu
  const renderMenuItems = (items: MenuItem[]): JSX.Element[] => {
    return items.map((item) => {
      const isActive = item.AppMenuID.toString() === activeMenu;
      const isOpen = openMenus[item.AppMenuID] || false;

      return (
        <motion.div
          key={item.AppMenuID}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer
              ${isActive ? "bg-blue-900 text-white font-semibold" : "hover:bg-blue-50 text-gray-800"}
              ${item.children.length > 0 ? "select-none" : ""}
            `}
            onClick={(e) => {
              e.stopPropagation();
              handleItemClick(item);
            }}
          >
            <span className="text-sm font-medium">{item.AppMenuLabel}</span>
            {item.children.length > 0 && (
              <FaChevronDown
                className={`text-xs transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
            )}
          </div>

          <AnimatePresence>
            {isOpen && item.children.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="ml-4 border-l-2 border-blue-200 pl-3 overflow-hidden"
              >
                {renderMenuItems(item.children)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      );
    });
  };

  // Sidebar content
  const sidebarContent = (
    <>
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 md:hidden">
        <div className="text-lg font-bold text-gray-800">
          Sync <span className="text-indigo-600">Verse</span>
        </div>
        <button
          onClick={onMobileClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <FaTimes className="text-gray-600" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="text-gray-400 text-sm italic text-center py-4">
            Loading menu...
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm text-center py-4">{error}</div>
        ) : menuItems.length === 0 ? (
          <div className="text-gray-400 text-sm italic text-center py-4">
            No menu items found.
          </div>
        ) : (
          <div className="space-y-1">{renderMenuItems(menuItems)}</div>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl md:hidden"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="hidden md:flex w-64 bg-white shadow-lg flex-col flex-shrink-0 border-r border-gray-200 z-30"
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
};

export default Sidebar;