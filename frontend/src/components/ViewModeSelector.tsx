import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Building2, ChevronDown, Loader2, Save } from 'lucide-react';
import type { Employee } from '../data/mockData';

export type ViewMode = 'my-view' | 'department' | 'search';

interface ViewModeConfig {
  mode: ViewMode;
  centerPersonId?: string;
  department?: string;
  searchQuery?: string;
  depthUp: number;
  depthDown: number;
}

interface ViewModeSelectorProps {
  currentUser: Employee | null;
  employees: Employee[];
  departments: string[];
  viewConfig: ViewModeConfig;
  onViewChange: (config: ViewModeConfig) => void;
  onSearch: (query: string) => Promise<Employee[]>;
  isLoading?: boolean;
  isSandboxMode?: boolean;
  onQuickSave?: () => void;
  isLoadingBackground?: boolean;
  backgroundDataLoaded?: boolean;
}

export function ViewModeSelector({
  currentUser,
  employees,
  departments,
  viewConfig,
  onViewChange,
  onSearch,
  isLoading = false,
  isSandboxMode = false,
  onQuickSave,
  isLoadingBackground = false,
  backgroundDataLoaded = false
}: ViewModeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Get unique departments sorted alphabetically
  const sortedDepartments = [...new Set(departments)].sort();
  
  // Get department employee counts
  const departmentCounts = sortedDepartments.reduce((acc, dept) => {
    acc[dept] = employees.filter(e => e.department === dept).length;
    return acc;
  }, {} as Record<string, number>);

  const handleModeChange = (mode: ViewMode) => {
    if (mode === 'my-view' && currentUser) {
      onViewChange({
        ...viewConfig,
        mode,
        centerPersonId: currentUser.id,
        department: undefined,
        searchQuery: undefined
      });
    } else if (mode === viewConfig.mode) {
      // Mode is already active, do nothing
      return;
    } else {
      onViewChange({
        ...viewConfig,
        mode
      });
    }
  };

  const handleDepartmentSelect = (department: string) => {
    onViewChange({
      ...viewConfig,
      mode: 'department',
      department,
      centerPersonId: undefined,
      searchQuery: undefined
    });
    setShowDepartmentDropdown(false);
  };

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    // Set new timer for debounced search
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchDropdown(true);
      
      try {
        const results = await onSearch(query);
        setSearchResults(results.slice(0, 10)); // Limit to 10 results
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    setSearchDebounceTimer(timer);
  }, [onSearch, searchDebounceTimer]);

  const handleSearchSelect = (employee: Employee) => {
    onViewChange({
      ...viewConfig,
      mode: 'search',
      centerPersonId: employee.id,
      searchQuery: employee.name,
      department: undefined
    });
    setSearchQuery(employee.name);
    setShowSearchDropdown(false);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4">
        {/* My View Button */}
        <button
          onClick={() => handleModeChange('my-view')}
          disabled={!currentUser || isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewConfig.mode === 'my-view'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${(!currentUser || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <User className="w-4 h-4" />
          My View
        </button>

        {/* Department Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewConfig.mode === 'department'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Building2 className="w-4 h-4" />
            {viewConfig.mode === 'department' && viewConfig.department
              ? viewConfig.department
              : 'Department'}
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showDepartmentDropdown && !isLoading && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                  Select Department
                </div>
                {sortedDepartments.map(dept => (
                  <button
                    key={dept}
                    onClick={() => handleDepartmentSelect(dept)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="truncate">{dept}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {departmentCounts[dept] || 0} people
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search for anyone..."
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                  People
                </div>
                {searchResults.map(employee => (
                  <button
                    key={employee.id}
                    onClick={() => handleSearchSelect(employee)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                  >
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-gray-500">
                      {employee.title} • {employee.department}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Switching view...</span>
          </div>
        )}
      </div>

      {/* View Info Bar */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
        <div>
          {viewConfig.mode === 'my-view' && currentUser && (
            <span>Showing your organizational context</span>
          )}
          {viewConfig.mode === 'department' && viewConfig.department && (
            <span>
              Viewing {viewConfig.department} department •{' '}
              {departmentCounts[viewConfig.department] || 0} employees
            </span>
          )}
          {viewConfig.mode === 'search' && viewConfig.searchQuery && (
            <span>Search results for "{viewConfig.searchQuery}"</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <span>
            Showing {employees.length} employees
            {isLoadingBackground && !backgroundDataLoaded && (
              <span className="ml-2 text-xs text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading full org...
              </span>
            )}
            {backgroundDataLoaded && (
              <span className="ml-2 text-xs text-green-600">
                • Full org loaded
              </span>
            )}
          </span>
          {isSandboxMode && onQuickSave && (
            <button
              onClick={onQuickSave}
              className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Save Changes
            </button>
          )}
          <button
            onClick={() => onViewChange({ ...viewConfig, depthDown: viewConfig.depthDown + 1 })}
            className="text-blue-600 hover:text-blue-700"
          >
            Expand one level ▼
          </button>
        </div>
      </div>
    </div>
  );
}