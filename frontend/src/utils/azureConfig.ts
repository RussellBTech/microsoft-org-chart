import { AzureConfig, StoredConfig, AZURE_CONFIG_KEY, DEFAULT_GRAPH_SCOPES } from '../types/azureConfig';

export const getStoredConfig = (): StoredConfig | null => {
  try {
    const stored = localStorage.getItem(AZURE_CONFIG_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      // Convert lastValidated string back to Date
      if (config.lastValidated) {
        config.lastValidated = new Date(config.lastValidated);
      }
      return config;
    }
  } catch (error) {
    console.error('Error reading Azure AD config:', error);
  }
  return null;
};

export const saveConfig = (config: AzureConfig): void => {
  const storedConfig: StoredConfig = {
    ...config,
    lastValidated: new Date(),
    graphScopes: config.graphScopes || DEFAULT_GRAPH_SCOPES
  };
  localStorage.setItem(AZURE_CONFIG_KEY, JSON.stringify(storedConfig));
};

export const clearConfig = (): void => {
  localStorage.removeItem(AZURE_CONFIG_KEY);
};

export const validateConfig = (config: AzureConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate Client ID (GUID format)
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!config.clientId || !guidRegex.test(config.clientId)) {
    errors.push('Client ID must be a valid GUID');
  }
  
  // Validate Tenant ID (GUID or domain)
  const tenantRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-zA-Z0-9.-]+\.(onmicrosoft\.com|[a-zA-Z]{2,}))$/i;
  if (!config.tenantId || !tenantRegex.test(config.tenantId)) {
    errors.push('Tenant ID must be a valid GUID or domain');
  }
  
  // Validate Redirect URI
  try {
    const url = new URL(config.redirectUri);
    if (!url.protocol.startsWith('http')) {
      errors.push('Redirect URI must be a valid HTTP(S) URL');
    }
  } catch {
    errors.push('Redirect URI must be a valid URL');
  }
  
  return { valid: errors.length === 0, errors };
};

export const getConfigFromEnv = (): AzureConfig | null => {
  // Check if environment variables are set
  const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
  const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
  const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;
  
  if (clientId && tenantId) {
    return {
      clientId,
      tenantId,
      redirectUri,
      graphScopes: DEFAULT_GRAPH_SCOPES
    };
  }
  
  return null;
};