import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OrgChart } from './components/OrgChart';
import { SearchPanel } from './components/SearchPanel';
import { ScenarioPanel } from './components/ScenarioPanel';
import { EmployeeModal } from './components/EmployeeModal';
import { ExportModal } from './components/ExportModal';
import { SetupWizard } from './components/SetupWizard';
import { SettingsModal } from './components/SettingsModal';
import { ViewModeSelector, type ViewMode } from './components/ViewModeSelector';
import { QuickSaveModal } from './components/QuickSaveModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { mockEmployees, type Employee, type Scenario } from './data/mockData';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getStoredConfig, getConfigFromEnv, clearConfig } from './utils/azureConfig';
import { AzureConfig } from './types/azureConfig';
import { 
  AuthProvider, 
  useAuth, 
  useGraphToken,
  AuthLoadingState,
  AuthError,
  AuthStatusHelper,
  fetchAllUsers,
  fetchMyOrgContext,
  fetchDepartmentUsers,
  searchUsers,
  fetchUserOrgContext,
  fetchDepartments,
  transformGraphUserToEmployee,
  buildOrgContextEmployees,
  retryApiCall,
  getApiErrorMessage,
  isAuthError,
  DevHelper,
  getMsalDebugInfo
} from './auth';
import { 
  AuthenticatingState, 
  LoadingOrgData, 
  LoadingDepartment, 
  LoadingUserContext,
  LoadingOrgChart,
  InlineSpinner
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

  // App state
  const [employees, setEmployees] = useState<Employee[]>([]); // Currently displayed employees
  const [baseEmployees, setBaseEmployees] = useState<Employee[]>([]); // Original/live data for current view
  const [sandboxChanges, setSandboxChanges] = useState<Map<string, Employee>>(new Map()); // Sandbox modifications
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // Full org dataset for searching
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [loadingType, setLoadingType] = useState<'initial' | 'department' | 'search' | 'user-context' | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'graph' | null>(null);
  const [backgroundDataLoaded, setBackgroundDataLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // View mode state
  const [viewConfig, setViewConfig] = useState<{
    mode: ViewMode;
    centerPersonId?: string;
    department?: string;
    searchQuery?: string;
    depthUp: number;
    depthDown: number;
  }>({
    mode: 'my-view',
    depthUp: 2,
    depthDown: 2
  });
  
  // UI state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [showScenarioPanel, setShowScenarioPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuickSaveModal, setShowQuickSaveModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [userRole] = useState<'admin' | 'manager' | 'assistant'>('admin');
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>('org-chart-scenarios', []);

  /**
   * Load initial data based on view mode
   */
  const loadGraphData = useCallback(async () => {
    if (!isAuthenticated || useMockData) return;
    
    try {
      setIsLoadingData(true);
      setLoadingType('initial');
      setDataError(null);
      
      const accessToken = await getGraphToken();
      
      // Load user's context first (fast)
      const myContext = await retryApiCall(() => fetchMyOrgContext(accessToken));
      
      // Build context employees with standardized manager relationships
      const contextEmployees = buildOrgContextEmployees(
        myContext.currentUser,
        myContext.manager,
        myContext.grandManager,
        myContext.peers,
        myContext.directReports
      );
      
      // Set current user
      const currentUserEmployee = contextEmployees.find(emp => emp.id === myContext.currentUser.id);
      if (currentUserEmployee) {
        setCurrentUser(currentUserEmployee);
      }
      
      // Remove duplicates
      const uniqueEmployees = Array.from(
        new Map(contextEmployees.map(emp => [emp.id, emp])).values()
      );
      
      setEmployeesWithSandbox(uniqueEmployees);
      setAllEmployees(uniqueEmployees); // Start with this subset, will expand later
      setDataSource('graph');
      
      // Start background loading of broader org data
      loadBackgroundOrgData(accessToken);
      
      DevHelper.logAuthState(status, user, azureConfig);
      console.log(`✅ Successfully loaded ${uniqueEmployees.length} employees in user context`);
      
    } catch (error) {
      console.error('Failed to load data from Microsoft Graph:', error);
      const errorMessage = getApiErrorMessage(error);
      setDataError(errorMessage);
      
      // If it's an auth error, don't fall back to mock data - user needs to re-authenticate
      if (!isAuthError(error)) {
        console.warn('Falling back to mock data due to API error');
        try {
          loadMockData();
        } catch (mockError) {
          console.error('Even mock data failed to load:', mockError);
          // Clear loading states even if mock data fails
        }
      }
    } finally {
      setIsLoadingData(false);
      setLoadingType(null);
    }
  }, [isAuthenticated, useMockData, getGraphToken, status, user, azureConfig]);

  /**
   * Load broader organization data in background
   */
  const loadBackgroundOrgData = useCallback(async (accessToken: string) => {
    if (backgroundDataLoaded || useMockData) return;
    
    try {
      setIsLoadingBackground(true);
      console.log('🔄 Loading broader organization data in background...');
      
      // Load departments first (fast)
      const depts = await fetchDepartments(accessToken);
      setDepartments(depts);
      console.log(`📁 Loaded ${depts.length} departments`);
      
      // Load broader user data (slower) - limit to reasonable size
      const allUsers = await fetchAllUsers(accessToken);
      const broadOrgEmployees = allUsers.map(transformGraphUserToEmployee);
      
      // Merge with existing context data, prioritizing context data for people we already have
      const currentEmployees = allEmployees; // Current context employees
      const currentEmployeeIds = new Set(currentEmployees.map(emp => emp.id));
      const newEmployees = broadOrgEmployees.filter(emp => !currentEmployeeIds.has(emp.id));
      
      const mergedEmployees = [...currentEmployees, ...newEmployees];
      setAllEmployees(mergedEmployees);
      setBackgroundDataLoaded(true);
      
      console.log(`✅ Background loading complete: ${mergedEmployees.length} total employees`);
      
    } catch (error) {
      console.warn('Background org data loading failed:', error);
      // Don't show this error to user - it's background loading
      // But ensure we don't leave backgroundDataLoaded in wrong state
      setBackgroundDataLoaded(false);
    } finally {
      setIsLoadingBackground(false);
    }
  }, [backgroundDataLoaded, useMockData, allEmployees]);

  /**
   * Apply sandbox changes to a list of employees
   */
  const applySandboxChanges = useCallback((baseEmployees: Employee[]): Employee[] => {
    if (!isSandboxMode || sandboxChanges.size === 0) {
      return baseEmployees;
    }
    
    return baseEmployees.map(emp => {
      const changedEmp = sandboxChanges.get(emp.id);
      return changedEmp || emp;
    });
  }, [isSandboxMode, sandboxChanges]);

  /**
   * Set base employees and apply any sandbox changes
   */
  const setEmployeesWithSandbox = useCallback((newBaseEmployees: Employee[]) => {
    setBaseEmployees(newBaseEmployees);
    const employeesWithChanges = applySandboxChanges(newBaseEmployees);
    setEmployees(employeesWithChanges);
  }, [applySandboxChanges]);

  /**
   * Load mock data
   */
  const loadMockData = useCallback(() => {
    setEmployeesWithSandbox(mockEmployees);
    setAllEmployees(mockEmployees);
    
    // Set first employee as current user for demo
    const demoUser = mockEmployees.find(e => !e.managerId) || mockEmployees[0];
    setCurrentUser(demoUser);
    
    // Extract departments from mock data
    const mockDepts = [...new Set(mockEmployees.map(e => e.department))].sort();
    setDepartments(mockDepts);
    
    setDataSource('mock');
    setDataError(null);
    setUseMockData(true);
  }, [setEmployeesWithSandbox]);

  /**
   * Handle authentication and data loading
   */
  useEffect(() => {
    if (AuthStatusHelper.isAuthenticated(status) && hasValidConfig && !useMockData) {
      loadGraphData();
    } else if (useMockData || (!hasValidConfig && employees.length === 0)) {
      loadMockData();
    }
  }, [status, hasValidConfig, useMockData, loadGraphData, loadMockData, employees.length]);

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

  const handleUseMockData = () => {
    setUseMockData(true);
    loadMockData();
  };

  const handleConfigUpdate = async (config: AzureConfig) => {
    // Update AuthProvider configuration to trigger MSAL reinitialization
    await setAzureConfig(config);
    
    setUseMockData(false);
    setDataError(null);
  };

  const handleSwitchToMockData = () => {
    setUseMockData(true);
    loadMockData();
  };

  const handleResetConfig = async () => {
    clearConfig();
    // Clear authentication state
    await setAzureConfig(null);
    
    setEmployees([]);
    setUseMockData(false);
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
      try {
        loadMockData();
      } catch (error) {
        console.error('Retry with mock data failed:', error);
        setDataError('Failed to load even demo data. Please refresh the page.');
      }
    }
  };

  // Employee management handlers (unchanged from original)
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEmployeeUpdate = (updatedEmployee: Employee) => {
    if (!isSandboxMode) return;
    
    // Add to sandbox changes
    setSandboxChanges(prev => new Map(prev.set(updatedEmployee.id, updatedEmployee)));
    
    // Update current display
    setEmployees(prev => 
      prev.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp)
    );
    
    setHasUnsavedChanges(true);
  };

  const handleEmployeeReassign = (employeeId: string, newManagerId: string | null) => {
    if (!isSandboxMode) return;
    
    const currentEmployee = employees.find(emp => emp.id === employeeId);
    if (!currentEmployee) return;
    
    const updatedEmployee = { ...currentEmployee, managerId: newManagerId };
    
    // Add to sandbox changes
    setSandboxChanges(prev => new Map(prev.set(employeeId, updatedEmployee)));
    
    // Update current display
    setEmployees(prev =>
      prev.map(emp => emp.id === employeeId ? updatedEmployee : emp)
    );
    
    setHasUnsavedChanges(true);
  };

  const handleSaveScenario = (name: string, description: string) => {
    const newScenario: Scenario = {
      id: Date.now().toString(),
      name,
      description,
      createdAt: new Date(),
      createdBy: user?.name || 'Current User',
      employees: [...employees]
    };
    
    setScenarios(prev => [...prev, newScenario]);
    setCurrentScenario(newScenario);
    setHasUnsavedChanges(false); // Clear unsaved changes flag
  };

  const handleLoadScenario = (scenario: Scenario) => {
    setEmployees(scenario.employees);
    setCurrentScenario(scenario);
    setIsSandboxMode(true);
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
    // Clear sandbox changes and unsaved flag
    setSandboxChanges(new Map());
    setHasUnsavedChanges(false);
    
    // Reset to base data for current view, or reload if needed
    if (baseEmployees.length > 0) {
      setEmployees([...baseEmployees]);
    } else if (dataSource === 'graph' && isAuthenticated && !useMockData) {
      loadGraphData();
    } else {
      loadMockData();
    }
    
    setCurrentScenario(null);
    setIsSandboxMode(false);
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
  }, [hasUnsavedChanges, isSandboxMode]);

  const executeViewChange = useCallback(async (newConfig: typeof viewConfig) => {
    
    if (!isAuthenticated || useMockData) {
      // For mock data, just filter locally
      if (newConfig.mode === 'department' && newConfig.department) {
        const deptEmployees = allEmployees.filter(e => e.department === newConfig.department);
        setEmployeesWithSandbox(deptEmployees);
        // Update config to ensure centerPersonId is valid for this view
        const validCenterPerson = deptEmployees.find(e => e.id === newConfig.centerPersonId);
        const updatedConfig = validCenterPerson 
          ? newConfig 
          : { ...newConfig, centerPersonId: undefined };
        setViewConfig(updatedConfig);
      } else if (newConfig.mode === 'my-view' && currentUser) {
        // Show context around current user
        const contextIds = new Set<string>();
        contextIds.add(currentUser.id);
        
        // Add manager and peers
        if (currentUser.managerId) {
          const manager = allEmployees.find(e => e.id === currentUser.managerId);
          if (manager) {
            contextIds.add(manager.id);
            // Add peers
            allEmployees.filter(e => e.managerId === currentUser.managerId).forEach(e => contextIds.add(e.id));
          }
        }
        
        // Add direct reports
        allEmployees.filter(e => e.managerId === currentUser.id).forEach(e => contextIds.add(e.id));
        
        const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
        setEmployeesWithSandbox(contextEmployees);
        // Ensure centerPersonId matches current user for my-view
        const updatedConfig = { ...newConfig, centerPersonId: currentUser.id };
        setViewConfig(updatedConfig);
      } else if (newConfig.mode === 'search' && newConfig.centerPersonId) {
        // Show context around searched person
        const centerPerson = allEmployees.find(e => e.id === newConfig.centerPersonId);
        if (centerPerson) {
          const contextIds = new Set<string>();
          contextIds.add(centerPerson.id);
          
          // Add manager and peers
          if (centerPerson.managerId) {
            const manager = allEmployees.find(e => e.id === centerPerson.managerId);
            if (manager) {
              contextIds.add(manager.id);
              allEmployees.filter(e => e.managerId === centerPerson.managerId).forEach(e => contextIds.add(e.id));
            }
          }
          
          // Add direct reports
          allEmployees.filter(e => e.managerId === centerPerson.id).forEach(e => contextIds.add(e.id));
          
          const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
          setEmployeesWithSandbox(contextEmployees);
          // Config is already correct for search mode
          setViewConfig(newConfig);
        } else {
          // Center person not found, fall back to current user view
          console.warn(`Center person ${newConfig.centerPersonId} not found, falling back to my-view`);
          const fallbackConfig = { ...newConfig, mode: 'my-view' as ViewMode, centerPersonId: currentUser?.id };
          setViewConfig(fallbackConfig);
          if (currentUser) {
            // Reload context for current user
            const contextIds = new Set<string>();
            contextIds.add(currentUser.id);
            
            if (currentUser.managerId) {
              const manager = allEmployees.find(e => e.id === currentUser.managerId);
              if (manager) {
                contextIds.add(manager.id);
                allEmployees.filter(e => e.managerId === currentUser.managerId).forEach(e => contextIds.add(e.id));
              }
            }
            
            allEmployees.filter(e => e.managerId === currentUser.id).forEach(e => contextIds.add(e.id));
            const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
            setEmployeesWithSandbox(contextEmployees);
          }
        }
      } else {
        setViewConfig(newConfig);
      }
      return;
    }
    
    // For Graph API data, fetch targeted data
    try {
      setIsLoadingData(true);
      setDataError(null);
      const accessToken = await getGraphToken();
      
      if (newConfig.mode === 'department' && newConfig.department) {
        setLoadingType('department');
        
        // If we have background data loaded, use it (faster)
        if (backgroundDataLoaded && allEmployees.length > 0) {
          const deptEmployees = allEmployees.filter(emp => emp.department === newConfig.department);
          setEmployeesWithSandbox(deptEmployees);
          console.log(`📁 Using cached data for ${newConfig.department}: ${deptEmployees.length} employees`);
          
          // Update config to ensure centerPersonId is valid for this view
          const validCenterPerson = deptEmployees.find(e => e.id === newConfig.centerPersonId);
          const updatedConfig = validCenterPerson 
            ? newConfig 
            : { ...newConfig, centerPersonId: undefined };
          setViewConfig(updatedConfig);
        } else {
          // Fallback to API fetch
          const deptUsers = await fetchDepartmentUsers(accessToken, newConfig.department);
          const deptEmployees = deptUsers.map(transformGraphUserToEmployee);
          setEmployeesWithSandbox(deptEmployees);
          
          // Update config to ensure centerPersonId is valid for this view
          const validCenterPerson = deptEmployees.find(e => e.id === newConfig.centerPersonId);
          const updatedConfig = validCenterPerson 
            ? newConfig 
            : { ...newConfig, centerPersonId: undefined };
          setViewConfig(updatedConfig);
        }
        
      } else if (newConfig.mode === 'search' && newConfig.centerPersonId) {
        setLoadingType('user-context');
        try {
          // Fetch user context
          const userContext = await fetchUserOrgContext(accessToken, newConfig.centerPersonId);
          
          // Build context employees with standardized manager relationships
          const contextEmployees = buildOrgContextEmployees(
            userContext.user,
            userContext.manager,
            userContext.grandManager,
            userContext.peers,
            userContext.directReports
          );
          
          // Remove duplicates
          const uniqueEmployees = Array.from(
            new Map(contextEmployees.map(emp => [emp.id, emp])).values()
          );
          setEmployeesWithSandbox(uniqueEmployees);
          setViewConfig(newConfig);
        } catch (error) {
          console.warn(`Could not fetch context for user ${newConfig.centerPersonId}, falling back to my-view:`, error);
          // Clear the user-context loading state before fallback
          setLoadingType(null);
          setIsLoadingData(true);
          setLoadingType('initial');
          
          // Fall back to my-view if user not found or access denied
          const fallbackConfig = { ...newConfig, mode: 'my-view' as ViewMode, centerPersonId: currentUser?.id };
          setViewConfig(fallbackConfig);
          await loadGraphData();
        }
        
      } else if (newConfig.mode === 'my-view') {
        // Reload my context and ensure centerPersonId matches current user
        const updatedConfig = { ...newConfig, centerPersonId: currentUser?.id };
        setViewConfig(updatedConfig);
        await loadGraphData();
      }
      
    } catch (error) {
      console.error('Failed to load view data:', error);
      setDataError(getApiErrorMessage(error));
      
      // On error, fall back to previous view if available
      if (baseEmployees.length > 0) {
        console.log('Falling back to previous view data');
        setEmployeesWithSandbox(baseEmployees);
      }
    } finally {
      setIsLoadingData(false);
      setLoadingType(null);
    }
  }, [isAuthenticated, useMockData, getGraphToken, currentUser, allEmployees, loadGraphData]);

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
  
  /**
   * Handle search
   */
  const handleSearch = useCallback(async (query: string): Promise<Employee[]> => {
    const normalizedQuery = query.toLowerCase();
    
    // Always try local search first (includes both initial context and background data)
    const localResults = allEmployees.filter(emp =>
      emp.name.toLowerCase().includes(normalizedQuery) ||
      emp.title.toLowerCase().includes(normalizedQuery) ||
      emp.department.toLowerCase().includes(normalizedQuery)
    );
    
    // For mock data or when offline, only use local results
    if (!isAuthenticated || useMockData) {
      return localResults.slice(0, 20);
    }
    
    // If we have comprehensive local data (background loaded) and good results, use them
    if (backgroundDataLoaded && localResults.length >= 3) {
      console.log(`🔍 Using local search: ${localResults.length} results for "${query}"`);
      return localResults.slice(0, 20);
    }
    
    // If local results are sparse, try Graph API search for more comprehensive results
    try {
      console.log(`🔍 Using Graph API search for "${query}"`);
      const accessToken = await getGraphToken();
      const graphResults = await searchUsers(accessToken, query);
      const transformedResults = graphResults.map(user => transformGraphUserToEmployee(user));
      
      // Merge with local results, prioritizing exact matches from local data
      const combined = [...localResults, ...transformedResults];
      const unique = Array.from(
        new Map(combined.map(emp => [emp.id, emp])).values()
      );
      
      return unique.slice(0, 20);
    } catch (error) {
      console.warn('Graph API search failed, using local results:', error);
      return localResults.slice(0, 20);
    }
  }, [isAuthenticated, useMockData, allEmployees, backgroundDataLoaded, getGraphToken]);

  // Show loading state during authentication
  if (AuthStatusHelper.isLoading(status)) {
    return <AuthenticatingState />;
  }
  
  // Show data loading state
  if (isLoadingData) {
    switch (loadingType) {
      case 'initial':
        return <LoadingOrgData />;
      case 'department':
        return (
          <div className="min-h-screen bg-gray-50 pt-16">
            <LoadingDepartment departmentName={viewConfig.department} />
          </div>
        );
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        isSandboxMode={isSandboxMode}
        onToggleSandbox={setIsSandboxMode}
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
      
      {/* View Mode Selector */}
      <div className="mt-16">
        <ViewModeSelector
          currentUser={currentUser}
          employees={employees}
          departments={departments}
          viewConfig={viewConfig}
          onViewChange={handleViewChange}
          onSearch={handleSearch}
          isLoading={isLoadingData}
          isSandboxMode={isSandboxMode}
          onQuickSave={() => setShowQuickSaveModal(true)}
          isLoadingBackground={isLoadingBackground}
          backgroundDataLoaded={backgroundDataLoaded}
        />
      </div>
      
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

      {/* Development status indicator */}
      {DevHelper.isDevelopment() && (
        <div className="bg-gray-100 border-b px-6 py-2 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <div>
              Status: {status} | Data Source: {dataSource || 'none'} | 
              Users: {employees.length} | 
              {isAuthenticated ? `Authenticated as ${user?.name}` : 'Not authenticated'}
              {backgroundDataLoaded && ` | Full Org: ${allEmployees.length} employees`}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex h-screen pt-16">
        <SearchPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          employees={filteredEmployees}
          onEmployeeSelect={setSelectedEmployee}
        />
        
        <div className="flex-1">
          {employees.length === 0 && !dataError ? (
            <LoadingOrgChart />
          ) : (
            <OrgChart
              employees={employees}
              searchTerm={searchTerm}
              isSandboxMode={isSandboxMode}
              centerPersonId={viewConfig.centerPersonId}
              onEmployeeSelect={setSelectedEmployee}
              onEmployeeReassign={handleEmployeeReassign}
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
        />
      )}

      {showScenarioPanel && (
        <ScenarioPanel
          scenarios={scenarios}
          onClose={() => setShowScenarioPanel(false)}
          onSave={handleSaveScenario}
          onLoad={handleLoadScenario}
          onDelete={(id) => setScenarios(prev => prev.filter(s => s.id !== id))}
          isSandboxMode={isSandboxMode}
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
          message="You have unsaved changes in sandbox mode. Do you want to discard these changes and continue?"
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