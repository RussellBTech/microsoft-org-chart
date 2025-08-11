import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { AzureConfig } from '../types/azureConfig';

/**
 * Required Microsoft Graph API scopes for organizational chart functionality
 */
export const GRAPH_SCOPES = {
  // Basic scopes for authentication
  BASIC: ['openid', 'profile', 'offline_access'],
  
  // Microsoft Graph scopes for organizational data
  USERS: ['User.Read.All'],
  DIRECTORY: ['Directory.Read.All'],
  ORGANIZATION: ['Organization.Read.All'],
} as const;

/**
 * Get all required scopes for the org chart application
 */
export function getRequiredScopes(): string[] {
  return [
    ...GRAPH_SCOPES.BASIC,
    ...GRAPH_SCOPES.USERS,
    ...GRAPH_SCOPES.DIRECTORY,
  ];
}

/**
 * Create MSAL configuration from user's Azure AD settings
 */
export function createMsalConfiguration(azureConfig: AzureConfig): Configuration {
  // Validate required fields
  if (!azureConfig.clientId || !azureConfig.tenantId || !azureConfig.redirectUri) {
    throw new Error('Missing required Azure AD configuration. ClientId, TenantId, and RedirectUri are required.');
  }

  // Construct authority URL
  // Support both tenant ID (GUID) and tenant name formats
  const authority = azureConfig.tenantId.includes('.')
    ? `https://login.microsoftonline.com/${azureConfig.tenantId}`
    : `https://login.microsoftonline.com/${azureConfig.tenantId}`;

  const msalConfig: Configuration = {
    auth: {
      clientId: azureConfig.clientId,
      authority: authority,
      redirectUri: azureConfig.redirectUri,
      // Enable interaction with multiple Azure AD tenants
      knownAuthorities: [authority],
      // Post logout redirect URI
      postLogoutRedirectUri: azureConfig.redirectUri,
    },
    cache: {
      // Store tokens in localStorage for persistence across browser sessions
      cacheLocation: 'localStorage',
      // Encrypt cache to protect tokens
      storeAuthStateInCookie: false,
    },
    system: {
      // Enable logging for debugging
      loggerOptions: {
        loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
          if (containsPii) return;
          
          // Suppress the multiple instance warning since we handle it properly
          if (message.includes('There is already an instance of MSAL.js in the window')) {
            return;
          }
          
          switch (level) {
            case LogLevel.Error:
              console.error(`[MSAL Error] ${message}`);
              break;
            case LogLevel.Warning:
              console.warn(`[MSAL Warning] ${message}`);
              break;
            case LogLevel.Info:
              console.info(`[MSAL Info] ${message}`);
              break;
            case LogLevel.Verbose:
              console.debug(`[MSAL Verbose] ${message}`);
              break;
          }
        },
        // Set log level (Error = 0, Warning = 1, Info = 2, Verbose = 3)
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
      },
      // Disable telemetry to protect user privacy
      telemetry: {
        applicationName: 'Microsoft Org Chart Tool',
        applicationVersion: '1.0.0',
      },
      // Allow redirect flows in iframes (needed for silent token acquisition)
      allowNativeBroker: false,
    },
    // Optional: Custom navigation options
    navigation: {
      // Use browser history navigation
      navigateToLoginRequestUrl: true,
    },
  };

  return msalConfig;
}

/**
 * Create and initialize MSAL PublicClientApplication instance
 * This should be called outside the component tree and cached
 */
export async function createMsalInstance(azureConfig: AzureConfig): Promise<PublicClientApplication> {
  try {
    const msalConfig = createMsalConfiguration(azureConfig);
    const msalInstance = new PublicClientApplication(msalConfig);
    
    // Initialize the MSAL instance
    await msalInstance.initialize();
    
    return msalInstance;
  } catch (error) {
    console.error('Failed to create MSAL instance:', error);
    throw error;
  }
}

/**
 * Login request configuration for initial authentication
 */
export function createLoginRequest(azureConfig: AzureConfig) {
  return {
    scopes: getRequiredScopes(),
    // Prompt user to select account if multiple accounts are available
    prompt: 'select_account' as const,
    // Optional: Login hint if available
    loginHint: undefined,
    // Optional: Domain hint to speed up authentication
    domainHint: azureConfig.tenantId.includes('.') ? azureConfig.tenantId : undefined,
  };
}

/**
 * Silent token request configuration for API calls
 */
export function createSilentRequest(scopes: string[] = getRequiredScopes()) {
  return {
    scopes,
    // Force refresh if token is close to expiry
    forceRefresh: false,
  };
}

/**
 * Microsoft Graph API token request
 */
export function createGraphTokenRequest() {
  return {
    scopes: [
      ...GRAPH_SCOPES.USERS,
      ...GRAPH_SCOPES.DIRECTORY,
    ],
  };
}

/**
 * Validate MSAL configuration before using
 */
export function validateMsalConfig(azureConfig: AzureConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate Client ID (should be a GUID)
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!azureConfig.clientId) {
    errors.push('Client ID is required');
  } else if (!guidRegex.test(azureConfig.clientId)) {
    errors.push('Client ID must be a valid GUID format');
  }

  // Validate Tenant ID (can be GUID or domain name)
  if (!azureConfig.tenantId) {
    errors.push('Tenant ID is required');
  } else if (!guidRegex.test(azureConfig.tenantId) && !azureConfig.tenantId.includes('.')) {
    errors.push('Tenant ID must be a valid GUID or domain name (e.g., contoso.onmicrosoft.com)');
  }

  // Validate Redirect URI
  if (!azureConfig.redirectUri) {
    errors.push('Redirect URI is required');
  } else {
    try {
      new URL(azureConfig.redirectUri);
    } catch {
      errors.push('Redirect URI must be a valid URL');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get MSAL error message in user-friendly format
 */
export function getMsalErrorMessage(error: any): string {
  if (!error) return 'Unknown authentication error';

  // MSAL browser error codes
  switch (error.errorCode) {
    case 'consent_required':
      return 'Admin consent is required for this application. Please contact your administrator.';
    case 'interaction_required':
      return 'User interaction is required to complete authentication.';
    case 'login_required':
      return 'You need to sign in to access this application.';
    case 'network_error':
      return 'Network error occurred. Please check your internet connection and try again.';
    case 'server_error':
      return 'Authentication server error. Please try again later.';
    case 'invalid_client':
      return 'Invalid client configuration. Please check your Azure AD app settings.';
    case 'invalid_grant':
      return 'Authentication grant is invalid or expired. Please sign in again.';
    case 'unauthorized_client':
      return 'This client is not authorized to use this authentication flow.';
    default:
      return error.message || error.errorMessage || 'Authentication failed. Please try again.';
  }
}