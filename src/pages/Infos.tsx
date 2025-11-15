import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDiligenceFabricSDK } from "../services/DFService";

interface OrgUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string | null;
  appRoles?: string;
}

const OrganizationUsersPage: React.FC = () => {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const navigate = useNavigate();

  // Decode JWT for token claims
  const decodeToken = (token: string) => {
    try {
      const base64Url = token.split(".")[1] || "";
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      // atob is available in browser environment
      return JSON.parse(atob(base64));
    } catch (e: any) {
      console.warn("Failed to decode token:", e?.message || e);
      return {};
    }
  };

  // 🟢 Fetch ALL DF Users - Accessible to all authenticated users
  const fetchDFUsers = async () => {
    try {
      setError("");
      setLoading(true);

      const userDataStr = localStorage.getItem("userData");
      if (!userDataStr) {
        setError("No user data found. Please log in.");
        navigate("/login");
        return;
      }

      const userData = JSON.parse(userDataStr);
      const token: string | undefined = userData.Token || userData.token;
      if (!token) {
        setError("No authentication token found.");
        navigate("/login");
        return;
      }

      const tokenClaims = decodeToken(token);
      console.log("Token claims:", tokenClaims);

      const client = getDiligenceFabricSDK();
      if (!client) throw new Error("Failed to initialize Diligence Fabric SDK.");

      client.setAuthUser({ Token: token });

      // Approach 1: Use AppRoleService with proper parameters
      const appRoleService = (client as any).getApplicationRoleService?.();
      if (!appRoleService || !appRoleService.getUserAppRole) {
        throw new Error("No available methods to fetch users.");
      }
      // Try different parameter combinations to get all users
      const requestBodies = [
        { tenantID: 282 },
        { tenantID: 282, userID: 0 },
        { tenantID: 282, getAllUsers: true },
        {},
      ];

      let finalResponse: any = null;

      for (let requestBody of requestBodies) {
        try {
          //console.log("Trying request body:", requestBody);
          const response = await appRoleService.getUserAppRole(requestBody);
          console.log("AppRoleService Response:", response);

          if (response?.Result && Array.isArray(response.Result) && response.Result.length > 0) {
            finalResponse = response;
            break;
          }
        } catch (err) {
          console.warn("Request failed with body:", requestBody, err);
          continue;
        }
      }

      if (!finalResponse?.Result) {
        throw new Error("No user data received from any API method.");
      }

      // Transform users from AppRoleService response
      const transformed: OrgUser[] = finalResponse.Result.map((u: any, index: number) => {
        let parsedRoles: any[] = [];
        try {
          parsedRoles = JSON.parse(u.AppRoles || "[]");
        } catch {
          parsedRoles = [];
        }

        const appRoleNames = parsedRoles.map((r: any) => r.AppRoleName).join(", ") || "User";

        // Build email if missing
        let email = u.UserName;
        if (email && !email.includes("@")) {
          if (tokenClaims.email && typeof tokenClaims.email === "string" && tokenClaims.email.includes("@")) {
            const domain = tokenClaims.email.split("@")[1];
            email = `${u.UserName}@${domain}`;
          } else if (tokenClaims.Email && typeof tokenClaims.Email === "string" && tokenClaims.Email.includes("@")) {
            const domain = tokenClaims.Email.split("@")[1];
            email = `${u.UserName}@${domain}`;
          }
        }

        return {
          id: u.UserID || u.userID || index,
          name: (u.UserName && u.UserName.split("@")[0]) || u.DisplayName || "Unknown User",
          email: email || u.Email || "N/A",
          appRoles: appRoleNames,
          role: appRoleNames || "User",
          status: "Active",
          lastLogin: u.LastLoginDate || null,
        };
      });

      setUsers(transformed);

      setDebugInfo({
        token: token.slice(0, 8) + "...",
        tenantID: 282,
        totalUsers: transformed.length,
        sampleUser: transformed[0],
        methodUsed: finalResponse ? "AppRoleService" : "UserService",
      });
    } catch (err: any) {
      console.error("Error fetching DF users:", err);
      setError(err?.message || "Failed to fetch organization users. Please check your permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDFUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    fetchDFUsers();
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  const handleViewUserDetails = (userId: string | number) => {
    navigate(`/users/${userId}`);
  };

  // UI Rendering
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Loading Organization Users...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching user list for all organization members</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>

              <h1 className="text-3xl font-bold text-gray-900">Organization Users</h1>
              <p className="text-gray-600 mt-2">View all users in your organization ({users.length} users found)</p>
            </div>

            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center mt-4 sm:mt-0"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-8">
            <div className="flex items-center mb-2">
              <svg className="h-5 w-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold">Unable to Load Users</p>
            </div>
            <p>{error}</p>
            <button
              onClick={handleRetry}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {users.length === 0 && !error ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
              <p className="mt-1 text-sm text-gray-500">No organization users available in the system.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors" >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {user.name.split(" ").map((n) => (n ? n[0] : "")).join("").toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{user.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationUsersPage;