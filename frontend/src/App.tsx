import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { OrgChart } from './components/OrgChart';
import { ScenarioPanel } from './components/ScenarioPanel';
import { EmployeeModal } from './components/EmployeeModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ViewModeSelector } from './components/ViewModeSelector';
import { QuickSaveModal } from './components/QuickSaveModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ChangeSummaryPanel } from './components/ChangeSummaryPanel';
import { CreatePositionModal } from './components/CreatePositionModal';
import { useOrgStore } from './stores/orgStore';
import { getStoredConfig, getConfigFromEnv } from './utils/azureConfig';
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
    isAuthReady,
    user,
    error: authError,
    azureConfig,
    hasValidConfig,
    login,
    logout,
    clearError: clearAuthError
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
    selectedEmployee,
    userRole,

    // Actions
    setDataError,
    toggleSandboxMode,
    updateEmployee,
    reassignEmployee,
    resetToLive,
    saveScenario,
    loadScenario,
    deleteScenario,
    setSelectedEmployee,
    loadCompleteOrgData,
    searchEmployees,
    changeView,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Open positions
    createOpenPosition,
    deleteOpenPosition
  } = useOrgStore();
  
  // UI state (not managed by store)
  const [showScenarioPanel, setShowScenarioPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuickSaveModal, setShowQuickSaveModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showChangeSummary, setShowChangeSummary] = useState(false);
  const [showCreatePosition, setShowCreatePosition] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const orgChartRef = useRef<HTMLDivElement>(null);

  // Calculate change count for header badge
  const changeCount = reassignedEmployeeIds.size +
    employees.filter(e => {
      const base = baseEmployees.find(b => b.id === e.id);
      return base && base.title !== e.title;
    }).length +
    employees.filter(e => e.id.startsWith('open-') && !baseEmployees.find(b => b.id === e.id)).length;

  /**
   * Load initial data
   */
  const loadGraphData = useCallback(async () => {
    await loadCompleteOrgData(getGraphToken, isAuthReady);
  }, [loadCompleteOrgData, getGraphToken, isAuthReady]);

  /**
   * Handle authentication and data loading
   */
  useEffect(() => {
    // Only load initial data if we don't have any employees yet
    if (isAuthReady && hasValidConfig && !useMockData && employees.length === 0) {
      loadGraphData();
    }
  }, [isAuthReady, hasValidConfig, useMockData, employees.length, loadGraphData]);

  /**
   * Handle context reload when exiting sandbox mode
   */
  useEffect(() => {
    // Reload data when backgroundDataLoaded flag is reset (happens when exiting sandbox mode)
    if (!backgroundDataLoaded && employees.length > 0) {
      if (AuthStatusHelper.isAuthenticated(status) && hasValidConfig) {
        loadGraphData();
      }
    }
  }, [backgroundDataLoaded, employees.length, status, hasValidConfig, loadGraphData]);

  /**
   * Handle authentication-related actions
   */
  const handleLogin = async () => {
    try {
      clearAuthError();
      setDataError(null);
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };


  /**
   * Handle data retry
   */
  const handleRetryData = () => {
    // Clear any existing error state
    setDataError(null);

    if (isAuthenticated) {
      loadGraphData();
    }
  };

  // Employee management handlers
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
    return await searchEmployees(query, getGraphToken, isAuthReady);
  };

  const handleSaveScenario = (name: string, description: string) => {
    saveScenario(name, description, user?.name || 'Current User');
  };

  const handleCreatePosition = (managerId: string, title: string, department: string) => {
    createOpenPosition(managerId, title, department);
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

  const handleTogglePlanningMode = () => {
    if (isSandboxMode && hasUnsavedChanges) {
      setPendingAction({ type: 'exitPlanningMode' });
      setShowConfirmDialog(true);
      return;
    }
    toggleSandboxMode();
  };

  const executeExitPlanningMode = () => {
    toggleSandboxMode();
  };
  
  /**
   * Handle view mode changes
   */
  const handleViewChange = useCallback(async (newConfig: typeof viewConfig) => {
    console.log('🔄 handleViewChange called:', { newConfig, hasUnsavedChanges, isSandboxMode });
    
    // Check for unsaved changes before switching views
    if (hasUnsavedChanges && isSandboxMode) {
      console.log('⚠️ Unsaved changes detected - showing confirmation dialog');
      setPendingAction({ type: 'viewChange', data: newConfig });
      setShowConfirmDialog(true);
      return;
    }
    
    console.log('✅ No unsaved changes - proceeding with view change');
    await executeViewChange(newConfig);
  }, [hasUnsavedChanges, isSandboxMode, viewConfig]);

  const executeViewChange = useCallback(async (newConfig: typeof viewConfig) => {
    // If we had unsaved changes, discard them first
    if (hasUnsavedChanges && isSandboxMode) {
      console.log('🔄 Discarding unsaved changes before view change');
      resetToLive();
    }
    
    await changeView(newConfig, getGraphToken, isAuthReady);
  }, [changeView, getGraphToken, isAuthReady, hasUnsavedChanges, isSandboxMode, resetToLive]);

  /**
   * Handle confirmation dialog actions
   */
  const handleConfirmAction = () => {
    if (!pendingAction) return;
    
    console.log('✅ User confirmed action:', pendingAction.type, pendingAction.data);
    
    switch (pendingAction.type) {
      case 'resetToLive':
        executeResetToLive();
        break;
      case 'exitPlanningMode':
        executeExitPlanningMode();
        break;
      case 'viewChange':
        console.log('🔄 Executing pending view change after confirmation');
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
  
  // Show loading state if authenticated but not fully ready for API calls
  if (isAuthenticated && !isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing your workspace...</p>
        </div>
      </div>
    );
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
        </div>
      </div>
    );
  }

  // Show configuration error if no valid config
  if (!hasValidConfig && !useMockData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configuration Required
          </h2>
          <p className="text-gray-600 mb-4">
            Azure AD credentials are not configured. Please contact your administrator to set up the environment variables.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Required: VITE_AZURE_CLIENT_ID, VITE_AZURE_TENANT_ID, VITE_AZURE_REDIRECT_URI
          </p>
          <button
            onClick={() => useOrgStore.getState().loadMockData()}
            className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Continue with Demo Data
          </button>
        </div>
      </div>
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
              Welcome
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
        onTogglePlanningMode={handleTogglePlanningMode}
        onShowScenarios={() => setShowScenarioPanel(true)}
        onShowExport={() => setShowExportModal(true)}
        onResetToLive={handleResetToLive}
        onShowSettings={() => setShowSettingsModal(true)}
        onQuickSave={() => setShowQuickSaveModal(true)}
        userRole={userRole}
        currentScenario={currentScenario}
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={handleLogin}
        onLogout={logout}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onUndo={undo}
        onRedo={redo}
        onShowChangeSummary={() => setShowChangeSummary(true)}
        changeCount={changeCount}
        onCreatePosition={() => setShowCreatePosition(true)}
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
        {/* Main Content Area - Full width */}
        <div ref={orgChartRef} className="flex-1">
          {employees.length === 0 && !dataError ? (
            <LoadingOrgChart />
          ) : (
            <OrgChart
              employees={employees}
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
          orgChartRef={orgChartRef}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          currentConfig={azureConfig}
          isUsingMockData={useMockData}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showQuickSaveModal && (
        <QuickSaveModal
          isOpen={showQuickSaveModal}
          onClose={() => setShowQuickSaveModal(false)}
          onSave={handleSaveScenario}
          onDelete={deleteScenario}
          scenarios={scenarios}
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

      {showChangeSummary && (
        <ChangeSummaryPanel
          isOpen={showChangeSummary}
          onClose={() => setShowChangeSummary(false)}
          employees={employees}
          baseEmployees={baseEmployees}
          reassignedEmployeeIds={reassignedEmployeeIds}
          onEmployeeClick={(employee) => {
            setShowChangeSummary(false);
            setSelectedEmployee(employee);
          }}
        />
      )}

      {showCreatePosition && (
        <CreatePositionModal
          isOpen={showCreatePosition}
          onClose={() => setShowCreatePosition(false)}
          onCreate={handleCreatePosition}
          employees={employees}
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