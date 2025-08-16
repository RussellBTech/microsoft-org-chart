import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Employee, Scenario } from '../data/mockData';
import { ViewMode } from '../components/ViewModeSelector';
import { 
  fetchUserTeamRecursively,
  buildTeamContextFromDirectReports,
  makeGraphRequest,
  searchUsers,
  transformGraphUserToEmployee,
  retryApiCall,
  getApiErrorMessage,
  isAuthError
} from '../auth';
import { USER_SELECT_FIELDS } from '../auth/authUtils';

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
  
  // Context cache for on-demand loading
  contextCache: Map<string, Employee[]>;
  
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
  
  // On-demand context loading
  getContextForUser: (userId: string, getGraphToken: () => Promise<string | null>, isAuthenticated: boolean) => Promise<Employee[]>;
  
  // Get manager info for employee details
  getManagerForUser: (userId: string, getGraphToken: () => Promise<string | null>, isAuthenticated: boolean) => Promise<Employee | null>;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      // Initial state
      employees: [],
      baseEmployees: [],
      allEmployees: [],
      currentUser: null,
      contextCache: new Map(),
      
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
          
          // Fetch the current user's complete team hierarchy (user + all their reports)
          const userWithTeam = await retryApiCall(() => 
            fetchUserTeamRecursively(accessToken, currentUser.id)
          );
          
          if (!userWithTeam) {
            throw new Error('Unable to load user team data');
          }
          
          // Build flat employee list from the hierarchical data
          let teamEmployees = buildTeamContextFromDirectReports(userWithTeam);
          
          console.log(`✅ Team loaded: ${teamEmployees.length} employees in ${currentUser.displayName}'s hierarchy`);
          console.log('🔄 Loading manager info for all team members...');
          
          // Load manager info for all employees in the team hierarchy
          const employeesWithManagers = await Promise.all(
            teamEmployees.map(async (employee) => {
              try {
                // Try to get manager info for this employee
                const managerQuery = `/users/${employee.id}/manager?$select=${USER_SELECT_FIELDS}`;
                const manager = await makeGraphRequest(managerQuery, accessToken);
                
                if (manager && manager.accountEnabled !== false) {
                  const managerEmployee = transformGraphUserToEmployee(manager);
                  return {
                    ...employee,
                    managerInfo: managerEmployee // Store full manager info
                  };
                }
              } catch (error) {
                // Manager lookup failed - not a problem, just log it
                console.log(`No manager found for ${employee.name}:`, error);
              }
              
              return employee; // Return employee without manager info if not found
            })
          );
          
          teamEmployees = employeesWithManagers;
          
          // Set current user
          const currentUserEmployee = teamEmployees.find(emp => emp.id === currentUser.id);
          
          console.log(`✅ Complete team loaded with manager info: ${teamEmployees.length} employees`);
          
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
          
          // Populate manager info for each employee based on managerId
          const employeesWithManagerInfo = mockEmployees.map(employee => {
            if (employee.managerId) {
              const manager = mockEmployees.find(emp => emp.id === employee.managerId);
              if (manager) {
                return {
                  ...employee,
                  managerInfo: manager
                };
              }
            }
            return employee;
          });
          
          set({
            employees: [...employeesWithManagerInfo],
            baseEmployees: [...employeesWithManagerInfo],
            allEmployees: [...employeesWithManagerInfo],
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
              console.log(`🎯 Loading context for user: ${newConfig.centerPersonId}`);
              
              // Use our new on-demand context loading with manager retrieval
              const contextEmployees = await get().getContextForUser(
                newConfig.centerPersonId, 
                getGraphToken, 
                isAuthenticated
              );
              
              if (contextEmployees.length === 0) {
                throw new Error(`No context found for user ${newConfig.centerPersonId}`);
              }
              
              console.log(`✅ Loaded ${contextEmployees.length} employees for user context`);
              
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
      },
      
      // On-demand context loading with manager retrieval
      getContextForUser: async (userId, getGraphToken, isAuthenticated) => {
        const { contextCache, allEmployees, useMockData } = get();
        
        // Check cache first
        if (contextCache.has(userId)) {
          console.log(`📋 Using cached context for user ${userId}`);
          return contextCache.get(userId)!;
        }
        
        if (!isAuthenticated || useMockData) {
          // Mock data fallback - use existing allEmployees (already has manager info)
          const user = allEmployees.find(e => e.id === userId);
          if (user) {
            const contextIds = new Set<string>();
            contextIds.add(user.id);
            
            // Add all their reports recursively
            const addAllReports = (managerId: string) => {
              const directReports = allEmployees.filter(e => e.managerId === managerId);
              directReports.forEach(report => {
                contextIds.add(report.id);
                addAllReports(report.id);
              });
            };
            
            addAllReports(user.id);
            const contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
            
            // Cache the result (mock data already has manager info populated)
            contextCache.set(userId, contextEmployees);
            set({ contextCache: new Map(contextCache) });
            
            return contextEmployees;
          }
          return [];
        }
        
        try {
          console.log(`🔄 Loading on-demand context for user: ${userId}`);
          const accessToken = await getGraphToken();
          if (!accessToken) throw new Error('No access token');
          
          // Check if user exists in our current employee cache first
          const cachedUser = allEmployees.find(e => e.id === userId);
          if (cachedUser) {
            console.log(`👥 User ${userId} found in cache - building context from existing data`);
            
            // Build context from current cache (downward hierarchy we already have)
            const contextIds = new Set<string>();
            contextIds.add(userId);
            
            const addAllReports = (managerId: string) => {
              const directReports = allEmployees.filter(e => e.managerId === managerId);
              directReports.forEach(report => {
                contextIds.add(report.id);
                addAllReports(report.id);
              });
            };
            
            addAllReports(userId);
            let contextEmployees = allEmployees.filter(e => contextIds.has(e.id));
            
            // Load manager info for all employees in this context (if not already loaded)
            console.log('🔄 Loading manager info for context employees...');
            const employeesWithManagers = await Promise.all(
              contextEmployees.map(async (employee) => {
                // Skip if already has manager info
                if (employee.managerInfo) {
                  return employee;
                }
                
                try {
                  const managerQuery = `/users/${employee.id}/manager?$select=${USER_SELECT_FIELDS}`;
                  const manager = await makeGraphRequest(managerQuery, accessToken);
                  
                  if (manager && manager.accountEnabled !== false) {
                    const managerEmployee = transformGraphUserToEmployee(manager);
                    return {
                      ...employee,
                      managerInfo: managerEmployee
                    };
                  }
                } catch (error) {
                  console.log(`No manager found for ${employee.name}:`, error);
                }
                
                return employee;
              })
            );
            
            contextEmployees = employeesWithManagers;
            
            // Cache and return
            contextCache.set(userId, contextEmployees);
            set({ contextCache: new Map(contextCache) });
            
            return contextEmployees;
          }
          
          // User not in our cache - load THEIR team (user + all reports) as top-level
          let contextEmployees: Employee[] = [];
          
          try {
            console.log(`🔍 User ${userId} not in cache - loading their team as top-level`);
            
            // Always load the user's own team hierarchy (user + all their reports)
            // This makes them the top-level node in the org chart
            const userTeam = await fetchUserTeamRecursively(accessToken, userId);
            let teamEmployees = buildTeamContextFromDirectReports(userTeam);
            
            console.log(`✅ Loaded ${teamEmployees.length} employees from ${userId}'s team hierarchy`);
            console.log('🔄 Loading manager info for all team members...');
            
            // Load manager info for all employees in the team hierarchy
            const employeesWithManagers = await Promise.all(
              teamEmployees.map(async (employee) => {
                try {
                  const managerQuery = `/users/${employee.id}/manager?$select=${USER_SELECT_FIELDS}`;
                  const manager = await makeGraphRequest(managerQuery, accessToken);
                  
                  if (manager && manager.accountEnabled !== false) {
                    const managerEmployee = transformGraphUserToEmployee(manager);
                    return {
                      ...employee,
                      managerInfo: managerEmployee
                    };
                  }
                } catch (error) {
                  console.log(`No manager found for ${employee.name}:`, error);
                }
                
                return employee;
              })
            );
            
            contextEmployees = employeesWithManagers;
            console.log(`✅ Complete team loaded with manager info: ${contextEmployees.length} employees`);
          } catch (teamError) {
            console.log(`Could not load team for ${userId}:`, teamError);
            
            // Fallback: try to at least get the user themselves with manager info
            try {
              const userQuery = `/users/${userId}?$select=${USER_SELECT_FIELDS}`;
              const user = await makeGraphRequest(userQuery, accessToken);
              if (user && user.accountEnabled !== false) {
                let userEmployee = transformGraphUserToEmployee(user);
                
                // Try to get manager info for this user too
                try {
                  const managerQuery = `/users/${userId}/manager?$select=${USER_SELECT_FIELDS}`;
                  const manager = await makeGraphRequest(managerQuery, accessToken);
                  
                  if (manager && manager.accountEnabled !== false) {
                    const managerEmployee = transformGraphUserToEmployee(manager);
                    userEmployee = {
                      ...userEmployee,
                      managerInfo: managerEmployee
                    };
                  }
                } catch (managerError) {
                  console.log(`No manager found for ${user.displayName}:`, managerError);
                }
                
                contextEmployees = [userEmployee];
                console.log(`✅ Fallback: Loaded just the user ${user.displayName} with manager info`);
              }
            } catch (userError) {
              console.log(`Could not load user ${userId}:`, userError);
            }
          }
          
          // Cache the result for future use
          if (contextEmployees.length > 0) {
            contextCache.set(userId, contextEmployees);
            set({ contextCache: new Map(contextCache) });
          }
          
          return contextEmployees;
          
        } catch (error) {
          console.error(`Failed to load context for user ${userId}:`, error);
          return [];
        }
      },
      
      // Get manager info for employee details modal
      getManagerForUser: async (userId, getGraphToken, isAuthenticated) => {
        const { allEmployees, useMockData } = get();
        
        if (!isAuthenticated || useMockData) {
          // Mock data - find manager by managerId
          const user = allEmployees.find(e => e.id === userId);
          if (user?.managerId) {
            return allEmployees.find(e => e.id === user.managerId) || null;
          }
          return null;
        }
        
        try {
          console.log(`🔍 Fetching manager info for user: ${userId}`);
          const accessToken = await getGraphToken();
          if (!accessToken) return null;
          
          // Single manager API call
          const managerQuery = `/users/${userId}/manager?$select=${USER_SELECT_FIELDS}`;
          const manager = await makeGraphRequest(managerQuery, accessToken);
          
          if (manager && manager.accountEnabled !== false) {
            // Transform to our Employee format
            const managerEmployee = transformGraphUserToEmployee(manager);
            console.log(`✅ Found manager: ${managerEmployee.name}`);
            return managerEmployee;
          }
          
          console.log(`👑 User ${userId} has no manager (might be CEO)`);
          return null;
          
        } catch (error) {
          console.log(`Could not fetch manager for ${userId}:`, error);
          return null;
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