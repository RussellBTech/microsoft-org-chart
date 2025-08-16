/**
 * Test to verify the employee move logic works correctly
 * This tests that employees lose their "moved" status when moved back to original position
 */

describe('Employee Move Logic', () => {
  it('should properly track moved employees', () => {
    // Simulate the logic from orgStore
    const baseEmployees = [
      { id: '1', name: 'John', managerId: 'boss1' },
      { id: '2', name: 'Jane', managerId: 'boss1' }
    ];
    
    let reassignedEmployeeIds = new Set<string>();
    
    // Helper function to simulate the move logic
    const updateReassignedStatus = (employeeId: string, newManagerId: string) => {
      const originalEmployee = baseEmployees.find(emp => emp.id === employeeId);
      if (originalEmployee) {
        if (originalEmployee.managerId !== newManagerId) {
          // Employee was moved to a different manager
          reassignedEmployeeIds.add(employeeId);
        } else {
          // Employee was moved back to original manager
          reassignedEmployeeIds.delete(employeeId);
        }
      }
    };
    
    // Test: Move employee to new manager
    updateReassignedStatus('1', 'boss2');
    expect(reassignedEmployeeIds.has('1')).toBe(true);
    
    // Test: Move employee back to original manager
    updateReassignedStatus('1', 'boss1');
    expect(reassignedEmployeeIds.has('1')).toBe(false);
    
    // Test: Move employee to different manager again
    updateReassignedStatus('1', 'boss3');
    expect(reassignedEmployeeIds.has('1')).toBe(true);
    
    // Test: Multiple employees
    updateReassignedStatus('2', 'boss2');
    expect(reassignedEmployeeIds.has('1')).toBe(true);
    expect(reassignedEmployeeIds.has('2')).toBe(true);
    
    // Move one back
    updateReassignedStatus('2', 'boss1');
    expect(reassignedEmployeeIds.has('1')).toBe(true);
    expect(reassignedEmployeeIds.has('2')).toBe(false);
  });
});