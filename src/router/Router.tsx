import { createBrowserRouter, Navigate } from "react-router-dom";
import Main_Layout from "../layout/Main_Layout";
import Login from "../components/Login";
import Dashboard from "../pages/Dashboard";
import Documents from "../pages/Documents";
import Support from "../pages/Support";
import { AuthProvider } from "../contexts/Authcontext";
import MeetAI from "../pages/MeetAI";
import Jarvis from "../pages/Jarvis";
import Chat from "../pages/Chat";
import Profile from "../pages/Profile";
import Details from "../pages/Details"
import PendingWork from "../pages/PendingWork";
import Infos from "../pages/Infos";


// Wrapper component for protected routes
const ProtectedLayout = () => (
  <AuthProvider>
    <Main_Layout />
  </AuthProvider>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      // Redirect root to dashboard
      { index: true, element: <Navigate to="/dashboard" replace /> },
      
      // Main pages with sidebar
      {
        path: "dashboard",
        element: <Dashboard />
      },
      {
        path: "documents",
        element: <Documents />
      },
      {
        path: "ticket",
        element: <Support />
      },
      {
        path: "meet-ai",
        element: <MeetAI />
      },
      {
        path: "thread",
        element: <Chat/>
      },
       {
        path: "profile",
        element: <Profile/>
      },
      {
        path: "details",
        element: <Details/>
      },
      {
        path: "pending-work",
        element: <PendingWork/>
      },
      {
        path: "infos",
        element: <Infos/>
      },
      {
        path: "jarvis",
        element: <Jarvis/>
      }
    ],
  },
  
  // Auth pages outside main layout (no AuthProvider needed)
  {
    path: "/login",
    element: <Login />
  }
]);

export default router;