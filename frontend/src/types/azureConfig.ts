export interface AzureConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  graphScopes?: string[];
}

export interface StoredConfig extends AzureConfig {
  lastValidated?: Date;
  organizationName?: string;
}

export const DEFAULT_GRAPH_SCOPES = [
  'User.Read',
  'User.ReadBasic.All',
  'User.Read.All'
];

export const AZURE_CONFIG_KEY = 'azure-ad-config';