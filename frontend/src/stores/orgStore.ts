import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Employee, Scenario } from '../data/mockData';
import { ViewMode } from '../components/ViewModeSelector';
import { 
  fetchUserTeamRecursively,
  fetchUserOrgContext,
  buildTeamContextFromDirectReports,
  makeGraphRequest,
  searchUsers,
  transformGraphUserToEmployee,
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
  resetMockDataFlag: () => void;
  
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
        
        const wasInSandboxMode = isSandboxMode;
        set({ isSandboxMode: !isSandboxMode });
        
        // If we're exiting sandbox mode, trigger a context reload and clear changes
        if (wasInSandboxMode) {
          set({ 
            dataError: null,
            backgroundDataLoaded: false, // This will trigger a reload in App.tsx
            sandboxChanges: new Map(),
            reassignedEmployeeIds: new Set(),
            hasUnsavedChanges: false
          });
        }
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
      resetMockDataFlag: () => set({ useMockData: false, employees: [], allEmployees: [] }),
      
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
          
          console.log('🔄 Loading current user and their team hierarchy on-demand...');
          
          // Get current user info first
          const meQuery = '/me?$select=id,displayName,jobTitle,department,mail,userPrincipalName,employeeId,accountEnabled,employeeType,employeeHireDate,companyName,businessPhones,mobilePhone,officeLocation,streetAddress,city,state,postalCode,country,preferredLanguage';
          const currentUser = await retryApiCall(() => makeGraphRequest(meQuery, accessToken));
          
          // Fetch the current user's complete team hierarchy
          const userWithTeam = await retryApiCall(() => 
            fetchUserTeamRecursively(accessToken, currentUser.id)
          );
          
          if (!userWithTeam) {
            throw new Error('Unable to load user team data');
          }
          
          // Build flat employee list from the hierarchical data
          const teamEmployees = buildTeamContextFromDirectReports(userWithTeam);
          
          // Set current user
          const currentUserEmployee = teamEmployees.find(emp => emp.id === currentUser.id);
          
          console.log(`✅ On-demand team loaded: ${teamEmployees.length} employees in ${currentUser.displayName}'s hierarchy`);
          
          set({
            employees: teamEmployees,
            baseEmployees: teamEmployees,
            allEmployees: teamEmployees, // Start with current team, expand on search
            currentUser: currentUserEmployee || null,
            dataSource: 'graph',
            backgroundDataLoaded: true,
            useMockData: false // Reset mock data flag when Graph data loads successfully
          });
          
        } catch (error) {
          console.error('Failed to load team data:', error);
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
        const { allEmployees, useMockData } = get();
        const normalizedQuery = query.toLowerCase();
        
        if (!isAuthenticated || useMockData) {
          // Mock data search
          const localResults = allEmployees.filter(emp =>
            emp.name.toLowerCase().includes(normalizedQuery) ||
            emp.title.toLowerCase().includes(normalizedQuery)
          );
          return localResults.slice(0, 20);
        }
        
        try {
          console.log(`🔍 Direct Graph API search for "${query}"`);
          const accessToken = await getGraphToken();
          if (!accessToken) return [];
          
          // Search directly in Graph API - no dependency on allEmployees
          const graphResults = await searchUsers(accessToken, query);
          const transformedResults = graphResults.map(transformGraphUserToEmployee);
          
          console.log(`✅ Graph search found ${transformedResults.length} results`);
          return transformedResults.slice(0, 20);
        } catch (error) {
          console.warn('Graph API search failed:', error);
          return [];
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
          // Handle mock data view changes - update viewConfig immediately
          set({ viewConfig: newConfig });
          
          if (newConfig.mode === 'my-view' && currentUser) {
            const contextIds = new Set<string>();
            contextIds.add(currentUser.id);
            
            // Team-focused: show current user + ALL levels of their reports
            const addAllReports = (managerId: string) => {
              const directReports = allEmployees.filter(e => e.managerId === managerId);
              directReports.forEach(report => {
                contextIds.add(report.id);
                // Recursively add their reports (all levels)
                addAllReports(report.id);
              });
            };
            
            // Add all reports recursively
            addAllReports(currentUser.id);
            
            const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
            console.log(`🏠 My team view for ${currentUser.name}: ${contextEmployees.length} people (you + ${contextEmployees.length - 1} reports)`);
            
            set({
              employees: contextEmployees,
              baseEmployees: contextEmployees
            });
          } else if (newConfig.mode === 'search' && newConfig.centerPersonId) {
            const centerPerson = allEmployees.find(e => e.id === newConfig.centerPersonId);
            if (centerPerson) {
              console.log(`🔧 Mock team context for ${centerPerson.name}:`, {
                centerPersonId: centerPerson.id,
                allEmployeesCount: allEmployees.length,
                centerPersonManager: centerPerson.managerId || 'none'
              });
              
              const contextIds = new Set<string>();
              contextIds.add(centerPerson.id);
              
              // Team-focused downward context: person + ALL levels of their reports
              // Recursive function to add all reports at any depth
              const addAllReports = (managerId: string, depth: number = 0) => {
                const directReports = allEmployees.filter(e => e.managerId === managerId);
                console.log(`  ${'  '.repeat(depth)}Manager ${managerId} has ${directReports.length} reports`);
                directReports.forEach(report => {
                  contextIds.add(report.id);
                  console.log(`  ${'  '.repeat(depth + 1)}Adding ${report.name} (id: ${report.id})`);
                  // Recursively add their reports (all levels)
                  addAllReports(report.id, depth + 1);
                });
              };
              
              // Add all reports recursively (CEO can navigate down to any employee)
              addAllReports(centerPerson.id);
              
              const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
              console.log(`🎯 Team-focused view for ${centerPerson.name}: ${contextEmployees.length} people (person + ${contextEmployees.length - 1} reports)`, {
                employeeIds: contextEmployees.map(emp => ({ id: emp.id, name: emp.name, managerId: emp.managerId }))
              });
              
              set({
                employees: contextEmployees,
                baseEmployees: contextEmployees
              });
            }
          }
          return;
        }
        
        // Handle Graph API view changes
        try {
          set({ 
            isLoadingData: true, 
            loadingType: 'user-context', 
            dataError: null,
            viewConfig: newConfig // Update viewConfig immediately so loading shows correct user
          });
          
          const accessToken = await getGraphToken();
          if (!accessToken) throw new Error('No access token');
          
          if (newConfig.mode === 'search' && newConfig.centerPersonId) {
            try {
              console.log(`🔄 Context-aware loading for user: ${newConfig.centerPersonId}`);
              
              // Use new context-aware fetching that handles both managers and individual contributors
              const userContext = await fetchUserOrgContext(accessToken, newConfig.centerPersonId);
              
              if (!userContext) {
                throw new Error(`User ${newConfig.centerPersonId} not found or inactive`);
              }
              
              // Build flat employee list from the hierarchical data
              const contextEmployees = buildTeamContextFromDirectReports(userContext);
              
              console.log(`✅ Context-aware loaded: ${contextEmployees.length} employees for ${userContext.displayName}'s context`);
              
              set({
                employees: contextEmployees,
                baseEmployees: contextEmployees
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
        userRole: state.userRole
        // Note: useMockData is NOT persisted - should reset each session
      })
    }
  )
);