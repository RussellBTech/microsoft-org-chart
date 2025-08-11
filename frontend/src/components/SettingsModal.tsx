import React, { useState } from 'react';
import { X, Settings, Key, Globe, Link, Save, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { AzureConfig } from '../types/azureConfig';
import { validateConfig, saveConfig, clearConfig } from '../utils/azureConfig';

interface SettingsModalProps {
  currentConfig: AzureConfig | null;
  isUsingMockData: boolean;
  onClose: () => void;
  onConfigUpdate: (config: AzureConfig) => void;
  onSwitchToMockData: () => void;
  onClearConfig: () => void;
}

export function SettingsModal({
  currentConfig,
  isUsingMockData,
  onClose,
  onConfigUpdate,
  onSwitchToMockData,
  onClearConfig
}: SettingsModalProps) {
  const [config, setConfig] = useState<AzureConfig>({
    clientId: currentConfig?.clientId || '',
    tenantId: currentConfig?.tenantId || '',
    redirectUri: currentConfig?.redirectUri || window.location.origin
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleConfigChange = (field: keyof AzureConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
    setSaved(false);
  };

  const handleSave = () => {
    setIsSaving(true);
    const validation = validateConfig(config);
    
    if (validation.valid) {
      saveConfig(config);
      onConfigUpdate(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setValidationErrors(validation.errors);
    }
    
    setIsSaving(false);
  };

  const handleClearAndUseDemo = () => {
    if (confirm('Are you sure you want to clear Azure AD configuration and use demo data?')) {
      onClearConfig();
      onSwitchToMockData();
      onClose();
    }
  };

  const handleResetConfig = () => {
    if (confirm('Are you sure you want to reset to the setup wizard? This will clear all configuration.')) {
      onClearConfig();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Configuration Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Current Configuration</h3>
            {isUsingMockData ? (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Using demo data (no Azure AD connection)</span>
              </div>
            ) : currentConfig ? (
              <div className="space-y-1 text-sm text-gray-600">
                <div>Client ID: {currentConfig.clientId}</div>
                <div>Tenant: {currentConfig.tenantId}</div>
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span>Connected to Azure AD</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">No configuration found</span>
              </div>
            )}
          </div>

          {/* Azure AD Configuration Form */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Azure AD Configuration</h3>
            
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-1">Configuration Issues</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">Configuration saved successfully!</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={isSaving || !config.clientId || !config.tenantId}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Azure AD Configuration
                </>
              )}
            </button>

            <button
              onClick={handleClearAndUseDemo}
              className="w-full bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-medium hover:bg-orange-200 transition-colors flex items-center justify-center"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Switch to Demo Data
            </button>

            <button
              onClick={handleResetConfig}
              className="w-full bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset to Setup Wizard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}