import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OrgChart } from './components/OrgChart';
import { SearchPanel } from './components/SearchPanel';
import { ScenarioPanel } from './components/ScenarioPanel';
import { EmployeeModal } from './components/EmployeeModal';
import { ExportModal } from './components/ExportModal';
import { SetupWizard } from './components/SetupWizard';
import { mockEmployees, type Employee, type Scenario } from './data/mockData';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getStoredConfig, getConfigFromEnv, clearConfig } from './utils/azureConfig';
import { AzureConfig } from './types/azureConfig';

function App() {
  const [azureConfig, setAzureConfig] = useState<AzureConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [showScenarioPanel, setShowScenarioPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [userRole] = useState<'admin' | 'manager' | 'assistant'>('admin'); // Simulate user role
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>('org-chart-scenarios', []);

  // Check for Azure AD configuration on mount
  useEffect(() => {
    // First check environment variables
    const envConfig = getConfigFromEnv();
    if (envConfig) {
      setAzureConfig(envConfig);
      setIsConfigured(true);
      // TODO: In Phase 2, we'll authenticate with MSAL here
      // For now, use mock data when configured
      setEmployees(mockEmployees);
    } else {
      // Check localStorage
      const storedConfig = getStoredConfig();
      if (storedConfig) {
        setAzureConfig(storedConfig);
        setIsConfigured(true);
        // TODO: In Phase 2, we'll authenticate with MSAL here
        // For now, use mock data when configured
        setEmployees(mockEmployees);
      }
    }
  }, []);

  const handleConfigComplete = (config: AzureConfig) => {
    setAzureConfig(config);
    setIsConfigured(true);
    // TODO: In Phase 2, we'll authenticate with MSAL here
    // For now, use mock data when configured
    setEmployees(mockEmployees);
  };

  const handleUseMockData = () => {
    setUseMockData(true);
    setIsConfigured(true);
    setEmployees(mockEmployees);
  };

  const handleResetConfig = () => {
    clearConfig();
    setAzureConfig(null);
    setIsConfigured(false);
    setUseMockData(false);
    setEmployees([]);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEmployeeUpdate = (updatedEmployee: Employee) => {
    if (!isSandboxMode) return;
    
    setEmployees(prev => 
      prev.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp)
    );
  };

  const handleEmployeeReassign = (employeeId: string, newManagerId: string | null) => {
    if (!isSandboxMode) return;
    
    setEmployees(prev =>
      prev.map(emp => emp.id === employeeId ? { ...emp, managerId: newManagerId } : emp)
    );
  };

  const handleSaveScenario = (name: string, description: string) => {
    const newScenario: Scenario = {
      id: Date.now().toString(),
      name,
      description,
      createdAt: new Date(),
      createdBy: 'Current User',
      employees: [...employees]
    };
    
    setScenarios(prev => [...prev, newScenario]);
    setCurrentScenario(newScenario);
  };

  const handleLoadScenario = (scenario: Scenario) => {
    setEmployees(scenario.employees);
    setCurrentScenario(scenario);
    setIsSandboxMode(true);
  };

  const handleResetToLive = () => {
    // If using mock data or have Azure config, reset to appropriate data source
    if (useMockData || azureConfig) {
      setEmployees(mockEmployees); // TODO: In Phase 2, fetch from Graph API if configured
    }
    setCurrentScenario(null);
    setIsSandboxMode(false);
  };

  // Show setup wizard if not configured
  if (!isConfigured) {
    return (
      <SetupWizard 
        onComplete={handleConfigComplete}
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
        userRole={userRole}
        currentScenario={currentScenario}
      />
      
      <div className="flex h-screen pt-16">
        <SearchPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          employees={filteredEmployees}
          onEmployeeSelect={setSelectedEmployee}
        />
        
        <div className="flex-1">
          <OrgChart
            employees={employees}
            searchTerm={searchTerm}
            isSandboxMode={isSandboxMode}
            onEmployeeSelect={setSelectedEmployee}
            onEmployeeReassign={handleEmployeeReassign}
          />
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
    </div>
  );
}

export default App;