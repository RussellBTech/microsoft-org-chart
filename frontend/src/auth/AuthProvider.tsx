import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { AzureConfig } from '../types/azureConfig';
import { 
  createLoginRequest, 
  createSilentRequest,
  createGraphTokenRequest,
  validateMsalConfig,
  getMsalErrorMessage
} from './msalConfig';
import { getMsalInstance, removeMsalInstance, getMsalDebugInfo } from './msalManager';

/**
 * Authentication states
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

/**
 * Authentication context interface
 */
export interface AuthContextType {
  // Authentication state
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AccountInfo | null;
  error: string | null;
  
  // MSAL instance (null if not configured)
  msalInstance: PublicClientApplication | null;
  
  // Azure AD configuration
  azureConfig: AzureConfig | null;
  hasValidConfig: boolean;
  
  // Authentication methods
  login: () => Promise<void>;
  logout: () => Promise<void>;
  acquireTokenSilently: (scopes?: string[]) => Promise<string | null>;
  
  // Configuration management
  setAzureConfig: (config: AzureConfig | null) => Promise<void>;
  clearError: () => void;
  
  // Utility methods
  getAccessToken: () => Promise<string | null>;
  isTokenValid: () => boolean;
}

/**
 * Create authentication context
 */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: React.ReactNode;
  initialConfig?: AzureConfig | null;
}

/**
 * Authentication Provider component
 * Manages MSAL instance creation, authentication state, and token management
 */
export function AuthProvider({ children, initialConfig = null }: AuthProviderProps) {
  // Authentication state
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // MSAL and configuration state
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [azureConfig, setAzureConfigState] = useState<AzureConfig | null>(initialConfig);
  
  // Derived state
  const isAuthenticated = status === 'authenticated' && user !== null;
  const hasValidConfig = azureConfig !== null && validateMsalConfig(azureConfig).valid;

  /**
   * Initialize or reinitialize MSAL instance when config changes
   */
  const initializeMsalInstance = useCallback(async (config: AzureConfig | null) => {
    try {
      setStatus('loading');
      setError(null);
      
      // Clear existing instance
      if (msalInstance && azureConfig) {
        console.log('🔄 Cleaning up existing MSAL instance');
        await removeMsalInstance(azureConfig);
        setMsalInstance(null);
        setUser(null);
      }
      
      if (!config) {
        console.log('⚠️ No Azure AD configuration provided - setup required');
        setStatus('unauthenticated');
        return;
      }
      
      // Validate configuration
      const validation = validateMsalConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid Azure AD configuration: ${validation.errors.join(', ')}`);
      }
      
      console.log('🔄 Initializing MSAL instance with manager');
      const debugInfo = getMsalDebugInfo();
      console.log('Debug info before:', debugInfo);
      
      // Get managed MSAL instance
      const instance = await getMsalInstance(config);
      setMsalInstance(instance);
      
      // Check for existing authentication
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        console.log(`✅ Found ${accounts.length} existing account(s)`);
        setUser(accounts[0]);
        setStatus('authenticated');
      } else {
        console.log('ℹ️ No existing accounts found');
        setStatus('unauthenticated');
      }
      
      const debugInfoAfter = getMsalDebugInfo();
      console.log('Debug info after:', debugInfoAfter);
      
    } catch (err) {
      console.error('Failed to initialize MSAL instance:', err);
      setError(getMsalErrorMessage(err));
      setStatus('error');
      setMsalInstance(null);
      setUser(null);
    }
  }, [msalInstance, azureConfig]);
  
  /**
   * Set Azure AD configuration and reinitialize MSAL
   */
  const setAzureConfig = useCallback(async (config: AzureConfig | null) => {
    setAzureConfigState(config);
    await initializeMsalInstance(config);
  }, [initializeMsalInstance]);

  /**
   * Login user with interactive authentication
   */
  const login = useCallback(async () => {
    if (!msalInstance || !azureConfig) {
      throw new Error('MSAL instance not initialized. Please configure Azure AD settings first.');
    }
    
    try {
      setStatus('loading');
      setError(null);
      
      const loginRequest = createLoginRequest(azureConfig);
      const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
      
      if (response.account) {
        setUser(response.account);
        setStatus('authenticated');
      } else {
        throw new Error('Authentication succeeded but no user account was returned');
      }
      
    } catch (err) {
      console.error('Login failed:', err);
      setError(getMsalErrorMessage(err));
      setStatus('error');
      setUser(null);
      throw err;
    }
  }, [msalInstance, azureConfig]);

  /**
   * Logout user and clear authentication state
   */
  const logout = useCallback(async () => {
    if (!msalInstance) return;
    
    try {
      // Clear local state first
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      
      // Perform MSAL logout
      await msalInstance.logoutPopup();
      
    } catch (err) {
      console.error('Logout failed:', err);
      // Even if logout fails, clear local state
      setError(getMsalErrorMessage(err));
    }
  }, [msalInstance]);

  /**
   * Acquire token silently for API calls
   */
  const acquireTokenSilently = useCallback(async (scopes?: string[]): Promise<string | null> => {
    if (!msalInstance) {
      console.warn('Cannot acquire token: MSAL instance not available');
      return null;
    }
    
    // Get accounts directly from MSAL instead of relying on user state
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      console.warn('Cannot acquire token: No accounts found in MSAL');
      return null;
    }
    
    const account = accounts[0];
    console.log('🔐 Using account for token:', { accountId: account.homeAccountId, username: account.username });
    
    try {
      const silentRequest = createSilentRequest(scopes);
      silentRequest.account = account;
      
      const response = await msalInstance.acquireTokenSilent(silentRequest);
      console.log('✅ Silent token acquisition successful');
      return response.accessToken;
      
    } catch (err) {
      console.error('Silent token acquisition failed:', err);
      
      // If silent token acquisition fails, try interactive
      try {
        console.log('🔄 Attempting interactive token acquisition...');
        const loginRequest = createLoginRequest(azureConfig!);
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        console.log('✅ Interactive token acquisition successful');
        return response.accessToken;
      } catch (interactiveErr) {
        console.error('Interactive token acquisition failed:', interactiveErr);
        setError(getMsalErrorMessage(interactiveErr));
        return null;
      }
    }
  }, [msalInstance, azureConfig]);

  /**
   * Get access token specifically for Microsoft Graph API
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const graphRequest = createGraphTokenRequest();
    return await acquireTokenSilently(graphRequest.scopes);
  }, [acquireTokenSilently]);

  /**
   * Check if current token is valid (not expired)
   */
  const isTokenValid = useCallback((): boolean => {
    if (!msalInstance || !user) return false;
    
    try {
      const accounts = msalInstance.getAllAccounts();
      return accounts.length > 0 && accounts[0].idTokenClaims !== undefined;
    } catch {
      return false;
    }
  }, [msalInstance, user]);

  /**
   * Clear current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initialize MSAL instance when component mounts or config changes
   */
  useEffect(() => {
    let isMounted = true;
    
    const initializeWithConfig = async () => {
      if (!isMounted) return;
      
      if (azureConfig) {
        await initializeMsalInstance(azureConfig);
      } else {
        setStatus('unauthenticated');
      }
    };
    
    initializeWithConfig();
    
    return () => {
      isMounted = false;
    };
  }, [azureConfig]); // Remove initializeMsalInstance from dependencies to prevent loops

  /**
   * Context value
   */
  const contextValue: AuthContextType = {
    // Authentication state
    status,
    isAuthenticated,
    user,
    error,
    
    // MSAL instance
    msalInstance,
    
    // Configuration
    azureConfig,
    hasValidConfig,
    
    // Authentication methods
    login,
    logout,
    acquireTokenSilently,
    
    // Configuration management
    setAzureConfig,
    clearError,
    
    // Utility methods
    getAccessToken,
    isTokenValid,
  };

  // If we have an MSAL instance, wrap with MsalProvider
  // Otherwise, provide context without MSAL
  if (msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <AuthContext.Provider value={contextValue}>
          {children}
        </AuthContext.Provider>
      </MsalProvider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get current user information
 */
export function useUser(): AccountInfo | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to get access token for Microsoft Graph
 */
export function useGraphToken() {
  const { getAccessToken } = useAuth();
  
  return useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Failed to acquire access token');
    }
    return token;
  }, [getAccessToken]);
}