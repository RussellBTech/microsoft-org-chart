/**
 * Authentication module exports
 */

// Core authentication provider and hooks
export { AuthProvider, useAuth, useIsAuthenticated, useUser, useGraphToken } from './AuthProvider';
export type { AuthContextType, AuthStatus } from './AuthProvider';

// MSAL configuration and utilities
export {
  GRAPH_SCOPES,
  getRequiredScopes,
  createMsalConfiguration,
  createMsalInstance,
  createLoginRequest,
  createSilentRequest,
  createGraphTokenRequest,
  validateMsalConfig,
  getMsalErrorMessage,
} from './msalConfig';

// MSAL instance management
export {
  getMsalInstance,
  removeMsalInstance,
  clearAllMsalInstances,
  getMsalDebugInfo,
} from './msalManager';

// API utilities and helpers
export {
  GRAPH_API_BASE_URL,
  GRAPH_ENDPOINTS,
  makeGraphRequest,
  fetchAllUsers,
  fetchMyOrgContext,
  fetchDepartmentUsers,
  searchUsers,
  fetchUserOrgContext,
  fetchDepartments,
  fetchOrganization,
  fetchCurrentUser,
  transformGraphUserToEmployee,
  buildOrgContextEmployees,
  retryApiCall,
  isAuthError,
  isNetworkError,
  getApiErrorMessage,
  AuthStatusHelper,
  AuthErrors,
  DevHelper,
} from './authUtils';

// UI components and guards
export {
  AuthGuard,
  ConfigGuard,
  AuthLoadingState,
  AuthenticationRequired,
  ConfigurationRequired,
  AuthError,
  AuthStatusIndicator,
  AuthButton,
  RetryAuth,
} from './AuthComponents';