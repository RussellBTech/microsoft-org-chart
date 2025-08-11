import { PublicClientApplication } from '@azure/msal-browser';
import { AzureConfig } from '../types/azureConfig';
import { createMsalConfiguration, validateMsalConfig } from './msalConfig';

/**
 * MSAL Instance Manager
 * Handles singleton instances to prevent client ID conflicts
 */
class MsalInstanceManager {
  private instances = new Map<string, PublicClientApplication>();
  private initializingInstances = new Map<string, Promise<PublicClientApplication>>();

  /**
   * Get or create MSAL instance for a given configuration
   */
  async getInstance(config: AzureConfig): Promise<PublicClientApplication> {
    const key = this.getInstanceKey(config);
    
    // Return existing instance if available
    if (this.instances.has(key)) {
      console.log(`♻️ Reusing existing MSAL instance for client: ${config.clientId.substring(0, 8)}...`);
      return this.instances.get(key)!;
    }
    
    // Return pending initialization if in progress
    if (this.initializingInstances.has(key)) {
      console.log(`⏳ Waiting for pending MSAL initialization for client: ${config.clientId.substring(0, 8)}...`);
      return await this.initializingInstances.get(key)!;
    }
    
    // Add a small delay to prevent rapid recreation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check again if instance was created in the meantime
    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }
    
    // Create new instance
    const initPromise = this.createInstance(config, key);
    this.initializingInstances.set(key, initPromise);
    
    try {
      const instance = await initPromise;
      this.instances.set(key, instance);
      this.initializingInstances.delete(key);
      return instance;
    } catch (error) {
      this.initializingInstances.delete(key);
      throw error;
    }
  }

  /**
   * Create a new MSAL instance
   */
  private async createInstance(config: AzureConfig, key: string): Promise<PublicClientApplication> {
    // Validate configuration
    const validation = validateMsalConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid MSAL configuration: ${validation.errors.join(', ')}`);
    }

    // Clear any existing browser state for this client
    await this.clearBrowserState(config.clientId);

    // Create MSAL configuration
    const msalConfig = createMsalConfiguration(config);
    
    // Add unique instance ID to prevent collisions
    msalConfig.system = {
      ...msalConfig.system,
      clientCapabilities: [`org-chart-${Date.now()}`],
    };

    console.log(`🔐 Creating MSAL instance for client: ${config.clientId.substring(0, 8)}...`);
    
    // Create and initialize instance
    const instance = new PublicClientApplication(msalConfig);
    await instance.initialize();
    
    console.log(`✅ MSAL instance initialized successfully`);
    return instance;
  }

  /**
   * Clear browser state and global MSAL instances for a client ID
   */
  private async clearBrowserState(clientId: string): Promise<void> {
    try {
      // Clear MSAL global window instances
      if (typeof window !== 'undefined') {
        // Access MSAL's internal global state
        const windowAny = window as any;
        
        // Clear MSAL's global instance registry
        if (windowAny._msalInstances) {
          delete windowAny._msalInstances[clientId];
          console.log(`🧹 Cleared global MSAL instance for client: ${clientId.substring(0, 8)}...`);
        }
        
        // Clear other MSAL global state
        if (windowAny.msal) {
          delete windowAny.msal;
        }
        
        // Clear any MSAL event listeners or globals
        ['msalInstance', 'msalConfig', 'publicClientApplication'].forEach(prop => {
          if (windowAny[prop]) {
            delete windowAny[prop];
          }
        });
      }

      // Clear localStorage entries related to MSAL and this client
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('msal.') ||
          key.includes(clientId) ||
          key.includes('microsoft.') ||
          key.includes('azure.')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 Cleared ${keysToRemove.length} localStorage keys`);
      }

      // Clear sessionStorage entries
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.includes('msal.') ||
          key.includes(clientId) ||
          key.includes('microsoft.') ||
          key.includes('azure.')
        )) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });

      if (sessionKeysToRemove.length > 0) {
        console.log(`🧹 Cleared ${sessionKeysToRemove.length} sessionStorage keys`);
      }

    } catch (error) {
      console.warn('Error clearing browser state:', error);
    }
  }

  /**
   * Remove and cleanup instance
   */
  async removeInstance(config: AzureConfig): Promise<void> {
    const key = this.getInstanceKey(config);
    const instance = this.instances.get(key);
    
    if (instance) {
      try {
        // Get all accounts and clear them
        const accounts = instance.getAllAccounts();
        for (const account of accounts) {
          instance.removeAccount(account);
        }
        
        console.log(`🗑️ Removed MSAL instance for client: ${config.clientId.substring(0, 8)}...`);
      } catch (error) {
        console.warn('Error cleaning up MSAL instance:', error);
      }
      
      this.instances.delete(key);
    }
    
    // Clear any pending initialization
    this.initializingInstances.delete(key);
    
    // Clear browser state
    await this.clearBrowserState(config.clientId);
  }

  /**
   * Clear all instances (for app reset)
   */
  async clearAllInstances(): Promise<void> {
    const instances = Array.from(this.instances.values());
    const configs = Array.from(this.instances.keys()).map(key => {
      const [clientId] = key.split('|');
      return { clientId } as AzureConfig;
    });
    
    // Remove all instances
    for (const config of configs) {
      await this.removeInstance(config);
    }
    
    // Clear maps
    this.instances.clear();
    this.initializingInstances.clear();
    
    // Clear all MSAL-related storage
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.includes('msal.') || key.includes('microsoft.') || key.includes('azure.')) {
          localStorage.removeItem(key);
        }
      });
      
      const allSessionKeys = Object.keys(sessionStorage);
      allSessionKeys.forEach(key => {
        if (key.includes('msal.') || key.includes('microsoft.') || key.includes('azure.')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Error clearing all browser state:', error);
    }
    
    console.log('🧹 Cleared all MSAL instances and browser state');
  }

  /**
   * Generate unique key for instance mapping
   */
  private getInstanceKey(config: AzureConfig): string {
    return `${config.clientId}|${config.tenantId}`;
  }

  /**
   * Get current instance count (for debugging)
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * List active client IDs (for debugging)
   */
  getActiveClients(): string[] {
    return Array.from(this.instances.keys()).map(key => {
      const [clientId] = key.split('|');
      return clientId.substring(0, 8) + '...';
    });
  }
}

// Global singleton instance
export const msalManager = new MsalInstanceManager();

// Export helper functions
export const getMsalInstance = (config: AzureConfig) => msalManager.getInstance(config);
export const removeMsalInstance = (config: AzureConfig) => msalManager.removeInstance(config);
export const clearAllMsalInstances = () => msalManager.clearAllInstances();

// Development helpers
export const getMsalDebugInfo = () => ({
  instanceCount: msalManager.getInstanceCount(),
  activeClients: msalManager.getActiveClients(),
});

/**
 * Hook to handle page unload cleanup
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Don't clear instances on page refresh in development
    if (process.env.NODE_ENV === 'production') {
      msalManager.clearAllInstances();
    }
  });
}