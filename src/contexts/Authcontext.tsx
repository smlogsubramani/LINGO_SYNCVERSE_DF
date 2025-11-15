import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserData {
    FirstName: string;
    LastName: string;
    MiddleName: string;
    UserName: string;
    EmailAddress: string;
    Roles: string;
    TenantName: string;
    Token: string;
    UserID: number;
    TenantID: number;
    // Add other properties as needed from your localStorage structure
}

interface AuthContextType {
    user: UserData | null;
    login: (userData: UserData) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing user data on app load
        const storedUserData = localStorage.getItem("userData");
        if (storedUserData) {
            try {
                const parsedUserData: UserData = JSON.parse(storedUserData);
                setUser(parsedUserData);
            } catch (error) {
                console.error("Error parsing user data:", error);
                localStorage.removeItem("userData");
            }
        }
        setLoading(false);
    }, []);

    const login = (userData: UserData) => {
        localStorage.setItem('userData', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('userData');
        localStorage.removeItem('df_ds_rem_user');
        setUser(null);
    };

    const value: AuthContextType = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};