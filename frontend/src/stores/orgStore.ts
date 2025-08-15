import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Employee, Scenario } from '../data/mockData';
import { ViewMode } from '../components/ViewModeSelector';
import { 
  fetchAllUsers,
  fetchMyOrgContext,
  searchUsers,
  fetchUserOrgContext,
  transformGraphUserToEmployee,
  buildOrgContextEmployees,
  retryApiCall,
  getApiErrorMessage,
  isAuthError
} from '../auth';

export type DataSource = 'mock' | 'graph' | null;
export type LoadingType = 'initial' | 'search' | 'user-context' | null;

interface ViewConfig {
  mode: ViewMode;
  centerPersonId?: string;
  searchQuery?: string;
}

interface OrgState {
  // Employee data
  employees: Employee[];
  baseEmployees: Employee[];
  allEmployees: Employee[];
  currentUser: Employee | null;
  
  // Planning mode state (allows modifications to org structure)
  isSandboxMode: boolean; // Internal: tracks if user is in planning mode
  sandboxChanges: Map<string, Employee>; // Internal: tracks pending changes
  reassignedEmployeeIds: Set<string>;
  hasUnsavedChanges: boolean;
  
  // Scenarios
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  
  // View state
  viewConfig: ViewConfig;
  searchTerm: string;
  selectedEmployee: Employee | null;
  
  // Loading state
  isLoadingData: boolean;
  isLoadingBackground: boolean;
  loadingType: LoadingType;
  dataError: string | null;
  dataSource: DataSource;
  backgroundDataLoaded: boolean;
  
  // Settings
  useMockData: boolean;
  userRole: 'admin' | 'manager' | 'assistant';
  
  // Actions
  setEmployees: (employees: Employee[]) => void;
  setBaseEmployees: (employees: Employee[]) => void;
  setAllEmployees: (employees: Employee[]) => void;
  setCurrentUser: (user: Employee | null) => void;
  
  // Planning mode actions
  toggleSandboxMode: () => void; // Toggles between view-only and planning mode
  updateEmployee: (employee: Employee) => void;
  reassignEmployee: (employeeId: string, newManagerId: string | null) => void;
  resetToLive: () => void;
  
  // Scenario actions
  saveScenario: (name: string, description: string, createdBy: string) => void;
  loadScenario: (scenario: Scenario) => void;
  deleteScenario: (scenarioId: string) => void;
  
  // View actions
  setViewConfig: (config: ViewConfig) => void;
  setSearchTerm: (term: string) => void;
  setSelectedEmployee: (employee: Employee | null) => void;
  
  // Loading actions
  setLoadingState: (isLoading: boolean, type?: LoadingType) => void;
  setDataError: (error: string | null) => void;
  setDataSource: (source: DataSource) => void;
  
  // Data loading methods
  loadCompleteOrgData: (getGraphToken: () => Promise<string | null>, isAuthenticated: boolean) => Promise<void>;
  loadMockData: () => void;
  searchEmployees: (query: string, getGraphToken: () => Promise<string | null>, isAuthenticated: boolean) => Promise<Employee[]>;
  changeView: (newConfig: ViewConfig, getGraphToken: () => Promise<string | null>, isAuthenticated: boolean) => Promise<void>;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      // Initial state
      employees: [],
      baseEmployees: [],
      allEmployees: [],
      currentUser: null,
      
      isSandboxMode: false,
      sandboxChanges: new Map(),
      reassignedEmployeeIds: new Set(),
      hasUnsavedChanges: false,
      
      scenarios: [],
      currentScenario: null,
      
      viewConfig: { mode: 'my-view' },
      searchTerm: '',
      selectedEmployee: null,
      
      isLoadingData: false,
      isLoadingBackground: false,
      loadingType: null,
      dataError: null,
      dataSource: null,
      backgroundDataLoaded: false,
      
      useMockData: false,
      userRole: 'admin',
      
      // Basic setters
      setEmployees: (employees) => set({ employees }),
      setBaseEmployees: (employees) => set({ baseEmployees: employees }),
      setAllEmployees: (employees) => set({ allEmployees: employees }),
      setCurrentUser: (user) => set({ currentUser: user }),
      
      // Planning mode actions
      toggleSandboxMode: () => {
        const { isSandboxMode, hasUnsavedChanges } = get();
        if (isSandboxMode && hasUnsavedChanges) {
          // Should trigger confirmation dialog in UI
          return;
        }
        set({ isSandboxMode: !isSandboxMode });
      },
      
      updateEmployee: (updatedEmployee) => {
        const { isSandboxMode, baseEmployees, employees, sandboxChanges, reassignedEmployeeIds } = get();
        if (!isSandboxMode) return;
        
        const originalEmployee = baseEmployees.find(emp => emp.id === updatedEmployee.id);
        const newSandboxChanges = new Map(sandboxChanges);
        const newReassignedIds = new Set(reassignedEmployeeIds);
        
        // Check if manager changed
        if (originalEmployee && originalEmployee.managerId !== updatedEmployee.managerId) {
          newReassignedIds.add(updatedEmployee.id);
        }
        
        newSandboxChanges.set(updatedEmployee.id, updatedEmployee);
        
        const newEmployees = employees.map(emp => 
          emp.id === updatedEmployee.id ? updatedEmployee : emp
        );
        
        set({
          employees: newEmployees,
          sandboxChanges: newSandboxChanges,
          reassignedEmployeeIds: newReassignedIds,
          hasUnsavedChanges: true
        });
      },
      
      reassignEmployee: (employeeId, newManagerId) => {
        const { isSandboxMode, employees, sandboxChanges, reassignedEmployeeIds } = get();
        if (!isSandboxMode) return;
        
        const currentEmployee = employees.find(emp => emp.id === employeeId);
        if (!currentEmployee) return;
        
        const updatedEmployee = { ...currentEmployee, managerId: newManagerId };
        const newSandboxChanges = new Map(sandboxChanges);
        const newReassignedIds = new Set(reassignedEmployeeIds);
        
        newReassignedIds.add(employeeId);
        newSandboxChanges.set(employeeId, updatedEmployee);
        
        const newEmployees = employees.map(emp =>
          emp.id === employeeId ? updatedEmployee : emp
        );
        
        set({
          employees: newEmployees,
          sandboxChanges: newSandboxChanges,
          reassignedEmployeeIds: newReassignedIds,
          hasUnsavedChanges: true
        });
      },
      
      resetToLive: () => {
        const { baseEmployees } = get();
        set({
          employees: [...baseEmployees],
          sandboxChanges: new Map(),
          reassignedEmployeeIds: new Set(),
          hasUnsavedChanges: false,
          currentScenario: null,
          isSandboxMode: false
        });
      },
      
      // Scenario actions
      saveScenario: (name, description, createdBy) => {
        const { scenarios, employees } = get();
        const newScenario: Scenario = {
          id: Date.now().toString(),
          name,
          description,
          createdAt: new Date(),
          createdBy,
          employees: [...employees]
        };
        
        set({
          scenarios: [...scenarios, newScenario],
          currentScenario: newScenario,
          hasUnsavedChanges: false
        });
      },
      
      loadScenario: (scenario) => {
        set({
          employees: [...scenario.employees],
          currentScenario: scenario,
          isSandboxMode: true
        });
      },
      
      deleteScenario: (scenarioId) => {
        const { scenarios } = get();
        set({
          scenarios: scenarios.filter(s => s.id !== scenarioId)
        });
      },
      
      // View actions
      setViewConfig: (config) => set({ viewConfig: config }),
      setSearchTerm: (term) => set({ searchTerm: term }),
      setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),
      
      // Loading actions
      setLoadingState: (isLoading, type = null) => set({ 
        isLoadingData: isLoading, 
        loadingType: isLoading ? type : null 
      }),
      setDataError: (error) => set({ dataError: error }),
      setDataSource: (source) => set({ dataSource: source }),
      
      // Data loading methods
      loadCompleteOrgData: async (getGraphToken, isAuthenticated) => {
        const { useMockData } = get();
        
        if (!isAuthenticated || useMockData) {
          get().loadMockData();
          return;
        }
        
        try {
          set({ isLoadingData: true, loadingType: 'initial', dataError: null });
          
          const accessToken = await getGraphToken();
          if (!accessToken) {
            throw new Error('Unable to acquire access token. Please sign in again.');
          }
          
          console.log('🔄 Loading complete organization data...');
          
          // Load complete org data instead of just user context
          const [myContext, allUsers] = await Promise.all([
            retryApiCall(() => fetchMyOrgContext(accessToken)),
            fetchAllUsers(accessToken)
          ]);
          
          console.log('📊 Complete org data loaded:', {
            userContextSize: myContext ? 1 : 0,
            totalUsers: allUsers.length
          });
          
          // Transform all users to employees
          const allEmployees = allUsers.map(transformGraphUserToEmployee);
          
          // Debug: Check manager relationships in transformed data
          const employeesWithManagers = allEmployees.filter(emp => emp.managerId);
          const employeesWithoutManagers = allEmployees.filter(emp => !emp.managerId);
          
          console.log('🔍 Manager relationship analysis after transformation:', {
            totalEmployees: allEmployees.length,
            withManagers: employeesWithManagers.length,
            withoutManagers: employeesWithoutManagers.length,
            sampleWithManager: employeesWithManagers.slice(0, 3).map(emp => ({
              name: emp.name,
              managerId: emp.managerId
            })),
            sampleWithoutManager: employeesWithoutManagers.slice(0, 3).map(emp => ({
              name: emp.name,
              managerId: emp.managerId
            }))
          });
          
          // Debug: Check raw Graph data structure for first few users
          console.log('🔍 Raw Graph data sample:', {
            sampleUsers: allUsers.slice(0, 3).map(user => ({
              displayName: user.displayName,
              manager: user.manager,
              hasManagerProperty: 'manager' in user,
              managerType: typeof user.manager
            }))
          });
          
          // Build user context for initial view
          const contextEmployees = buildOrgContextEmployees(
            myContext.currentUser,
            myContext.manager,
            myContext.grandManager,
            myContext.peers,
            myContext.directReports
          );
          
          // Set current user
          const currentUserEmployee = allEmployees.find(emp => emp.id === myContext.currentUser.id);
          
          // Remove duplicates from context
          const uniqueContextEmployees = Array.from(
            new Map(contextEmployees.map(emp => [emp.id, emp])).values()
          );
          
          set({
            employees: uniqueContextEmployees,
            baseEmployees: uniqueContextEmployees,
            allEmployees,
            currentUser: currentUserEmployee || null,
            dataSource: 'graph',
            backgroundDataLoaded: true
          });
          
          console.log(`✅ Complete org loaded: ${allEmployees.length} total, ${uniqueContextEmployees.length} in initial view`);
          
        } catch (error) {
          console.error('Failed to load org data:', error);
          const errorMessage = getApiErrorMessage(error);
          set({ dataError: errorMessage });
          
          if (!isAuthError(error)) {
            console.warn('Falling back to mock data');
            get().loadMockData();
          }
        } finally {
          set({ isLoadingData: false, loadingType: null });
        }
      },
      
      loadMockData: () => {
        // Import mock data dynamically to avoid circular imports
        import('../data/mockData').then(({ mockEmployees }) => {
          const demoUser = mockEmployees.find(e => !e.managerId) || mockEmployees[0];
          
          set({
            employees: [...mockEmployees],
            baseEmployees: [...mockEmployees],
            allEmployees: [...mockEmployees],
            currentUser: demoUser,
            dataSource: 'mock',
            backgroundDataLoaded: true,
            dataError: null,
            useMockData: true
          });
        });
      },
      
      searchEmployees: async (query, getGraphToken, isAuthenticated) => {
        const { allEmployees, useMockData, backgroundDataLoaded } = get();
        const normalizedQuery = query.toLowerCase();
        
        // Local search
        const localResults = allEmployees.filter(emp =>
          emp.name.toLowerCase().includes(normalizedQuery) ||
          emp.title.toLowerCase().includes(normalizedQuery)
        );
        
        if (!isAuthenticated || useMockData) {
          return localResults.slice(0, 20);
        }
        
        if (backgroundDataLoaded && localResults.length >= 3) {
          console.log(`🔍 Using local search: ${localResults.length} results`);
          return localResults.slice(0, 20);
        }
        
        try {
          console.log(`🔍 Using Graph API search for "${query}"`);
          const accessToken = await getGraphToken();
          if (!accessToken) return localResults.slice(0, 20);
          
          const graphResults = await searchUsers(accessToken, query);
          const transformedResults = graphResults.map(transformGraphUserToEmployee);
          
          // Merge and deduplicate
          const combined = [...localResults, ...transformedResults];
          const unique = Array.from(
            new Map(combined.map(emp => [emp.id, emp])).values()
          );
          
          return unique.slice(0, 20);
        } catch (error) {
          console.warn('Graph API search failed, using local results:', error);
          return localResults.slice(0, 20);
        }
      },
      
      changeView: async (newConfig, getGraphToken, isAuthenticated) => {
        const { hasUnsavedChanges, isSandboxMode, useMockData, allEmployees, currentUser } = get();
        
        // Check for unsaved changes
        if (hasUnsavedChanges && isSandboxMode) {
          // Should trigger confirmation dialog in UI
          return;
        }
        
        if (!isAuthenticated || useMockData) {
          // Handle mock data view changes
          if (newConfig.mode === 'my-view' && currentUser) {
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
            
            set({
              employees: contextEmployees,
              baseEmployees: contextEmployees,
              viewConfig: { ...newConfig, centerPersonId: currentUser.id }
            });
          } else if (newConfig.mode === 'search' && newConfig.centerPersonId) {
            const centerPerson = allEmployees.find(e => e.id === newConfig.centerPersonId);
            if (centerPerson) {
              const contextIds = new Set<string>();
              contextIds.add(centerPerson.id);
              
              // Build context around center person
              if (centerPerson.managerId) {
                const manager = allEmployees.find(e => e.id === centerPerson.managerId);
                if (manager) {
                  contextIds.add(manager.id);
                  if (manager.managerId) {
                    const grandManager = allEmployees.find(e => e.id === manager.managerId);
                    if (grandManager) contextIds.add(grandManager.id);
                  }
                  allEmployees.filter(e => e.managerId === centerPerson.managerId).forEach(e => contextIds.add(e.id));
                }
              }
              
              // Add direct reports (2 levels)
              allEmployees.filter(e => e.managerId === centerPerson.id).forEach(report => {
                contextIds.add(report.id);
                allEmployees.filter(e => e.managerId === report.id).forEach(subReport => {
                  contextIds.add(subReport.id);
                });
              });
              
              const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
              set({
                employees: contextEmployees,
                baseEmployees: contextEmployees,
                viewConfig: newConfig
              });
            }
          } else {
            set({ viewConfig: newConfig });
          }
          return;
        }
        
        // Handle Graph API view changes
        try {
          set({ isLoadingData: true, loadingType: 'user-context', dataError: null });
          
          const accessToken = await getGraphToken();
          if (!accessToken) throw new Error('No access token');
          
          if (newConfig.mode === 'search' && newConfig.centerPersonId) {
            try {
              const userContext = await fetchUserOrgContext(accessToken, newConfig.centerPersonId);
              
              const contextEmployees = buildOrgContextEmployees(
                userContext.user,
                userContext.manager,
                userContext.grandManager,
                userContext.peers,
                userContext.directReports
              );
              
              const uniqueEmployees = Array.from(
                new Map(contextEmployees.map(emp => [emp.id, emp])).values()
              );
              
              set({
                employees: uniqueEmployees,
                baseEmployees: uniqueEmployees,
                viewConfig: newConfig
              });
            } catch (error) {
              console.error('Failed to fetch user context:', error);
              // Fallback to local data or my-view
              const fallbackConfig = { ...newConfig, mode: 'my-view' as ViewMode, centerPersonId: currentUser?.id };
              set({ viewConfig: fallbackConfig });
            }
          } else if (newConfig.mode === 'my-view') {
            const updatedConfig = { ...newConfig, centerPersonId: currentUser?.id };
            set({ viewConfig: updatedConfig });
            // Use existing context if available
          }
          
        } catch (error) {
          console.error('View change failed:', error);
          set({ dataError: getApiErrorMessage(error) });
        } finally {
          set({ isLoadingData: false, loadingType: null });
        }
      }
    }),
    {
      name: 'org-chart-storage',
      partialize: (state) => ({ 
        scenarios: state.scenarios,
        userRole: state.userRole,
        useMockData: state.useMockData
      })
    }
  )
);