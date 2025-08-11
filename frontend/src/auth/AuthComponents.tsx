/**
 * Authentication UI components and guards
 */

import React from 'react';
import { AlertCircle, Loader2, LogIn, Shield, RefreshCw } from 'lucide-react';
import { useAuth, AuthStatus } from './AuthProvider';
import { AuthStatusHelper } from './authUtils';

/**
 * Props for authentication guard components
 */
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * Authentication Guard - Only renders children if user is authenticated
 */
export function AuthGuard({ children, fallback, requireAuth = true }: AuthGuardProps) {
  const { status, isAuthenticated } = useAuth();

  if (requireAuth && !isAuthenticated) {
    return fallback ? <>{fallback}</> : <AuthenticationRequired />;
  }

  if (AuthStatusHelper.isLoading(status)) {
    return <AuthLoadingState />;
  }

  return <>{children}</>;
}

/**
 * Configuration Guard - Only renders children if Azure AD config is valid
 */
export function ConfigGuard({ children, fallback }: AuthGuardProps) {
  const { hasValidConfig } = useAuth();

  if (!hasValidConfig) {
    return fallback ? <>{fallback}</> : <ConfigurationRequired />;
  }

  return <>{children}</>;
}

/**
 * Loading state component for authentication
 */
export function AuthLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Authenticating...</h2>
        <p className="text-sm text-gray-600">Please wait while we sign you in.</p>
      </div>
    </div>
  );
}

/**
 * Authentication required component
 */
export function AuthenticationRequired() {
  const { login, error, clearError } = useAuth();

  const handleLogin = async () => {
    try {
      clearError();
      await login();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">
            Please sign in with your Microsoft account to access the org chart.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium mb-1">Authentication Failed</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <LogIn className="h-4 w-4 mr-2" />
          Sign In with Microsoft
        </button>
      </div>
    </div>
  );
}

/**
 * Configuration required component
 */
export function ConfigurationRequired() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
          <p className="text-gray-600 mb-6">
            Azure AD configuration is missing or invalid. Please configure your Azure AD application settings.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-medium hover:bg-orange-200 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Authentication error display component
 */
interface AuthErrorProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function AuthError({ error, onRetry, onDismiss }: AuthErrorProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-1">Authentication Error</h3>
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <div className="flex space-x-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 transition-colors"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-red-600 px-3 py-1 rounded-md hover:bg-red-100 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Authentication status indicator
 */
interface AuthStatusIndicatorProps {
  showDetails?: boolean;
}

export function AuthStatusIndicator({ showDetails = false }: AuthStatusIndicatorProps) {
  const { status, user, isAuthenticated } = useAuth();

  const getStatusColor = (status: AuthStatus) => {
    switch (status) {
      case 'authenticated': return 'text-green-600';
      case 'loading': return 'text-blue-600';
      case 'error': return 'text-red-600';
      case 'unauthenticated': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: AuthStatus) => {
    switch (status) {
      case 'authenticated': return <Shield className="h-4 w-4" />;
      case 'loading': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'unauthenticated': return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className={`flex items-center space-x-2 text-sm ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <span className="capitalize">{status}</span>
      {showDetails && isAuthenticated && user && (
        <span className="text-gray-500">
          - {user.username || user.name}
        </span>
      )}
    </div>
  );
}

/**
 * Login/Logout button component
 */
interface AuthButtonProps {
  className?: string;
  showUserInfo?: boolean;
}

export function AuthButton({ className = '', showUserInfo = false }: AuthButtonProps) {
  const { isAuthenticated, login, logout, user, status } = useAuth();

  const handleAuthAction = async () => {
    try {
      if (isAuthenticated) {
        await logout();
      } else {
        await login();
      }
    } catch (error) {
      console.error('Authentication action failed:', error);
    }
  };

  const isLoading = AuthStatusHelper.isLoading(status);

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showUserInfo && isAuthenticated && user && (
        <div className="text-sm text-gray-700">
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-500">{user.username}</div>
        </div>
      )}
      
      <button
        onClick={handleAuthAction}
        disabled={isLoading}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isAuthenticated
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAuthenticated ? (
          <LogIn className="h-4 w-4 rotate-180" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        <span>{isLoading ? 'Loading...' : isAuthenticated ? 'Sign Out' : 'Sign In'}</span>
      </button>
    </div>
  );
}

/**
 * Retry authentication component
 */
interface RetryAuthProps {
  error?: string;
  onRetry: () => void;
}

export function RetryAuth({ error, onRetry }: RetryAuthProps) {
  return (
    <div className="text-center py-8">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Failed</h3>
      {error && (
        <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">{error}</p>
      )}
      <button
        onClick={onRetry}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center mx-auto"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry Authentication
      </button>
    </div>
  );
}