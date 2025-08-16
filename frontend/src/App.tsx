import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OrgChart } from './components/OrgChart';
import { SearchPanel } from './components/SearchPanel';
import { ScenarioPanel } from './components/ScenarioPanel';
import { EmployeeModal } from './components/EmployeeModal';
import { ExportModal } from './components/ExportModal';
import { SetupWizard } from './components/SetupWizard';
import { SettingsModal } from './components/SettingsModal';
import { ViewModeSelector } from './components/ViewModeSelector';
import { QuickSaveModal } from './components/QuickSaveModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { useOrgStore } from './stores/orgStore';
import { getStoredConfig, getConfigFromEnv, clearConfig } from './utils/azureConfig';
import { AzureConfig } from './types/azureConfig';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { 
  AuthProvider, 
  useAuth, 
  useGraphToken,
  AuthLoadingState,
  AuthError,
  AuthStatusHelper
} from './auth';
import { 
  AuthenticatingState, 
  LoadingOrgData, 
  LoadingUserContext,
  LoadingOrgChart
} from './components/LoadingStates';

/**
 * Inner App component that uses authentication context
 */
function AppContent() {
  // Authentication hooks
  const { 
    status, 
    isAuthenticated, 
    user, 
    error: authError,
    azureConfig,
    hasValidConfig,
    login,
    logout,
    clearError: clearAuthError,
    setAzureConfig
  } = useAuth();
  const getGraphToken = useGraphToken();

  // Zustand store
  const {
    employees,
    baseEmployees,
    allEmployees,
    currentUser,
    isLoadingData,
    isLoadingBackground,
    loadingType,
    dataError,
    useMockData,
    dataSource,
    backgroundDataLoaded,
    hasUnsavedChanges,
    isSandboxMode,
    reassignedEmployeeIds,
    scenarios,
    currentScenario,
    viewConfig,
    searchTerm,
    selectedEmployee,
    userRole,
    
    // Actions
    setEmployees,
    setDataError,
    setDataSource,
    toggleSandboxMode,
    updateEmployee,
    reassignEmployee,
    resetToLive,
    saveScenario,
    loadScenario,
    deleteScenario,
    setSearchTerm,
    setSelectedEmployee,
    loadCompleteOrgData,
    loadMockData,
    searchEmployees,
    changeView,
    resetMockDataFlag
  } = useOrgStore();
  
  // UI state (not managed by store)
  const [showScenarioPanel, setShowScenarioPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuickSaveModal, setShowQuickSaveModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);

  /**
   * Load initial data
   */
  const loadGraphData = useCallback(async () => {
    await loadCompleteOrgData(getGraphToken, isAuthenticated);
  }, [loadCompleteOrgData, getGraphToken, isAuthenticated]);

  /**
   * Handle authentication and data loading
   */
  useEffect(() => {
    // Only load initial data if we don't have any employees yet
    if (AuthStatusHelper.isAuthenticated(status) && hasValidConfig && !useMockData && employees.length === 0) {
      loadGraphData();
    } else if (useMockData && employees.length === 0) {
      loadMockData();
    }
  }, [status, hasValidConfig, useMockData, employees.length, loadGraphData, loadMockData]);

  /**
   * Handle context reload when exiting sandbox mode
   */
  useEffect(() => {
    // Reload data when backgroundDataLoaded flag is reset (happens when exiting sandbox mode)
    if (!backgroundDataLoaded && employees.length > 0) {
      if (useMockData) {
        loadMockData();
      } else if (AuthStatusHelper.isAuthenticated(status) && hasValidConfig) {
        loadGraphData();
      }
    }
  }, [backgroundDataLoaded, employees.length, useMockData, status, hasValidConfig, loadGraphData, loadMockData]);

  /**
   * Handle authentication-related actions
   */
  const handleLogin = async () => {
    try {
      clearAuthError();
      setDataError(null);
      // Reset mock data flag when attempting to authenticate
      if (useMockData) {
        resetMockDataFlag();
      }
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleUseMockData = () => {
    loadMockData();
  };

  const handleConfigUpdate = async (config: AzureConfig) => {
    // Update AuthProvider configuration to trigger MSAL reinitialization
    await setAzureConfig(config);
    setDataError(null);
  };

  const handleSwitchToMockData = () => {
    loadMockData();
  };

  const handleResetConfig = async () => {
    clearConfig();
    // Clear authentication state
    await setAzureConfig(null);
    
    setEmployees([]);
    setDataSource(null);
    setDataError(null);
  };

  /**
   * Handle data retry
   */
  const handleRetryData = () => {
    // Clear any existing error state
    setDataError(null);
    
    if (isAuthenticated && !useMockData) {
      loadGraphData();
    } else {
      loadMockData();
    }
  };

  // Employee management handlers
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEmployeeUpdate = (updatedEmployee: any) => {
    updateEmployee(updatedEmployee);
  };

  const handleEmployeeColorChange = (employeeId: string, color: string | undefined) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (employee) {
      updateEmployee({ ...employee, customColor: color });
    }
  };

  const handleEmployeeReassign = (employeeId: string, newManagerId: string | null) => {
    reassignEmployee(employeeId, newManagerId);
  };

  const handleSearch = async (query: string) => {
    return await searchEmployees(query, getGraphToken, isAuthenticated);
  };

  const handleSaveScenario = (name: string, description: string) => {
    saveScenario(name, description, user?.name || 'Current User');
  };

  const handleLoadScenario = (scenario: any) => {
    loadScenario(scenario);
  };

  const handleResetToLive = () => {
    if (hasUnsavedChanges) {
      setPendingAction({ type: 'resetToLive' });
      setShowConfirmDialog(true);
      return;
    }
    executeResetToLive();
  };

  const executeResetToLive = () => {
    resetToLive();
  };
  
  /**
   * Handle view mode changes
   */
  const handleViewChange = useCallback(async (newConfig: typeof viewConfig) => {
    // Check for unsaved changes before switching views
    if (hasUnsavedChanges && isSandboxMode) {
      setPendingAction({ type: 'viewChange', data: newConfig });
      setShowConfirmDialog(true);
      return;
    }
    
    await executeViewChange(newConfig);
  }, [hasUnsavedChanges, isSandboxMode, viewConfig]);

  const executeViewChange = useCallback(async (newConfig: typeof viewConfig) => {
    await changeView(newConfig, getGraphToken, isAuthenticated);
  }, [changeView, getGraphToken, isAuthenticated]);

  /**
   * Handle confirmation dialog actions
   */
  const handleConfirmAction = () => {
    if (!pendingAction) return;
    
    switch (pendingAction.type) {
      case 'resetToLive':
        executeResetToLive();
        break;
      case 'viewChange':
        executeViewChange(pendingAction.data);
        break;
      default:
        break;
    }
    
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  // Enable keyboard shortcuts for quick color changes
  useKeyboardShortcuts({
    selectedEmployeeId: selectedEmployee?.id,
    isSandboxMode,
    onColorChange: handleEmployeeColorChange
  });
  

  // Show loading state during authentication
  if (AuthStatusHelper.isLoading(status)) {
    return <AuthenticatingState />;
  }
  
  // Show data loading state
  if (isLoadingData) {
    switch (loadingType) {
      case 'initial':
        return <LoadingOrgData />;
      case 'user-context':
        return (
          <div className="min-h-screen bg-gray-50 pt-16">
            <LoadingUserContext userName={viewConfig.searchQuery} />
          </div>
        );
      default:
        return <LoadingOrgData />;
    }
  }

  // Show authentication error with retry option
  if (AuthStatusHelper.hasError(status) && authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <AuthError 
            error={authError}
            onRetry={handleLogin}
            onDismiss={clearAuthError}
          />
          <div className="mt-4 text-center">
            <button
              onClick={handleUseMockData}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Continue with demo data instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show setup wizard if no valid config and not using mock data
  if (!hasValidConfig && !useMockData) {
    return (
      <SetupWizard 
        onComplete={handleConfigUpdate}
        onUseMockData={handleUseMockData}
      />
    );
  }

  // Show login prompt if we have config but user isn't authenticated
  if (hasValidConfig && !isAuthenticated && !useMockData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600 mb-6">
              Sign in to access your organization chart
            </p>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign in with Microsoft
            </button>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleUseMockData}
                className="text-gray-600 hover:text-gray-700 text-sm underline"
              >
                Continue with demo data
              </button>
            </div>
            {azureConfig && (
              <div className="mt-4 text-xs text-gray-500">
                Connected to: {azureConfig.tenantId}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed at top */}
      <Header
        isInPlanningMode={isSandboxMode}
        onTogglePlanningMode={toggleSandboxMode}
        onShowScenarios={() => setShowScenarioPanel(true)}
        onShowExport={() => setShowExportModal(true)}
        onResetToLive={handleResetToLive}
        onResetConfig={handleResetConfig}
        onShowSettings={() => setShowSettingsModal(true)}
        onQuickSave={() => setShowQuickSaveModal(true)}
        userRole={userRole}
        currentScenario={currentScenario}
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={handleLogin}
        onLogout={logout}
      />
      
      {/* Sticky Navigation Container */}
      <div className="fixed top-16 left-0 right-0 z-40">
        {/* View Mode Selector */}
        <ViewModeSelector
          currentUser={currentUser}
          employees={employees}
          allEmployees={allEmployees}
          viewConfig={viewConfig}
          onViewChange={handleViewChange}
          onSearch={handleSearch}
          isLoading={isLoadingData}
          isSandboxMode={isSandboxMode}
          onQuickSave={() => setShowQuickSaveModal(true)}
          isLoadingBackground={isLoadingBackground}
          backgroundDataLoaded={backgroundDataLoaded}
        />
        
        {/* Data error banner */}
        {dataError && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-yellow-800 text-sm">
                  <strong>Data Loading Error:</strong> {dataError}
                  {dataSource === 'mock' && ' (Using demo data instead)'}
                </div>
              </div>
              <button
                onClick={handleRetryData}
                className="text-yellow-600 hover:text-yellow-700 text-sm underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

      </div>
      
      {/* Main Layout - Proper spacing after sticky navigation */}
      <div className="flex min-h-screen" style={{ paddingTop: '168px' }}>
        {/* Left Sidebar - Fixed, positioned after sticky nav */}
        <div className="fixed left-0 z-20 bg-white border-r border-gray-200 w-80" 
             style={{
               top: '168px', // Start after header + nav elements
               height: 'calc(100vh - 168px)'
             }}>
          <SearchPanel
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            employees={filteredEmployees}
            onEmployeeSelect={(employee) => {
              // Use the same navigation pattern as top nav search
              handleViewChange({
                mode: 'search',
                centerPersonId: employee.id,
                searchQuery: employee.name
              });
            }}
          />
        </div>
        
        {/* Main Content Area - With left margin for fixed sidebar */}
        <div className="flex-1 ml-80">
          {employees.length === 0 && !dataError ? (
            <LoadingOrgChart />
          ) : (
            <OrgChart
              employees={employees}
              searchTerm={searchTerm}
              isSandboxMode={isSandboxMode}
              centerPersonId={viewConfig.centerPersonId}
              movedEmployeeIds={reassignedEmployeeIds}
              baseEmployees={baseEmployees}
              onEmployeeSelect={setSelectedEmployee}
              onEmployeeReassign={handleEmployeeReassign}
              onEmployeeColorChange={handleEmployeeColorChange}
            />
          )}
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdate={handleEmployeeUpdate}
          isSandboxMode={isSandboxMode}
          userRole={userRole}
          employees={employees}
          onEmployeeSelect={(employee) => {
            // Use the same navigation pattern as top nav search
            setSelectedEmployee(null); // Close current modal first
            handleViewChange({
              mode: 'search',
              centerPersonId: employee.id,
              searchQuery: employee.name
            });
          }}
        />
      )}

      {showScenarioPanel && (
        <ScenarioPanel
          scenarios={scenarios}
          onClose={() => setShowScenarioPanel(false)}
          onSave={handleSaveScenario}
          onLoad={handleLoadScenario}
          onDelete={deleteScenario}
          isInPlanningMode={isSandboxMode}
        />
      )}

      {showExportModal && (
        <ExportModal
          employees={employees}
          scenario={currentScenario}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          currentConfig={azureConfig}
          isUsingMockData={useMockData}
          onClose={() => setShowSettingsModal(false)}
          onConfigUpdate={handleConfigUpdate}
          onSwitchToMockData={handleSwitchToMockData}
          onClearConfig={handleResetConfig}
        />
      )}

      {showQuickSaveModal && (
        <QuickSaveModal
          isOpen={showQuickSaveModal}
          onClose={() => setShowQuickSaveModal(false)}
          onSave={handleSaveScenario}
        />
      )}

      {showConfirmDialog && (
        <ConfirmationDialog
          isOpen={showConfirmDialog}
          title="Unsaved Changes"
          message="You have unsaved changes in planning mode. Do you want to discard these changes and continue?"
          confirmText="Discard Changes"
          cancelText="Keep Editing"
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
          variant="warning"
        />
      )}
    </div>
  );
}

/**
 * Main App component with Authentication Provider
 */
function App() {
  const [initialConfig, setInitialConfig] = useState<AzureConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load initial configuration on mount
  useEffect(() => {
    // First check environment variables
    const envConfig = getConfigFromEnv();
    if (envConfig) {
      setInitialConfig(envConfig);
    } else {
      // Check localStorage
      const storedConfig = getStoredConfig();
      setInitialConfig(storedConfig);
    }
    setConfigLoaded(true);
  }, []);

  // Don't render until config is loaded to prevent flashing
  if (!configLoaded) {
    return <AuthLoadingState />;
  }

  return (
    <AuthProvider initialConfig={initialConfig}>
      <AppContent />
    </AuthProvider>
  );
}

export default App;