// import React, { useEffect, useState } from "react";
// import {
//   collection,
//   query,
//   where,
//   onSnapshot,
// } from "firebase/firestore";
// import { db } from "../firebase"; // Firestore
// import { useNavigate } from "react-router-dom";
// import { getDiligenceFabricSDK } from "../services/DFService";

// const CR = () => {
//   const [projects, setProjects] = useState([]);
//   const [userIdentifier, setUserIdentifier] = useState("User");
//   const [roles, setRoles] = useState([]);
//   const [accessStatus, setAccessStatus] = useState("Fetching...");
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [debugInfo, setDebugInfo] = useState({});
//   const navigate = useNavigate();

//   const parseAppRoles = (appRolesString) => {
//     try {
//       if (!appRolesString) return [];
//       const appRolesArray = JSON.parse(appRolesString);
//       return appRolesArray.map((role) => role.AppRoleName).filter(Boolean);
//     } catch (parseError) {
//       setError(`Failed to parse roles: ${parseError.message}`);
//       return [];
//     }
//   };

//   const maskToken = (token) => {
//     if (!token) return "N/A";
//     return `${token.slice(0, 4)}...${token.slice(-4)}`;
//   };

//   const fetchDFUserDetails = async () => {
//     try {
//       setError("");
//       setLoading(true);
//       setDebugInfo({});

//       const userDataStr = localStorage.getItem("userData");
//       if (!userDataStr) {
//         setError("No user data found. Please log in.");
//         navigate("/login");
//         return;
//       }

//       const data = JSON.parse(userDataStr);
//       const { Token: token } = data;

//       if (!token) {
//         setError("No authentication token found.");
//         navigate("/login");
//         return;
//       }

//       // Decode token (client-side, for debug only)
//       let tokenClaims = {};
//       try {
//         const base64Url = token.split(".")[1];
//         const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
//         tokenClaims = JSON.parse(atob(base64));
//       } catch (decodeError) {
//         console.warn("Failed to decode token:", decodeError.message);
//       }

//       const client = getDiligenceFabricSDK();
//       if (!client) throw new Error("Failed to initialize Diligence Fabric SDK");

//       client.setAuthUser({ Token: token });

//       const requestBody = {};
//       const requestTimestamp = new Date().toISOString();
//       const appRoleService = client.getApplicationRoleService();
//       const response = await appRoleService.getUserAppRole(requestBody);

//       let parsedRoleNames = [];
//       let apiUserIdentifier = tokenClaims.name || "User";

//       if (Array.isArray(response?.Result) && response.Result.length > 0) {
//         const rolesData = response.Result[0]?.AppRoles;
//         if (rolesData) {
//           parsedRoleNames = parseAppRoles(rolesData);
//         }
//         apiUserIdentifier = response.Result[0]?.UserName || apiUserIdentifier;
//       }

//       setUserIdentifier(apiUserIdentifier);
//       setRoles(parsedRoleNames);
//       setAccessStatus(parsedRoleNames.includes("Foreign Admin") ? "Granted" : "Denied");
//       setDebugInfo({
//         token: maskToken(token),
//         tokenClaims,
//         request: { body: requestBody, timestamp: requestTimestamp },
//         response: { raw: response, status: response?.Status || "Unknown" },
//         parsedRoleNames,
//         rolesFound: parsedRoleNames.length,
//       });
//     } catch (error) {
//       setError(`Failed to fetch user details: ${error.message}`);
//       setAccessStatus("Error");
//       setRoles([]);
//       setDebugInfo((prev) => ({
//         ...prev,
//         error: { message: error.message, stack: error.stack },
//       }));
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Fetch only Foreign Admin projects from Firestore
//   const fetchForeignAdminProjects = () => {
//     if (!roles.includes("Foreign Admin")) {
//       setProjects([]);
//       return;
//     }

//     const projectsCol = collection(db, "projects");
//     const q = query(projectsCol, where("assignedRole", "==", "Foreign Admin"));

//     const unsubscribe = onSnapshot(
//       q,
//       (snapshot) => {
//         const projectList = snapshot.docs.map((doc) => ({
//           id: doc.id,
//           ...doc.data(),
//         }));
//         setProjects(projectList);
//       },
//       (err) => {
//         setError(`Firestore error: ${err.message}`);
//         setDebugInfo((prev) => ({
//           ...prev,
//           firestoreError: { message: err.message, timestamp: new Date().toISOString() },
//         }));
//       }
//     );

//     return unsubscribe;
//   };

//   useEffect(() => {
//     fetchDFUserDetails();
//   }, []);

//   useEffect(() => {
//     if (roles.length > 0) {
//       const unsub = fetchForeignAdminProjects();
//       return () => unsub && unsub();
//     }
//   }, [roles]);

//   const handleRetry = () => {
//     fetchDFUserDetails();
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-lg font-medium text-gray-700">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-7xl mx-auto">
//         <h1 className="text-3xl font-bold text-center text-white bg-gradient-to-r from-purple-600 to-pink-600 py-4 px-6 rounded-lg shadow-lg mb-8">
//           Foreign Admin Dashboard
//         </h1>

//         {error && (
//           <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-8 max-w-xl mx-auto animate-slide-in">
//             <p className="font-semibold">Error:</p>
//             <p>{error}</p>
//             <button
//               onClick={handleRetry}
//               className="mt-3 inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow"
//             >
//               Retry
//             </button>
//           </div>
//         )}

//         <div className="bg-white shadow-lg rounded-lg p-6 mb-8 max-w-xl mx-auto">
//           <h2 className="text-2xl font-semibold text-gray-800 mb-4">User Information</h2>
//           <div className="space-y-3">
//             <p className="text-gray-700">
//               <strong>Identifier:</strong> {userIdentifier}
//             </p>
//             <p className="text-gray-700">
//               <strong>Roles:</strong>{" "}
//               {roles.length > 0 ? (
//                 <span className="flex flex-wrap gap-2">
//                   {roles.map((role, i) => (
//                     <span
//                       key={i}
//                       className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
//                         role === "Foreign Admin"
//                           ? "bg-purple-100 text-purple-800"
//                           : "bg-blue-100 text-blue-800"
//                       }`}
//                     >
//                       {role}
//                     </span>
//                   ))}
//                 </span>
//               ) : (
//                 <span className="text-gray-500">No roles assigned</span>
//               )}
//             </p>
//             <p className="text-gray-700">
//               <strong>Access Status:</strong>{" "}
//               <span
//                 className={`font-semibold ${
//                   accessStatus.includes("Granted") ? "text-green-600" : "text-red-600"
//                 }`}
//               >
//                 {accessStatus}
//               </span>
//             </p>
//             {roles.includes("Foreign Admin") && (
//               <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
//                 <p className="text-purple-700 text-sm font-medium">
//                   <strong>Success!</strong> You have <strong>Foreign Admin</strong> access.
//                 </p>
//               </div>
//             )}
//           </div>
//         </div>

//         <details className="bg-white shadow-lg rounded-lg p-6 mb-8 max-w-3xl mx-auto">
//           <summary className="cursor-pointer font-semibold text-gray-800 text-lg">
//             Debug Information
//           </summary>
//           <div className="mt-4 text-sm">
//             <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto text-gray-700">
//               {JSON.stringify(debugInfo, null, 2)}
//             </pre>
//           </div>
//         </details>

//         {roles.includes("Foreign Admin") ? (
//           <>
//             <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
//               Foreign Admin Projects
//             </h2>
//             {projects.length === 0 ? (
//               <p className="text-gray-500 text-center text-lg">
//                 No projects assigned to <strong>Foreign Admin</strong> role.
//               </p>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {projects.map((proj) => (
//                   <div
//                     key={proj.id}
//                     className="bg-white shadow-md rounded-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
//                   >
//                     <h3 className="text-xl font-bold text-purple-600 mb-3">{proj.name}</h3>
//                     <p className="text-gray-700">
//                       <strong>ID:</strong> {proj.id}
//                     </p>
//                     <p className="text-gray-700">
//                       <strong>Assigned To:</strong> {proj.assignedTo || "N/A"}
//                     </p>
//                     <p className="text-gray-700">
//                       <strong>Role:</strong> {proj.assignedRole}
//                     </p>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </>
//         ) : (
//           <div className="text-center max-w-xl mx-auto">
//             <p className="text-red-600 text-lg font-medium mb-4">
//               You do not have <strong>Foreign Admin</strong> role to view these projects.
//             </p>
//             <button
//               onClick={handleRetry}
//               className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow"
//             >
//               Retry Permission Check
//             </button>
//           </div>
//         )}
//       </div>

//       <style jsx>{`
//         @keyframes slideIn {
//           from {
//             opacity: 0;
//             transform: translateY(20px);
//           }
//           to {
//             opacity: 1;
//             transform: translateY(0);
//           }
//         }
//         .animate-slide-in {
//           animation: slideIn 0.5s ease-out;
//         }
//       `}</style>
//     </div>
//   );
// };

// export default CR;