import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Key, Globe, Link, HelpCircle, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { AzureConfig } from '../types/azureConfig';
import { validateConfig, saveConfig } from '../utils/azureConfig';

interface SetupWizardProps {
  onComplete: (config: AzureConfig) => void;
  onUseMockData?: () => void;
}

export function SetupWizard({ onComplete, onUseMockData }: SetupWizardProps) {
  const [step, setStep] = useState<'intro' | 'config' | 'validate'>('intro');
  const [config, setConfig] = useState<AzureConfig>({
    clientId: '',
    tenantId: '',
    redirectUri: window.location.origin
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleConfigChange = (field: keyof AzureConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]); // Clear errors on change
  };

  const handleValidate = async () => {
    setIsValidating(true);
    const validation = validateConfig(config);
    
    if (validation.valid) {
      // Save configuration
      saveConfig(config);
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete(config);
    } else {
      setValidationErrors(validation.errors);
    }
    
    setIsValidating(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Org Chart Manager
            </h1>
            <p className="text-gray-600">
              Visualize and manage your organization structure with Microsoft Graph
            </p>
            {!window.localStorage.getItem('azure-ad-config') && (
              <p className="text-sm text-gray-500 mt-2">
                First-time setup required - let's configure your Azure AD connection
              </p>
            )}
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What you'll need:</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>An Azure AD application registered in your tenant</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Client ID and Tenant ID from your app registration</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Microsoft Graph API permissions (User.Read.All)</span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1">Privacy First</h3>
                  <p className="text-sm text-amber-800">
                    Your Azure AD credentials are stored locally in your browser. 
                    No data is sent to external servers. All Microsoft Graph API calls 
                    are made directly from your browser using your credentials.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setStep('config')}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Configure Azure AD Connection
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            
            {onUseMockData && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>
            )}
            
            {onUseMockData && (
              <div className="text-center">
                <button
                  onClick={onUseMockData}
                  className="w-full bg-green-50 border border-green-200 text-green-700 px-6 py-3 rounded-lg font-medium hover:bg-green-100 transition-colors flex items-center justify-center"
                >
                  <span className="mr-2">🚀</span>
                  Try Demo Mode (No Setup Required)
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Explore all features with sample data • No Microsoft account needed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Azure AD Configuration</h2>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600">
            Enter your Azure AD application details below
          </p>
        </div>

        {showHelp && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">How to register an Azure AD app:</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li>1. Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">
                Azure Portal <ExternalLink className="w-3 h-3 ml-1" />
              </a></li>
              <li>2. Navigate to Azure Active Directory → App registrations</li>
              <li>3. Click "New registration"</li>
              <li>4. Name your app (e.g., "Org Chart Manager")</li>
              <li>5. Set redirect URI to: 
                <code className="bg-gray-100 px-2 py-1 rounded ml-2 inline-flex items-center">
                  {window.location.origin}
                  <button
                    onClick={() => copyToClipboard(window.location.origin, 'redirect')}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    {copiedField === 'redirect' ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </code>
              </li>
              <li>6. After creation, go to API permissions → Add permission → Microsoft Graph → Delegated → User.Read.All</li>
              <li>7. Grant admin consent for the permissions</li>
              <li>8. Copy the Application (client) ID and Directory (tenant) ID</li>
            </ol>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              Application (Client) ID
            </label>
            <input
              type="text"
              value={config.clientId}
              onChange={(e) => handleConfigChange('clientId', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Found in Azure Portal → App registrations → Your app → Overview
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 inline mr-1" />
              Directory (Tenant) ID
            </label>
            <input
              type="text"
              value={config.tenantId}
              onChange={(e) => handleConfigChange('tenantId', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000 or contoso.onmicrosoft.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Can be a GUID or your domain (e.g., contoso.onmicrosoft.com)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Link className="w-4 h-4 inline mr-1" />
              Redirect URI
            </label>
            <input
              type="text"
              value={config.redirectUri}
              onChange={(e) => handleConfigChange('redirectUri', e.target.value)}
              placeholder={window.location.origin}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must match the redirect URI configured in your Azure AD app
            </p>
          </div>

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Configuration Issues</h3>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('intro')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleValidate}
              disabled={isValidating || !config.clientId || !config.tenantId}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Validating...
                </>
              ) : (
                <>
                  Save Configuration
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}