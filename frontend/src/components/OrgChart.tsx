import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EmployeeNode } from './EmployeeNode';
import { ZoomControls } from './ZoomControls';
import type { Employee } from '../data/mockData';

interface OrgChartProps {
  employees: Employee[];
  searchTerm: string;
  isSandboxMode: boolean;
  centerPersonId?: string;
  movedEmployeeIds: Set<string>;
  baseEmployees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  onEmployeeReassign: (employeeId: string, newManagerId: string | null) => void;
}

type DisplayMode = 'horizontal' | 'vertical' | 'collapsed';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

// Hook for measuring node positions and calculating dynamic line positions
function useMeasureNodes() {
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerNode = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      nodeRefs.current.set(id, element);
    } else {
      nodeRefs.current.delete(id);
    }
  }, []);

  const measureNodes = useCallback(() => {
    const newPositions = new Map<string, NodePosition>();
    
    nodeRefs.current.forEach((element, id) => {
      const rect = element.getBoundingClientRect();
      const containerRect = element.closest('.org-chart-container')?.getBoundingClientRect();
      
      if (containerRect) {
        const position: NodePosition = {
          id,
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
          centerX: (rect.left - containerRect.left) + rect.width / 2
        };
        newPositions.set(id, position);
      }
    });
    
    setNodePositions(newPositions);
  }, []);

  return {
    nodePositions,
    registerNode,
    measureNodes
  };
}

// Component for dynamic connection lines that adapt to actual node positions
function DynamicConnectionLines({ 
  parentId, 
  childIds, 
  nodePositions 
}: { 
  parentId: string; 
  childIds: string[]; 
  nodePositions: Map<string, NodePosition>; 
}) {
  if (childIds.length === 0) return null;

  const parentPos = nodePositions.get(parentId);
  const childPositions = childIds.map(id => nodePositions.get(id)).filter(Boolean) as NodePosition[];

  if (!parentPos || childPositions.length === 0) {
    return null;
  }

  if (childIds.length === 1) {
    // Single child - simple vertical line
    const childPos = childPositions[0];
    return (
      <>
        <div 
          className="absolute w-0.5 bg-gray-300 pointer-events-none"
          style={{
            left: parentPos.centerX - 1,
            top: parentPos.y + parentPos.height,
            height: childPos.y - (parentPos.y + parentPos.height)
          }}
        />
      </>
    );
  }

  // Multiple children - calculate dynamic horizontal span
  const leftmostChild = childPositions.reduce((min, pos) => 
    pos.centerX < min.centerX ? pos : min
  );
  const rightmostChild = childPositions.reduce((max, pos) => 
    pos.centerX > max.centerX ? pos : max
  );

  const horizontalLineY = parentPos.y + parentPos.height + 6; // 6px gap to align with mt-3
  const horizontalLineLeft = leftmostChild.centerX;
  const horizontalLineWidth = rightmostChild.centerX - leftmostChild.centerX;

  return (
    <>
      {/* Vertical line down from parent */}
      <div 
        className="absolute w-0.5 h-6 bg-gray-300 pointer-events-none"
        style={{
          left: parentPos.centerX - 1,
          top: parentPos.y + parentPos.height
        }}
      />
      
      {/* Horizontal spanning line */}
      <div 
        className="absolute h-0.5 bg-gray-300 pointer-events-none"
        style={{
          left: horizontalLineLeft,
          top: horizontalLineY,
          width: Math.max(horizontalLineWidth, 4) // Minimum 4px width
        }}
      />
      
      {/* Vertical lines down to each child */}
      {childPositions.map((childPos) => (
        <div
          key={childPos.id}
          className="absolute w-0.5 bg-gray-300 pointer-events-none"
          style={{
            left: childPos.centerX - 1,
            top: horizontalLineY,
            height: childPos.y - horizontalLineY
          }}
        />
      ))}
    </>
  );
}

export function OrgChart({
  employees,
  searchTerm,
  isSandboxMode,
  centerPersonId,
  movedEmployeeIds,
  baseEmployees,
  onEmployeeSelect,
  onEmployeeReassign
}: OrgChartProps) {
  console.log('🔍 OrgChart render:', {
    employeeCount: employees.length,
    centerPersonId,
    firstFewEmployees: employees.slice(0, 3).map(e => ({ id: e.id, name: e.name }))
  });
  const [zoom, setZoom] = useState(1);
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [nodeDisplayModes, setNodeDisplayModes] = useState<Map<string, DisplayMode>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use the measurement hook for dynamic positioning
  const { nodePositions, registerNode, measureNodes } = useMeasureNodes();

  // Trigger measurement after layout changes
  useEffect(() => {
    const timeoutId = setTimeout(measureNodes, 100);
    return () => clearTimeout(timeoutId);
  }, [measureNodes, employees, nodeDisplayModes, searchTerm]);

  // Additional trigger for sandbox mode changes (employee reassignments)
  useEffect(() => {
    if (isSandboxMode) {
      const timeoutId = setTimeout(measureNodes, 150); // Slightly longer delay for DOM updates
      return () => clearTimeout(timeoutId);
    }
  }, [measureNodes, movedEmployeeIds, isSandboxMode]);

  // Handle window resize events that could affect node positioning
  useEffect(() => {
    const handleResize = () => {
      setTimeout(measureNodes, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureNodes]);

  // Trigger remeasurement after data reload (like when exiting sandbox mode)
  useEffect(() => {
    setTimeout(measureNodes, 200); // Longer delay for data reload
  }, [measureNodes, employees]);

  // Build hierarchy with improved data integrity for HR use
  const buildHierarchy = useCallback((employees: Employee[]) => {
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    const childrenMap = new Map<string, Employee[]>();
    const teamSizeMap = new Map<string, number>(); // Track total team size for each manager
    const rootEmployees: Employee[] = [];
    const orphanedEmployees: Employee[] = [];
    const dataQualityIssues: string[] = [];
    
    // Track all employees to ensure none are lost
    const processedEmployees = new Set<string>();

    // First, build the children map and identify data quality issues
    employees.forEach(emp => {
      if (emp.managerId) {
        if (employeeMap.has(emp.managerId)) {
          // Valid manager relationship
          const children = childrenMap.get(emp.managerId) || [];
          children.push(emp);
          childrenMap.set(emp.managerId, children);
        } else {
          // Invalid manager ID - this is an orphaned employee
          orphanedEmployees.push(emp);
          dataQualityIssues.push(`${emp.name} has invalid manager ID: ${emp.managerId}`);
        }
      }
    });

    // Calculate team sizes (recursive count of all reports)
    const calculateTeamSize = (managerId: string): number => {
      if (teamSizeMap.has(managerId)) {
        return teamSizeMap.get(managerId)!;
      }
      
      const directReports = childrenMap.get(managerId) || [];
      let totalSize = directReports.length;
      
      directReports.forEach(report => {
        totalSize += calculateTeamSize(report.id);
      });
      
      teamSizeMap.set(managerId, totalSize);
      return totalSize;
    };

    // Calculate team sizes for all managers
    childrenMap.forEach((_, managerId) => {
      calculateTeamSize(managerId);
    });

    // Find legitimate root employees (CEOs, top executives)
    employees.forEach(emp => {
      if (!emp.managerId) {
        rootEmployees.push(emp);
        processedEmployees.add(emp.id);
      }
    });

    // Detect circular references
    const detectCircularReferences = (empId: string, visited: Set<string> = new Set()): boolean => {
      if (visited.has(empId)) {
        return true; // Circular reference detected
      }
      
      const employee = employeeMap.get(empId);
      if (!employee || !employee.managerId) {
        return false;
      }
      
      visited.add(empId);
      return detectCircularReferences(employee.managerId, visited);
    };

    // Check for circular references and handle them
    employees.forEach(emp => {
      if (emp.managerId && detectCircularReferences(emp.id)) {
        orphanedEmployees.push(emp);
        dataQualityIssues.push(`${emp.name} is in a circular reporting structure`);
      }
    });

    // If no legitimate roots found, find potential roots (people who manage others but aren't managed)
    if (rootEmployees.length === 0 && employees.length > 0) {
      const managedEmployees = new Set<string>();
      employees.forEach(emp => {
        if (emp.managerId && employeeMap.has(emp.managerId)) {
          managedEmployees.add(emp.id);
        }
      });
      
      employees.forEach(emp => {
        if (!managedEmployees.has(emp.id) && childrenMap.has(emp.id)) {
          rootEmployees.push(emp);
          processedEmployees.add(emp.id);
        }
      });
      
      if (rootEmployees.length > 0) {
        dataQualityIssues.push('No clear CEO found - inferring top executives from reporting structure');
      }
    }

    // Ensure ALL employees are accounted for - more careful tracking
    const getProcessedInHierarchy = (empId: string, visited: Set<string> = new Set()): void => {
      if (visited.has(empId)) {
        // Detect potential circular references
        if (!processedEmployees.has(empId)) {
          const emp = employeeMap.get(empId);
          if (emp) {
            orphanedEmployees.push(emp);
            dataQualityIssues.push(`${emp.name} is in a circular reporting structure`);
          }
        }
        return;
      }
      
      visited.add(empId);
      processedEmployees.add(empId);
      
      const children = childrenMap.get(empId) || [];
      children.forEach(child => {
        getProcessedInHierarchy(child.id, new Set(visited)); // Create new visited set for each branch
      });
    };

    // Mark all reachable employees as processed
    rootEmployees.forEach(root => {
      getProcessedInHierarchy(root.id);
    });

    // Check if most employees are orphaned - this suggests a data structure issue
    const unprocessedEmployees = employees.filter(emp => !processedEmployees.has(emp.id));
    
    if (unprocessedEmployees.length > employees.length * 0.5) {
      // More than 50% of employees are "orphaned" - likely a data structure issue
      console.warn('⚠️ Large number of disconnected employees detected. This may indicate a data loading issue rather than true organizational problems.');
      
      // Try alternative approach: look for employees with valid manager IDs that exist
      unprocessedEmployees.forEach(emp => {
        if (emp.managerId && employeeMap.has(emp.managerId)) {
          // This employee has a valid manager, so they should be connected
          // Add them back to the hierarchy by treating their manager as processed
          const manager = employeeMap.get(emp.managerId)!;
          if (!processedEmployees.has(manager.id)) {
            // Manager wasn't processed either - add both
            processedEmployees.add(manager.id);
            processedEmployees.add(emp.id);
            
            // Add to children map
            const managerChildren = childrenMap.get(manager.id) || [];
            if (!managerChildren.find(c => c.id === emp.id)) {
              managerChildren.push(emp);
              childrenMap.set(manager.id, managerChildren);
            }
            
            // If manager has no manager, consider them a root
            if (!manager.managerId || !employeeMap.has(manager.managerId)) {
              if (!rootEmployees.find(r => r.id === manager.id)) {
                rootEmployees.push(manager);
              }
            }
          } else {
            // Manager is processed, just add this employee
            processedEmployees.add(emp.id);
            const managerChildren = childrenMap.get(emp.managerId) || [];
            if (!managerChildren.find(c => c.id === emp.id)) {
              managerChildren.push(emp);
              childrenMap.set(emp.managerId, managerChildren);
            }
          }
        } else {
          // Truly orphaned employee
          orphanedEmployees.push(emp);
          dataQualityIssues.push(`${emp.name} is disconnected from the organization hierarchy`);
        }
      });
    } else {
      // Normal case - just mark remaining as orphaned
      unprocessedEmployees.forEach(emp => {
        orphanedEmployees.push(emp);
        dataQualityIssues.push(`${emp.name} is disconnected from the organization hierarchy`);
      });
    }

    // Final safety check - if still no roots, create a temporary root structure
    if (rootEmployees.length === 0 && employees.length > 0) {
      // Group orphaned employees by department as a fallback
      const departmentGroups = new Map<string, Employee[]>();
      employees.forEach(emp => {
        const dept = emp.department || 'Unknown Department';
        const deptEmployees = departmentGroups.get(dept) || [];
        deptEmployees.push(emp);
        departmentGroups.set(dept, deptEmployees);
      });
      
      // Use the largest department's most senior person as a temporary root
      let largestDept = '';
      let largestSize = 0;
      departmentGroups.forEach((emps, dept) => {
        if (emps.length > largestSize) {
          largestSize = emps.length;
          largestDept = dept;
        }
      });
      
      if (largestDept) {
        const deptEmployees = departmentGroups.get(largestDept)!;
        // Use first employee as emergency root
        rootEmployees.push(deptEmployees[0]);
        dataQualityIssues.push('No organizational hierarchy found - using emergency fallback structure');
      }
    }

    console.log('📊 Hierarchy Analysis:', {
      totalEmployees: employees.length,
      rootEmployees: rootEmployees.length,
      orphanedEmployees: orphanedEmployees.length,
      dataQualityIssues: dataQualityIssues.length,
      managersWithTeams: teamSizeMap.size
    });

    if (dataQualityIssues.length > 0) {
      console.warn('⚠️ Data Quality Issues:', dataQualityIssues);
    }

    return { 
      rootEmployees, 
      childrenMap, 
      employeeMap, 
      teamSizeMap,
      orphanedEmployees,
      dataQualityIssues
    };
  }, []);

  const { 
    rootEmployees: defaultRoots, 
    childrenMap, 
    employeeMap,
    teamSizeMap,
    orphanedEmployees,
    dataQualityIssues
  } = buildHierarchy(employees);
  
  // Determine which employees to show as roots based on centerPersonId or view mode
  const rootEmployees = React.useMemo(() => {
    console.log(`🎯 Computing roots - centerPersonId: ${centerPersonId}, has employeeMap: ${employeeMap.size > 0}, defaultRoots: ${defaultRoots.length}`);
    
    // If we have a centerPersonId, focus on that person
    if (centerPersonId) {
      console.log(`Looking for centerPersonId ${centerPersonId} in map of ${employeeMap.size} employees`);
      
      if (!employeeMap.has(centerPersonId)) {
        console.warn(`⚠️ centerPersonId ${centerPersonId} not found in current employee dataset!`);
        console.log('Available IDs:', Array.from(employeeMap.keys()).slice(0, 5));
      } else {
        const centerPerson = employeeMap.get(centerPersonId);
        if (centerPerson) {
          // Check if their manager exists in the current dataset
          if (centerPerson.managerId && employeeMap.has(centerPerson.managerId)) {
            // Show from their manager down (provides context)
            const manager = employeeMap.get(centerPerson.managerId);
            console.log(`🎯 Centering on ${centerPerson.name} - showing from manager ${manager?.name}`);
            return manager ? [manager] : [centerPerson];
          } else {
            // No manager in dataset, show from this person down
            console.log(`🎯 Centering org chart on: ${centerPerson.name} (no manager in dataset)`);
            return [centerPerson];
          }
        }
      }
    }
    
    // For department view without specific center, show all people without managers in this dataset
    // This handles department-specific roots properly
    if (defaultRoots.length > 0) {
      console.log(`📊 No centerPersonId specified - showing ${defaultRoots.length} root(s) for current view`);
      console.log('Default roots:', defaultRoots.map(r => r.name));
      return defaultRoots;
    }
    
    // Fallback to showing all employees if no clear hierarchy
    console.log('⚠️ No clear roots found, showing first employee');
    return employees.length > 0 ? [employees[0]] : [];
  }, [centerPersonId, employeeMap, defaultRoots, employees]);

  const handleDragStart = (employee: Employee) => {
    if (!isSandboxMode) return;
    setDraggedEmployee(employee);
  };

  const handleDragEnd = () => {
    setDraggedEmployee(null);
    // Trigger line recalculation after drag ends
    setTimeout(measureNodes, 200);
  };

  const handleDrop = (targetEmployee: Employee) => {
    if (!draggedEmployee || !isSandboxMode || draggedEmployee.id === targetEmployee.id) return;
    
    // Prevent circular references
    let current = targetEmployee;
    while (current.managerId) {
      if (current.managerId === draggedEmployee.id) return;
      current = employees.find(emp => emp.id === current.managerId)!;
    }
    
    onEmployeeReassign(draggedEmployee.id, targetEmployee.id);
    setDraggedEmployee(null);
    
    // Trigger line recalculation after organizational change
    setTimeout(measureNodes, 250);
  };

  const toggleDisplayMode = (employeeId: string) => {
    setNodeDisplayModes(prev => {
      const newMap = new Map(prev);
      
      // Get current mode, considering the default based on level and children
      const employee = employeeMap.get(employeeId);
      if (!employee) return newMap;
      
      const children = childrenMap.get(employeeId) || [];
      const hasChildren = children.length > 0;
      if (!hasChildren) return newMap; // No point toggling if no children
      
      // Find the employee's level by traversing up the hierarchy
      let level = 0;
      let current = employee;
      while (current.managerId && employeeMap.has(current.managerId)) {
        level++;
        current = employeeMap.get(current.managerId)!;
      }
      
      const isDeepestLevel = level >= 2;
      const defaultMode: DisplayMode = (isDeepestLevel && hasChildren) ? 'vertical' : 'horizontal';
      
      const currentMode = newMap.get(employeeId) || defaultMode;
      
      // Cycle through: horizontal → vertical → collapsed → horizontal
      let nextMode: DisplayMode;
      switch (currentMode) {
        case 'horizontal':
          nextMode = 'vertical';
          break;
        case 'vertical':
          nextMode = 'collapsed';
          break;
        case 'collapsed':
          nextMode = 'horizontal';
          break;
        default:
          nextMode = 'horizontal';
      }
      
      newMap.set(employeeId, nextMode);
      
      // Trigger line recalculation after display mode change
      setTimeout(measureNodes, 100);
      
      return newMap;
    });
  };

  const renderEmployeeTree = (employee: Employee, level: number = 0): JSX.Element => {
    const children = childrenMap.get(employee.id) || [];
    const hasChildren = children.length > 0;
    
    // Get team metrics
    const directReportsCount = children.length;
    const totalTeamSize = teamSizeMap.get(employee.id) || 0;
    
    // Determine default display mode based on level
    const isDeepestLevel = level >= 2;
    const defaultMode: DisplayMode = (isDeepestLevel && hasChildren) ? 'vertical' : 'horizontal';
    
    // Get the actual display mode (use default if not set)
    const displayMode = nodeDisplayModes.get(employee.id) || defaultMode;
    const isCollapsed = displayMode === 'collapsed';
    
    const isHighlighted = searchTerm && (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const isCenterPerson = centerPersonId === employee.id;
    
    // Check if employee was moved in sandbox
    const wasMoved = movedEmployeeIds.has(employee.id);
    const originalEmployee = baseEmployees.find(e => e.id === employee.id);
    
    // Use the display mode to determine rendering
    const shouldRenderVertically = displayMode === 'vertical';

    return (
      <div key={employee.id} className="flex flex-col items-center">
        {/* Employee Node */}
        <div 
          className="relative"
          ref={(el) => registerNode(employee.id, el)}
        >
          <EmployeeNode
            employee={employee}
            level={level}
            hasChildren={hasChildren}
            displayMode={displayMode}
            isHighlighted={isHighlighted}
            isCenterPerson={isCenterPerson}
            wasMoved={wasMoved}
            originalManagerId={originalEmployee?.managerId}
            isDraggedOver={draggedEmployee?.id !== employee.id}
            directReportsCount={directReportsCount}
            totalTeamSize={totalTeamSize}
            onSelect={onEmployeeSelect}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onToggleDisplayMode={toggleDisplayMode}
            isSandboxMode={isSandboxMode}
          />
        </div>
        
        {/* Children and Dynamic Connection Lines */}
        {hasChildren && !isCollapsed && children.length > 0 && (
          <div className="flex flex-col items-center mt-3">
            {shouldRenderVertically ? (
              /* Vertical layout for deepest level */
              <div className="flex flex-col items-center gap-4">
                {children.map((child) => (
                  <div 
                    key={child.id} 
                    className="flex-shrink-0"
                    ref={(el) => registerNode(child.id, el)}
                  >
                    <EmployeeNode
                      employee={child}
                      level={level + 1}
                      hasChildren={false}
                      displayMode={'horizontal'}
                      isHighlighted={searchTerm && (
                        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        child.title.toLowerCase().includes(searchTerm.toLowerCase())
                      )}
                      isCenterPerson={centerPersonId === child.id}
                      wasMoved={movedEmployeeIds.has(child.id)}
                      originalManagerId={baseEmployees.find(e => e.id === child.id)?.managerId}
                      isDraggedOver={draggedEmployee?.id !== child.id}
                      directReportsCount={childrenMap.get(child.id)?.length || 0}
                      totalTeamSize={teamSizeMap.get(child.id) || 0}
                      onSelect={onEmployeeSelect}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                      onToggleDisplayMode={toggleDisplayMode}
                      isSandboxMode={isSandboxMode}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Horizontal layout for upper levels */
              <div className="flex items-start justify-center gap-6">
                {children.map(child => (
                  <div key={child.id} className="flex-shrink-0">
                    {renderEmployeeTree(child, level + 1)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full overflow-hidden bg-gray-50">
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(z + 0.1, 2))}
        onZoomOut={() => setZoom(z => Math.max(z - 0.1, 0.3))}
        onReset={() => {
          setZoom(1);
        }}
      />
      
      <div
        ref={containerRef}
        className="h-full overflow-auto p-6 org-chart-container"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {/* Dynamic Connection Lines Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from(childrenMap.entries()).map(([parentId, children]) => {
            if (children.length === 0) return null;
            const displayMode = nodeDisplayModes.get(parentId);
            if (displayMode === 'collapsed') return null;
            
            return (
              <DynamicConnectionLines
                key={parentId}
                parentId={parentId}
                childIds={children.map(c => c.id)}
                nodePositions={nodePositions}
              />
            );
          })}
        </div>
        
        <div className="flex flex-col items-center min-w-max relative">
          {/* Data Quality Indicators */}
          {dataQualityIssues.length > 0 && (
            <div className="mb-6 max-w-4xl">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 bg-amber-400 rounded-full"></div>
                  <h3 className="text-sm font-medium text-amber-800">Data Quality Issues Detected</h3>
                </div>
                <ul className="text-xs text-amber-700 space-y-1">
                  {dataQualityIssues.slice(0, 5).map((issue, index) => (
                    <li key={index}>• {issue}</li>
                  ))}
                  {dataQualityIssues.length > 5 && (
                    <li className="text-amber-600">... and {dataQualityIssues.length - 5} more issues</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Main Organization Hierarchy */}
          {rootEmployees.length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-8">
              <p className="text-red-700 font-medium">Critical: No organizational hierarchy could be determined</p>
              <p className="text-red-600 text-sm mt-2">This requires immediate attention from HR data management.</p>
              <ul className="list-disc list-inside mt-2 text-sm text-red-600">
                <li>Check if manager relationships exist in source data</li>
                <li>Verify CEO/executive records are properly configured</li>
                <li>Review for circular reporting structures</li>
              </ul>
            </div>
          ) : rootEmployees.length > 1 ? (
            <div className="flex flex-wrap gap-8 justify-center">
              {rootEmployees.map(employee => (
                <div key={employee.id} className="flex flex-col items-center">
                  <div className="text-sm text-gray-500 mb-2">
                    {rootEmployees.length > 1 ? `Organization Tree (${employee.department || 'Unknown Dept'})` : 'Organization Tree'}
                  </div>
                  {renderEmployeeTree(employee)}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="text-lg font-medium text-gray-700 mb-3">Organization Hierarchy</div>
              {rootEmployees.map(employee => (
                <div key={employee.id}>{renderEmployeeTree(employee)}</div>
              ))}
            </div>
          )}

          {/* Orphaned Employees Section */}
          {orphanedEmployees.length > 0 && (
            <div className="mt-8 w-full max-w-6xl">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-4 h-4 bg-orange-400 rounded-full"></div>
                  <h2 className="text-lg font-medium text-orange-800">Employees Requiring Attention</h2>
                  <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                    {orphanedEmployees.length} employee{orphanedEmployees.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-orange-700 mb-4">
                  These employees have data quality issues that prevent them from appearing in the main organizational hierarchy.
                  They need immediate HR attention to fix reporting relationships.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orphanedEmployees.map(employee => (
                    <div key={employee.id} className="relative">
                      <EmployeeNode
                        employee={employee}
                        level={0}
                        hasChildren={false}
                        displayMode="horizontal"
                        isHighlighted={false}
                        isCenterPerson={false}
                        wasMoved={false}
                        isDraggedOver={true}
                        directReportsCount={0}
                        totalTeamSize={0}
                        onSelect={onEmployeeSelect}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        onToggleDisplayMode={toggleDisplayMode}
                        isSandboxMode={isSandboxMode}
                      />
                      {/* Add warning overlay */}
                      <div className="absolute top-2 left-2 bg-orange-500 text-white rounded-full p-1 shadow-md">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-orange-100 rounded border">
                  <h4 className="text-sm font-medium text-orange-800 mb-2">Recommended Actions:</h4>
                  <ul className="text-xs text-orange-700 space-y-1">
                    <li>• Verify manager relationships in source system (Active Directory, HRIS)</li>
                    <li>• Update employee records with correct reporting structure</li>
                    <li>• Consider if these are contractors, consultants, or special roles</li>
                    <li>• Contact employees' managers to confirm reporting relationships</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {employees.length > 5000 && (
        <div className="absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-700">
            Large dataset detected ({employees.length} employees). Performance may be affected.
          </p>
        </div>
      )}
    </div>
  );
}