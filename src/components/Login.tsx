import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { getDiligenceFabricSDK } from "../services/DFService";
import config from "../config/default.json";
import Swal from "sweetalert2";
import dfLogo from "../images/DF-Logo.svg";
import lingoLogo from "../images/lingo.jpeg";
import microsoftIcon from "../images/microsoftIcon.svg";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  padding: "0.5em",
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [msalApp, setMsalApp] = useState<PublicClientApplication | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMsalConfig = async () => {
      try {
        const client = getDiligenceFabricSDK();
        const AuthenticationTypeList = {
          TenantID: undefined,
          AuthenticationTypeCode: 'MS',
          CalledBy: undefined
        };
        const response = await client.getAuthenticationTypeService().getAuthenticationType(AuthenticationTypeList);

        const msalConfig = {
          auth: {
            clientId: response.Result.ClientOrAppIDConfig,
            authority: 'https://login.microsoftonline.com/common',
            redirectUri: window.location.origin + "/login",
          },
          cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
          },
        };

        const Instance = new PublicClientApplication(msalConfig);
        await Instance.initialize();
        await Instance.handleRedirectPromise();
        setMsalApp(Instance);
      } catch (error) {
        console.log(error);
      }
    };

    fetchMsalConfig();
  }, []);

  const handleLogin = async (authRequest: any) => {
    try {
      setLoading(true);
      const client = getDiligenceFabricSDK();
      const response = await client.getAuthService().login(authRequest);

      if (response.Result && response.Result.TenantID === config.DF_TENANT_ID) {
        const userData = {
          Token: response.Result.Token,
          UserName: response.Result.UserName,
          TenantID: response.Result.TenantID,
          ...response.Result
        };
        
        console.log("🔐 Storing user data:", userData);
        localStorage.setItem("userData", JSON.stringify(userData));
        
        Toast.fire({
          icon: "success",
          text: "Login successful!",
          background: "green",
          color: "white",
        });
        navigate("/dashboard");
      } else {
        throw new Error(response.Message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      Toast.fire({
        icon: "error",
        text: (err as Error).message || "Login failed",
        background: "red",
        color: "white",
      });
    } finally {
      setLoading(false);
    }
  };

  const microsoftLogin = async () => {
    try {
      const loginResponse = await msalApp?.loginPopup({
        scopes: ["openid", "profile", "User.Read"],
      });

      if (loginResponse) {
        await handleLogin({
          username: loginResponse.account.username,
          accessToken: loginResponse.accessToken,
          AuthenticationTypeCode: "MS",
        });
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8">
      <div className="w-full max-w-5xl">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left Side - Branding */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 md:p-12 flex flex-col justify-between text-white">
              {/* Header Section */}
              <div>
                <div className="mb-8">
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">
                    Sync <span className="text-indigo-200">Verse</span>
                  </h1>
                  <p className="text-indigo-100 text-lg">
                    Seamless Collaboration Platform
                  </p>
                </div>

                <div className="space-y-6 mb-8">
                  <div className="flex items-start space-x-3">
                    <div className="bg-white/20 rounded-lg p-2 mt-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Real-time Synchronization</h3>
                      <p className="text-indigo-100 text-sm">Stay connected with instant updates</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-white/20 rounded-lg p-2 mt-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Secure & Reliable</h3>
                      <p className="text-indigo-100 text-sm">Enterprise-grade security</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-white/20 rounded-lg p-2 mt-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Team Collaboration</h3>
                      <p className="text-indigo-100 text-sm">Work together seamlessly</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Branding */}
              <div className="space-y-4 mt-8">
                <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <img 
                    src={lingoLogo} 
                    alt="Lingo Team" 
                    className="w-10 h-10 rounded-full border-2 border-white/30"
                  />
                  <div>
                    <p className="text-xs text-indigo-200">Developed by</p>
                    <p className="font-semibold">Team Lingo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login */}
            <div className="p-8 md:p-12 flex flex-col justify-center">
              {/* Powered By Section */}
              <div className="mb-8 text-center">
                <p className="text-sm text-gray-500 mb-3">Powered by</p>
                <img 
                  src={dfLogo} 
                  alt="Diligence Fabric" 
                  className="h-16 mx-auto object-contain"
                />
              </div>

              {/* Welcome Text */}
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600">
                  Sign in with your Microsoft account
                </p>
              </div>

              {/* Microsoft Login Button */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={microsoftLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-indigo-500 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img
                    className="w-6 h-6"
                    src={microsoftIcon}
                    alt="Microsoft Icon"
                  />
                  <span className="text-lg">
                    {loading ? "Signing in..." : "Sign in with Microsoft"}
                  </span>
                </button>

                {/* Info Text */}
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    By signing in, you agree to our Terms of Service
                  </p>
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center space-x-2 text-gray-500 mt-6">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-xs">Secure Microsoft Authentication</span>
                </div>
              </div>

              {/* Help Section */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  Need help? Contact{" "}
                  <a href="mailto:logasubramani.m@ubtiinc.com" className="text-indigo-600 hover:text-indigo-700 font-semibold">
                    logasubramani.m@ubtiinc.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          © 2025 Sync Verse. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;