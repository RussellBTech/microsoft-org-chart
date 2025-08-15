import { renderHook, act } from '@testing-library/react';
import { useOrgStore } from '../orgStore';
import { mockEmployees } from '../../data/mockData';

describe('OrgStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useOrgStore());
    act(() => {
      result.current.setEmployees([]);
      result.current.setAllEmployees([]);
      result.current.setCurrentUser(null);
    });
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useOrgStore());
    
    expect(result.current.employees).toEqual([]);
    expect(result.current.allEmployees).toEqual([]);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.isSandboxMode).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should load mock data correctly', () => {
    const { result } = renderHook(() => useOrgStore());
    
    act(() => {
      result.current.loadMockData();
    });

    expect(result.current.employees.length).toBeGreaterThan(0);
    expect(result.current.allEmployees.length).toBeGreaterThan(0);
    expect(result.current.currentUser).toBeTruthy();
    expect(result.current.dataSource).toBe('mock');
    expect(result.current.useMockData).toBe(true);
  });

  it('should toggle sandbox mode', () => {
    const { result } = renderHook(() => useOrgStore());
    
    expect(result.current.isSandboxMode).toBe(false);
    
    act(() => {
      result.current.toggleSandboxMode();
    });
    
    expect(result.current.isSandboxMode).toBe(true);
  });

  it('should update employee in sandbox mode', () => {
    const { result } = renderHook(() => useOrgStore());
    
    // Set up initial state
    act(() => {
      result.current.setEmployees([...mockEmployees]);
      result.current.setBaseEmployees([...mockEmployees]);
      result.current.toggleSandboxMode(); // Enable sandbox mode
    });

    const updatedEmployee = {
      ...mockEmployees[0],
      title: 'Updated Title'
    };

    act(() => {
      result.current.updateEmployee(updatedEmployee);
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.employees[0].title).toBe('Updated Title');
    expect(result.current.sandboxChanges.has(updatedEmployee.id)).toBe(true);
  });

  it('should save scenario', () => {
    const { result } = renderHook(() => useOrgStore());
    
    // Set up initial state
    act(() => {
      result.current.setEmployees([...mockEmployees]);
    });

    act(() => {
      result.current.saveScenario('Test Scenario', 'Test Description', 'Test User');
    });

    expect(result.current.scenarios.length).toBe(1);
    expect(result.current.scenarios[0].name).toBe('Test Scenario');
    expect(result.current.currentScenario).toBeTruthy();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should reset to live data', () => {
    const { result } = renderHook(() => useOrgStore());
    
    // Set up initial state with changes
    act(() => {
      result.current.setEmployees([...mockEmployees]);
      result.current.setBaseEmployees([...mockEmployees]);
      result.current.toggleSandboxMode();
      result.current.updateEmployee({
        ...mockEmployees[0],
        title: 'Changed Title'
      });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.isSandboxMode).toBe(true);

    act(() => {
      result.current.resetToLive();
    });

    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.isSandboxMode).toBe(false);
    expect(result.current.sandboxChanges.size).toBe(0);
    expect(result.current.reassignedEmployeeIds.size).toBe(0);
  });
});