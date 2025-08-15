import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Employee, Scenario } from '../data/mockData';

interface EmployeeState {
  // Employee data
  allEmployees: Employee[];
  displayedEmployees: Employee[];
  baseEmployees: Employee[];
  currentUser: Employee | null;
  
  // Loading states
  isLoadingData: boolean;
  isLoadingBackground: boolean;
  backgroundDataLoaded: boolean;
  loadingType: 'initial' | 'search' | 'user-context' | null;
  dataError: string | null;
  dataSource: 'mock' | 'graph' | null;
  loadingProgress: {
    usersLoaded: number;
    totalUsers: number;
    currentStep: string;
  };
  
  // Sandbox mode
  sandboxChanges: Map<string, Employee>;
  reassignedEmployeeIds: Set<string>;
  hasUnsavedChanges: boolean;
  
  // View state
  viewConfig: {
    mode: 'my-view' | 'search' | 'full-org';
    centerPersonId?: string;
    searchQuery?: string;
  };
  
  // Actions
  setAllEmployees: (employees: Employee[]) => void;
  setDisplayedEmployees: (employees: Employee[]) => void;
  setBaseEmployees: (employees: Employee[]) => void;
  setCurrentUser: (user: Employee | null) => void;
  
  // Loading actions
  setIsLoadingData: (loading: boolean) => void;
  setIsLoadingBackground: (loading: boolean) => void;
  setBackgroundDataLoaded: (loaded: boolean) => void;
  setLoadingType: (type: 'initial' | 'search' | 'user-context' | null) => void;
  setDataError: (error: string | null) => void;
  setDataSource: (source: 'mock' | 'graph' | null) => void;
  setLoadingProgress: (progress: { usersLoaded: number; totalUsers: number; currentStep: string; }) => void;
  
  // Sandbox actions
  setSandboxChanges: (changes: Map<string, Employee>) => void;
  setReassignedEmployeeIds: (ids: Set<string>) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // View actions
  setViewConfig: (config: { mode: 'my-view' | 'search' | 'full-org'; centerPersonId?: string; searchQuery?: string; }) => void;
  
  // Computed getters
  getFullDataset: () => Employee[];
  
  // Complex actions
  applyChangesToEmployee: (employeeId: string, changes: Partial<Employee>) => void;
  clearSandboxChanges: () => void;
  resetToBaseEmployees: () => void;
}

export const useEmployeeStore = create<EmployeeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      allEmployees: [],
      displayedEmployees: [],
      baseEmployees: [],
      currentUser: null,
      
      isLoadingData: false,
      isLoadingBackground: false,
      backgroundDataLoaded: false,
      loadingType: null,
      dataError: null,
      dataSource: null,
      loadingProgress: {
        usersLoaded: 0,
        totalUsers: 0,
        currentStep: 'Initializing...'
      },
      
      sandboxChanges: new Map(),
      reassignedEmployeeIds: new Set(),
      hasUnsavedChanges: false,
      
      viewConfig: { mode: 'my-view' },
      
      // Basic setters with logging
      setAllEmployees: (employees) => {
        const timestamp = new Date().toISOString();
        console.group(`🔍 [${timestamp}] setAllEmployees called (Zustand)`);
        console.log('Previous allEmployees count:', get().allEmployees.length);
        console.log('New employees count:', employees.length);
        console.log('Stack trace:', new Error().stack?.split('\n').slice(0, 5));
        console.groupEnd();
        
        set({ allEmployees: employees }, false, 'setAllEmployees');
      },
      
      setDisplayedEmployees: (employees) => 
        set({ displayedEmployees: employees }, false, 'setDisplayedEmployees'),
      
      setBaseEmployees: (employees) => 
        set({ baseEmployees: employees }, false, 'setBaseEmployees'),
      
      setCurrentUser: (user) => 
        set({ currentUser: user }, false, 'setCurrentUser'),
      
      // Loading setters
      setIsLoadingData: (loading) => 
        set({ isLoadingData: loading }, false, 'setIsLoadingData'),
      
      setIsLoadingBackground: (loading) => 
        set({ isLoadingBackground: loading }, false, 'setIsLoadingBackground'),
      
      setBackgroundDataLoaded: (loaded) => 
        set({ backgroundDataLoaded: loaded }, false, 'setBackgroundDataLoaded'),
      
      setLoadingType: (type) => 
        set({ loadingType: type }, false, 'setLoadingType'),
      
      setDataError: (error) => 
        set({ dataError: error }, false, 'setDataError'),
      
      setDataSource: (source) => 
        set({ dataSource: source }, false, 'setDataSource'),
      
      setLoadingProgress: (progress) => 
        set({ loadingProgress: progress }, false, 'setLoadingProgress'),
      
      // Sandbox setters
      setSandboxChanges: (changes) => 
        set({ sandboxChanges: changes }, false, 'setSandboxChanges'),
      
      setReassignedEmployeeIds: (ids) => 
        set({ reassignedEmployeeIds: ids }, false, 'setReassignedEmployeeIds'),
      
      setHasUnsavedChanges: (hasChanges) => 
        set({ hasUnsavedChanges: hasChanges }, false, 'setHasUnsavedChanges'),
      
      // View setter
      setViewConfig: (config) => 
        set({ viewConfig: config }, false, 'setViewConfig'),
      
      // Computed getters - these always return the current state
      getFullDataset: () => {
        const { allEmployees, baseEmployees, displayedEmployees } = get();
        const dataset = allEmployees.length > 0 ? allEmployees : 
                       baseEmployees.length > 0 ? baseEmployees : displayedEmployees;
        
        console.log('🔍 getFullDataset called:');
        console.log('  - allEmployees.length:', allEmployees.length);
        console.log('  - baseEmployees.length:', baseEmployees.length);
        console.log('  - displayedEmployees.length:', displayedEmployees.length);
        console.log('  - Selected dataset.length:', dataset.length);
        
        return dataset;
      },
      
      // Complex actions
      applyChangesToEmployee: (employeeId, changes) => {
        const { sandboxChanges, displayedEmployees } = get();
        const employee = displayedEmployees.find(e => e.id === employeeId);
        if (employee) {
          const updatedEmployee = { ...employee, ...changes };
          const newChanges = new Map(sandboxChanges);
          newChanges.set(employeeId, updatedEmployee);
          
          set({ 
            sandboxChanges: newChanges,
            hasUnsavedChanges: true
          }, false, 'applyChangesToEmployee');
        }
      },
      
      clearSandboxChanges: () => {
        set({ 
          sandboxChanges: new Map(),
          reassignedEmployeeIds: new Set(),
          hasUnsavedChanges: false
        }, false, 'clearSandboxChanges');
      },
      
      resetToBaseEmployees: () => {
        const { baseEmployees } = get();
        set({ 
          displayedEmployees: baseEmployees,
          sandboxChanges: new Map(),
          reassignedEmployeeIds: new Set(),
          hasUnsavedChanges: false
        }, false, 'resetToBaseEmployees');
      }
    }),
    {
      name: 'employee-store', // This will show up in Redux DevTools
    }
  )
);