/**
 * Authentication utilities and helper functions
 */

import { AuthStatus } from './AuthProvider';

/**
 * Microsoft Graph API base URL
 */
export const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

/**
 * Common Microsoft Graph API endpoints
 */
export const GRAPH_ENDPOINTS = {
  ME: '/me',
  USERS: '/users',
  ORGANIZATION: '/organization',
  DIRECTORY_OBJECTS: '/directoryObjects',
} as const;

/**
 * Make authenticated request to Microsoft Graph API
 */
export async function makeGraphRequest<T = any>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    
    throw new Error(`Microsoft Graph API error: ${errorMessage}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  
  return await response.text() as T;
}

/**
 * Fetch all users from Microsoft Graph with pagination
 */
export async function fetchAllUsers(accessToken: string) {
  let users: any[] = [];
  // Filter for only enabled accounts with manager expansion and ConsistencyLevel header
  let nextUrl: string | null = `${GRAPH_ENDPOINTS.USERS}?$filter=accountEnabled eq true&$select=id,displayName,jobTitle,department,mail,userPrincipalName,employeeId,accountEnabled&$expand=manager($select=id,displayName)`;
  
  console.log('🔄 Starting Graph API call with URL:', nextUrl);
  
  while (nextUrl) {
    const response = await makeGraphRequest(nextUrl, accessToken, {
      headers: {
        'ConsistencyLevel': 'eventual' // Required for some expand operations
      }
    });
    
    // Debug: Check the raw response structure
    if (response.value && response.value.length > 0) {
      console.log('📊 Raw Graph API response sample:', {
        totalInBatch: response.value.length,
        firstUser: response.value[0],
        hasNextLink: !!response['@odata.nextLink'],
        sampleManagerData: response.value.slice(0, 3).map((user: any) => ({
          name: user.displayName,
          hasManager: !!user.manager,
          managerStructure: user.manager ? Object.keys(user.manager) : 'no manager',
          managerId: user.manager?.id || 'no id'
        }))
      });
    }
    
    if (response.value) {
      // Double-check accountEnabled in case the filter didn't work
      const activeUsers = response.value.filter((user: any) => user.accountEnabled !== false);
      users = users.concat(activeUsers);
    }
    
    nextUrl = response['@odata.nextLink'] || null;
    
    // Safety check to prevent infinite loops
    if (users.length > 10000) {
      console.warn('Fetched over 10,000 users, stopping pagination to prevent performance issues');
      break;
    }
  }
  
  // Final analysis of manager relationships in the fetched data
  const usersWithManagers = users.filter(user => user.manager?.id);
  const usersWithoutManagers = users.filter(user => !user.manager?.id);
  
  console.log(`📈 Final Graph API data analysis:`, {
    totalUsers: users.length,
    usersWithManagers: usersWithManagers.length,
    usersWithoutManagers: usersWithoutManagers.length,
    managerPercentage: ((usersWithManagers.length / users.length) * 100).toFixed(1) + '%',
    sampleWithManager: usersWithManagers.slice(0, 3).map(user => ({
      name: user.displayName,
      managerId: user.manager.id,
      managerName: user.manager.displayName
    })),
    sampleWithoutManager: usersWithoutManagers.slice(0, 3).map(user => ({
      name: user.displayName,
      hasManagerProperty: 'manager' in user,
      managerValue: user.manager
    }))
  });
  
  return users;
}

/**
 * Fetch current user with their organizational context
 */
export async function fetchMyOrgContext(accessToken: string) {
  // First get current user basic info
  const meQuery = `${GRAPH_ENDPOINTS.ME}?$select=id,displayName,jobTitle,department,mail,userPrincipalName,accountEnabled`;
  const currentUser = await makeGraphRequest(meQuery, accessToken);
  
  // Get manager separately
  let manager = null;
  try {
    const managerQuery = `${GRAPH_ENDPOINTS.ME}/manager?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
    manager = await makeGraphRequest(managerQuery, accessToken);
    // Check if manager is active
    if (manager && manager.accountEnabled === false) {
      console.log('Manager account is disabled, skipping');
      manager = null;
    }
  } catch (error) {
    console.log('User has no manager (might be CEO):', error);
  }
  
  // Get direct reports (only active ones)
  let directReports: any[] = [];
  try {
    const reportsQuery = `${GRAPH_ENDPOINTS.ME}/directReports?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
    const reportsResponse = await makeGraphRequest(reportsQuery, accessToken);
    // Filter for only active accounts
    directReports = (reportsResponse.value || []).filter((user: any) => user.accountEnabled !== false);
  } catch (error) {
    console.log('Could not fetch direct reports:', error);
  }
  
  // Get manager's direct reports (user's peers) if manager exists
  let peers: any[] = [];
  if (manager?.id) {
    try {
      const peersQuery = `/users/${manager.id}/directReports?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      const peersResponse = await makeGraphRequest(peersQuery, accessToken);
      // Filter for only active peers
      peers = (peersResponse.value || []).filter((user: any) => user.accountEnabled !== false);
    } catch (error) {
      console.log('Could not fetch peers:', error);
    }
  }
  
  // Get manager's manager if exists
  let grandManager = null;
  if (manager?.id) {
    try {
      const grandManagerQuery = `/users/${manager.id}/manager?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      grandManager = await makeGraphRequest(grandManagerQuery, accessToken);
      // Check if grand manager is active
      if (grandManager && grandManager.accountEnabled === false) {
        console.log('Grand manager account is disabled, skipping');
        grandManager = null;
      }
    } catch (error) {
      console.log('Could not fetch grand manager:', error);
    }
  }
  
  // Recursive function to fetch reports to a certain depth
  async function fetchReportsRecursively(userId: string, depth: number, maxDepth: number = 3): Promise<any> {
    if (depth >= maxDepth) {
      console.log(`📊 Reached max depth ${maxDepth} for user ${userId}`);
      return [];
    }
    
    try {
      const reportsQuery = `/users/${userId}/directReports?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      const reportsResponse = await makeGraphRequest(reportsQuery, accessToken);
      const reports = (reportsResponse.value || []).filter((user: any) => user.accountEnabled !== false);
      
      if (reports.length > 0) {
        console.log(`📊 Found ${reports.length} reports at depth ${depth} for user ${userId}`);
      }
      
      // Fetch next level for each report
      const expandedReports = await Promise.all(
        reports.map(async (report: any) => ({
          ...report,
          directReports: await fetchReportsRecursively(report.id, depth + 1, maxDepth)
        }))
      );
      
      return expandedReports;
    } catch (error) {
      console.log(`Could not fetch reports for user ${userId} at depth ${depth}:`, error);
      return [];
    }
  }
  
  // Get direct reports with full depth (3 levels down)
  const expandedReports = await fetchReportsRecursively(currentUser.id, 0, 3);
  
  // Get peers' direct reports and their reports (2 levels deep for peers)
  const expandedPeers = await Promise.all(
    peers.map(async (peer: any) => ({
      ...peer,
      directReports: await fetchReportsRecursively(peer.id, 0, 2)
    }))
  );
  
  return {
    currentUser: { ...currentUser, manager, directReports },
    manager,
    grandManager,
    peers: expandedPeers,
    directReports: expandedReports
  };
}


/**
 * Search users by name or title
 */
export async function searchUsers(accessToken: string, searchQuery: string, maxResults: number = 20) {
  // Graph API search with account enabled filter
  // Note: $search and $filter together require ConsistencyLevel header
  const query = `${GRAPH_ENDPOINTS.USERS}?$search="displayName:${searchQuery}" OR "jobTitle:${searchQuery}"&$filter=accountEnabled eq true&$select=id,displayName,jobTitle,department,mail,accountEnabled&$top=${maxResults}&$count=true`;
  
  const response = await makeGraphRequest(query, accessToken, {
    headers: {
      'ConsistencyLevel': 'eventual' // Required for $search with $filter
    }
  });
  
  // Double-check accountEnabled
  const activeUsers = (response.value || []).filter((user: any) => user.accountEnabled !== false);
  return activeUsers;
}

/**
 * Fetch a specific user's organizational context
 */
export async function fetchUserOrgContext(accessToken: string, userId: string) {
  // Get user basic info
  const userQuery = `/users/${userId}?$select=id,displayName,jobTitle,department,mail,userPrincipalName,accountEnabled`;
  const user = await makeGraphRequest(userQuery, accessToken);
  
  // Check if the user is active
  if (user.accountEnabled === false) {
    console.warn(`User ${userId} is not active/enabled`);
  }
  
  // Get manager separately
  let manager = null;
  try {
    const managerQuery = `/users/${userId}/manager?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
    manager = await makeGraphRequest(managerQuery, accessToken);
    // Check if manager is active
    if (manager && manager.accountEnabled === false) {
      console.log('Manager account is disabled');
      // Still include but marked as inactive
    }
  } catch (error) {
    console.log('User has no manager:', error);
  }
  
  // Get manager's direct reports (user's peers) if manager exists
  let peers: any[] = [];
  if (manager?.id) {
    try {
      const peersQuery = `/users/${manager.id}/directReports?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      const peersResponse = await makeGraphRequest(peersQuery, accessToken);
      // Filter for only active peers
      peers = (peersResponse.value || []).filter((user: any) => user.accountEnabled !== false);
    } catch (error) {
      console.log('Could not fetch peers:', error);
    }
  }
  
  // Get manager's manager if exists
  let grandManager = null;
  if (manager?.id) {
    try {
      const grandManagerQuery = `/users/${manager.id}/manager?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      grandManager = await makeGraphRequest(grandManagerQuery, accessToken);
      // Check if grand manager is active
      if (grandManager && grandManager.accountEnabled === false) {
        console.log('Grand manager account is disabled');
        // Still include but marked as inactive
      }
    } catch (error) {
      console.log('Could not fetch grand manager:', error);
    }
  }
  
  // Recursive function to fetch reports to a certain depth (same as in fetchMyOrgContext)
  async function fetchReportsRecursively(userId: string, depth: number, maxDepth: number = 3): Promise<any> {
    if (depth >= maxDepth) {
      console.log(`📊 Reached max depth ${maxDepth} for user ${userId}`);
      return [];
    }
    
    try {
      const reportsQuery = `/users/${userId}/directReports?$select=id,displayName,jobTitle,department,mail,accountEnabled`;
      const reportsResponse = await makeGraphRequest(reportsQuery, accessToken);
      const reports = (reportsResponse.value || []).filter((user: any) => user.accountEnabled !== false);
      
      if (reports.length > 0) {
        console.log(`📊 Found ${reports.length} reports at depth ${depth} for user ${userId}`);
      }
      
      // Fetch next level for each report
      const expandedReports = await Promise.all(
        reports.map(async (report: any) => ({
          ...report,
          directReports: await fetchReportsRecursively(report.id, depth + 1, maxDepth)
        }))
      );
      
      return expandedReports;
    } catch (error) {
      console.log(`Could not fetch reports for user ${userId} at depth ${depth}:`, error);
      return [];
    }
  }
  
  // Get direct reports with full depth (3 levels down) - same as My View
  const expandedReports = await fetchReportsRecursively(userId, 0, 3);
  
  // Get peers' direct reports and their reports (2 levels deep for peers) - same as My View
  const expandedPeers = await Promise.all(
    peers.map(async (peer: any) => ({
      ...peer,
      directReports: await fetchReportsRecursively(peer.id, 0, 2)
    }))
  );
  
  return {
    user: { ...user, manager, directReports: expandedReports },
    manager,
    grandManager,
    peers: expandedPeers,
    directReports: expandedReports
  };
}


/**
 * Fetch organization information
 */
export async function fetchOrganization(accessToken: string) {
  return await makeGraphRequest(GRAPH_ENDPOINTS.ORGANIZATION, accessToken);
}

/**
 * Fetch current user's profile
 */
export async function fetchCurrentUser(accessToken: string) {
  return await makeGraphRequest(GRAPH_ENDPOINTS.ME, accessToken);
}

/**
 * Transform Microsoft Graph user to our Employee format
 * Handles manager relationship consistently across all data sources
 */
export function transformGraphUserToEmployee(graphUser: any, managerOverride?: string | null): any {
  const finalManagerId = managerOverride !== undefined ? managerOverride : (graphUser.manager?.id || null);
  
  // Debug logging for first few transformations to track manager ID issues
  if (Math.random() < 0.1) { // Log 10% of transformations to avoid spam
    console.log(`🔧 Transform ${graphUser.displayName}:`, {
      rawManager: graphUser.manager,
      extractedManagerId: graphUser.manager?.id,
      managerOverride,
      finalManagerId,
      hasManagerProperty: 'manager' in graphUser,
      managerKeys: graphUser.manager ? Object.keys(graphUser.manager) : 'no manager'
    });
  }
  
  return {
    id: graphUser.id,
    name: graphUser.displayName || 'Unknown User',
    title: graphUser.jobTitle || 'No Title',
    department: graphUser.department || 'Unknown Department',
    email: graphUser.mail || graphUser.userPrincipalName || '',
    phone: graphUser.businessPhones?.[0] || undefined,
    location: graphUser.officeLocation || undefined,
    avatar: undefined, // Microsoft Graph photos require separate API call
    managerId: finalManagerId,
  };
}

/**
 * Build organizational context employees with correct manager relationships
 */
export function buildOrgContextEmployees(
  currentUser: any,
  manager: any | null,
  grandManager: any | null,
  peers: any[],
  directReports: any[]
): any[] {
  const contextEmployees: any[] = [];
  
  // Add current user with correct manager relationship
  const currentUserEmployee = transformGraphUserToEmployee(
    currentUser,
    manager?.id || null
  );
  contextEmployees.push(currentUserEmployee);
  
  // Add manager with their manager (grand manager)
  if (manager) {
    const managerEmployee = transformGraphUserToEmployee(
      manager,
      grandManager?.id || null
    );
    contextEmployees.push(managerEmployee);
  }
  
  // Add grand manager (no manager in this limited context)
  if (grandManager) {
    const grandManagerEmployee = transformGraphUserToEmployee(grandManager, null);
    contextEmployees.push(grandManagerEmployee);
  }
  
  // Recursive function to add employees and their reports
  function addEmployeeAndReports(employee: any, managerId: string | null, depth: number = 0) {
    const emp = transformGraphUserToEmployee(employee, managerId);
    contextEmployees.push(emp);
    
    // Add their direct reports recursively
    if (employee.directReports && Array.isArray(employee.directReports)) {
      employee.directReports.forEach((report: any) => {
        addEmployeeAndReports(report, employee.id, depth + 1);
      });
    }
  }
  
  // Add peers and their full teams
  peers.forEach(peer => {
    // Skip if it's the current user (they're already added)
    if (peer.id !== currentUser.id) {
      addEmployeeAndReports(peer, manager?.id || null, 0);
    }
  });
  
  // Add direct reports and their full teams
  directReports.forEach(report => {
    addEmployeeAndReports(report, currentUserEmployee.id, 0);
  });
  
  // Remove duplicates (in case of any overlap)
  const uniqueEmployees = Array.from(
    new Map(contextEmployees.map(emp => [emp.id, emp])).values()
  );
  
  return uniqueEmployees;
}

/**
 * Retry wrapper for API calls with exponential backoff
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on authentication errors
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        throw lastError;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Check if error is authentication-related
 */
export function isAuthError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message || error.toString();
  const authErrorPatterns = [
    '401',
    '403',
    'unauthorized',
    'forbidden',
    'authentication',
    'consent_required',
    'interaction_required',
    'login_required',
  ];
  
  return authErrorPatterns.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if error is network-related
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message || error.toString();
  const networkErrorPatterns = [
    'network',
    'fetch',
    'timeout',
    'connection',
    'cors',
    'net::',
  ];
  
  return networkErrorPatterns.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Get user-friendly error message for API errors
 */
export function getApiErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';
  
  if (isAuthError(error)) {
    return 'Authentication required. Please sign in again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  const message = error.message || error.toString();
  
  // Microsoft Graph specific errors
  if (message.includes('Insufficient privileges')) {
    return 'Insufficient permissions. Please contact your administrator to grant the required permissions.';
  }
  
  if (message.includes('Forbidden')) {
    return 'Access forbidden. You may not have permission to access this data.';
  }
  
  if (message.includes('Not Found')) {
    return 'Requested resource not found.';
  }
  
  if (message.includes('Too Many Requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  return message;
}

/**
 * Authentication status helpers
 */
export const AuthStatusHelper = {
  isLoading: (status: AuthStatus) => status === 'loading',
  isAuthenticated: (status: AuthStatus) => status === 'authenticated',
  isUnauthenticated: (status: AuthStatus) => status === 'unauthenticated',
  hasError: (status: AuthStatus) => status === 'error',
  canAttemptLogin: (status: AuthStatus) => status === 'unauthenticated' || status === 'error',
} as const;

/**
 * Common authentication error types
 */
export const AuthErrors = {
  CONFIG_INVALID: 'Invalid Azure AD configuration',
  CONFIG_MISSING: 'Azure AD configuration not found',
  LOGIN_CANCELLED: 'Login was cancelled by user',
  LOGIN_FAILED: 'Login failed',
  TOKEN_ACQUISITION_FAILED: 'Failed to acquire access token',
  NETWORK_ERROR: 'Network error occurred',
  PERMISSION_DENIED: 'Permission denied',
  CONSENT_REQUIRED: 'Admin consent required',
} as const;

/**
 * Development environment helpers
 */
export const DevHelper = {
  isDevelopment: () => import.meta.env.DEV,
  isProduction: () => import.meta.env.PROD,
  getBaseUrl: () => import.meta.env.VITE_BASE_URL || window.location.origin,
  logAuthState: (status: AuthStatus, user: any, config: any) => {
    if (DevHelper.isDevelopment()) {
      console.group('🔐 Authentication State');
      console.log('Status:', status);
      console.log('User:', user);
      console.log('Config:', config);
      console.groupEnd();
    }
  },
} as const;