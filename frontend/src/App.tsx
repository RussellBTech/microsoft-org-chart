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
  searchUsers,
  fetchUserOrgContext,
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
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [loadingType, setLoadingType] = useState<'initial' | 'search' | 'user-context' | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'graph' | null>(null);
  const [backgroundDataLoaded, setBackgroundDataLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // View mode state
  const [viewConfig, setViewConfig] = useState<{
    mode: ViewMode;
    centerPersonId?: string;
    searchQuery?: string;
  }>({
    mode: 'my-view'
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
      
      if (!accessToken) {
        throw new Error('Unable to acquire access token. Please sign in again.');
      }
      
      // Load user's context first (fast)
      const myContext = await retryApiCall(() => fetchMyOrgContext(accessToken));
      
      console.log('🔍 My View context fetched:', {
        userId: myContext.currentUser?.id,
        userName: myContext.currentUser?.displayName,
        directReportsCount: myContext.directReports?.length,
        peersCount: myContext.peers?.length,
        hasNestedReports: myContext.directReports?.some((r: any) => r.directReports?.length > 0),
        peerWithReports: myContext.peers?.find((p: any) => p.directReports?.length > 0)?.displayName
      });
      
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
      
      setEmployeesWithSandbox(uniqueEmployees, false); // Fresh initial load, don't preserve changes
      // Only set allEmployees if it's empty - preserve broader dataset if we have it
      if (allEmployees.length === 0) {
        setAllEmployees(uniqueEmployees); // Start with this subset, will expand later
      }
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
   * In sandbox mode, be more careful about preserving changes
   */
  const setEmployeesWithSandbox = useCallback((newBaseEmployees: Employee[], preserveChanges: boolean = true) => {
    if (isSandboxMode && preserveChanges && sandboxChanges.size > 0) {
      // In sandbox mode with changes, only apply sandbox changes to employees that exist in the new dataset
      const newEmployeeIds = new Set(newBaseEmployees.map(emp => emp.id));
      const applicableChanges = new Map();
      let preservedCount = 0;
      
      sandboxChanges.forEach((changedEmp, empId) => {
        if (newEmployeeIds.has(empId)) {
          applicableChanges.set(empId, changedEmp);
          preservedCount++;
        }
      });
      
      const mergedEmployees = newBaseEmployees.map(emp => {
        const existingChange = applicableChanges.get(emp.id);
        if (existingChange) {
          return {
            ...emp, // Fresh base data (manager relationships, etc.)
            ...existingChange, // But preserve sandbox changes (title, managerId edits)
            id: emp.id // Ensure ID stays consistent
          };
        }
        return emp;
      });
      
      setBaseEmployees(newBaseEmployees);
      setEmployees(mergedEmployees);
      if (preservedCount > 0) {
        console.log(`🔧 Preserved ${preservedCount} sandbox changes during view change (${sandboxChanges.size - preservedCount} not applicable to new view)`);
      }
    } else {
      // Normal operation - just apply current sandbox changes to new base
      setBaseEmployees(newBaseEmployees);
      const employeesWithChanges = applySandboxChanges(newBaseEmployees);
      setEmployees(employeesWithChanges);
    }
  }, [applySandboxChanges, isSandboxMode, sandboxChanges]);

  /**
   * Load mock data
   */
  const loadMockData = useCallback(() => {
    setEmployeesWithSandbox(mockEmployees, false); // Don't preserve changes when loading fresh mock data
    setAllEmployees(mockEmployees);
    
    // Set first employee as current user for demo
    const demoUser = mockEmployees.find(e => !e.managerId) || mockEmployees[0];
    setCurrentUser(demoUser);
    
    
    setDataSource('mock');
    setDataError(null);
    setUseMockData(true);
  }, [setEmployeesWithSandbox]);

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
    // Removed automatic mock data fallback - let user choose via setup wizard
  }, [status, hasValidConfig, useMockData]); // Remove loadGraphData and employees.length from deps to prevent loops

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
    emp.title.toLowerCase().includes(searchTerm.toLowerCase())
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
      // For mock data, just update config
      if (newConfig.mode === 'my-view' && currentUser) {
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
        console.log(`🔎 Search mode: Looking for person ${newConfig.centerPersonId} in ${allEmployees.length} employees`);
        const centerPerson = allEmployees.find(e => e.id === newConfig.centerPersonId);
        if (centerPerson) {
          console.log(`✅ Found ${centerPerson.name} for search view`);
          const contextIds = new Set<string>();
          contextIds.add(centerPerson.id);
          
          // Add manager and their manager (grandmanager)
          if (centerPerson.managerId) {
            const manager = allEmployees.find(e => e.id === centerPerson.managerId);
            if (manager) {
              contextIds.add(manager.id);
              
              // Add grandmanager
              if (manager.managerId) {
                const grandManager = allEmployees.find(e => e.id === manager.managerId);
                if (grandManager) {
                  contextIds.add(grandManager.id);
                }
              }
              
              // Add peers (people with same manager)
              allEmployees.filter(e => e.managerId === centerPerson.managerId).forEach(e => contextIds.add(e.id));
            }
          }
          
          // Add direct reports (2 levels deep for now)
          allEmployees.filter(e => e.managerId === centerPerson.id).forEach(report => {
            contextIds.add(report.id);
            // Add their direct reports
            allEmployees.filter(e => e.managerId === report.id).forEach(subReport => {
              contextIds.add(subReport.id);
            });
          });
          
          const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
          setEmployeesWithSandbox(contextEmployees);
          console.log(`🔍 Search context for ${centerPerson.name}: ${contextEmployees.length} employees`);
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
      
      if (newConfig.mode === 'search' && newConfig.centerPersonId) {
        setLoadingType('user-context');
        try {
          // Fetch user context
          const userContext = await fetchUserOrgContext(accessToken, newConfig.centerPersonId);
          
          console.log('🔍 Search context fetched:', {
            userId: userContext.user?.id,
            userName: userContext.user?.displayName,
            directReportsCount: userContext.directReports?.length,
            peersCount: userContext.peers?.length,
            hasNestedReports: userContext.directReports?.some((r: any) => r.directReports?.length > 0),
            peerWithReports: userContext.peers?.find((p: any) => p.directReports?.length > 0)?.displayName
          });
          
          // Build initial context employees with standardized manager relationships
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
          console.log(`📊 Search context: ${uniqueEmployees.length} employees with full depth`);
          
          setViewConfig(newConfig);
        } catch (error) {
          console.error(`❌ Could not fetch context for user ${newConfig.centerPersonId}:`, error);
          console.log('Error details:', {
            centerPersonId: newConfig.centerPersonId,
            error: error instanceof Error ? error.message : error
          });
          
          // Try to show the person from local data if available
          if (allEmployees.length > 0) {
            const localPerson = allEmployees.find(e => e.id === newConfig.centerPersonId);
            if (localPerson) {
              console.log(`📍 Using local data for ${localPerson.name}`);
              // Build context from local data
              const contextIds = new Set<string>();
              contextIds.add(localPerson.id);
              
              // Add their manager and peers
              if (localPerson.managerId) {
                const manager = allEmployees.find(e => e.id === localPerson.managerId);
                if (manager) {
                  contextIds.add(manager.id);
                  // Add peers
                  allEmployees.filter(e => e.managerId === localPerson.managerId).forEach(e => contextIds.add(e.id));
                }
              }
              
              // Add direct reports (2 levels deep)
              allEmployees.filter(e => e.managerId === localPerson.id).forEach(report => {
                contextIds.add(report.id);
                // Add their reports too
                allEmployees.filter(e => e.managerId === report.id).forEach(subReport => {
                  contextIds.add(subReport.id);
                });
              });
              
              const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
              setEmployeesWithSandbox(contextEmployees);
              setViewConfig(newConfig);
              console.log(`✅ Built local context for ${localPerson.name}: ${contextEmployees.length} employees`);
              return; // Don't fall back to my-view
            }
          }
          
          // Only fall back to my-view if we really can't find the person
          console.warn(`⚠️ Person ${newConfig.centerPersonId} not found anywhere, falling back to my-view`);
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
        
        // Only reload if we don't have data or if explicitly switching TO my-view
        if (employees.length === 0 || viewConfig.mode !== 'my-view') {
          await loadGraphData();
        }
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
  }, [isAuthenticated, useMockData, getGraphToken, currentUser, allEmployees, loadGraphData, viewConfig.mode, employees.length, setEmployeesWithSandbox, backgroundDataLoaded]);

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
      emp.title.toLowerCase().includes(normalizedQuery)
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
            onEmployeeSelect={setSelectedEmployee}
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
              movedEmployeeIds={new Set(sandboxChanges.keys())}
              baseEmployees={baseEmployees}
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