import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Loader2, Save, ArrowUp } from 'lucide-react';
import type { Employee } from '../data/mockData';

export type ViewMode = 'my-view' | 'search';

interface ViewModeConfig {
  mode: ViewMode;
  centerPersonId?: string;
  searchQuery?: string;
}

interface ViewModeSelectorProps {
  currentUser: Employee | null;
  employees: Employee[];
  allEmployees: Employee[]; // Full dataset for accurate counts
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
  allEmployees,
  viewConfig,
  onViewChange,
  onSearch,
  isLoading = false,
  isSandboxMode = false,
  onQuickSave,
  isLoadingBackground = false,
  backgroundDataLoaded = false
}: ViewModeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState(viewConfig.searchQuery || '');
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1); // For keyboard navigation

  const handleModeChange = (mode: ViewMode) => {
    if (mode === 'my-view' && currentUser) {
      onViewChange({
        ...viewConfig,
        mode,
        centerPersonId: currentUser.id,
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

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedIndex(-1); // Reset selection when typing
    
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
        setSelectedIndex(-1); // Reset selection for new results
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
      searchQuery: employee.name
    });
    setSearchQuery(employee.name);
    setShowSearchDropdown(false);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation in search dropdown
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || searchResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSearchSelect(searchResults[selectedIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setShowSearchDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Sync search query with view config
  useEffect(() => {
    if (viewConfig.mode === 'search' && viewConfig.searchQuery) {
      setSearchQuery(viewConfig.searchQuery);
    } else if (viewConfig.mode !== 'search') {
      setSearchQuery('');
    }
  }, [viewConfig.mode, viewConfig.searchQuery]);

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


        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
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
                  People (Use ↑↓ to navigate, Enter to select)
                </div>
                {searchResults.map((employee, index) => (
                  <button
                    key={employee.id}
                    onClick={() => handleSearchSelect(employee)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      index === selectedIndex 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-gray-500">
                      {employee.title}
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
          {viewConfig.mode === 'search' && viewConfig.searchQuery && (
            <span>Search results for "{viewConfig.searchQuery}"</span>
          )}
        </div>
        
        {/* Center: Move Up Link */}
        <div className="flex items-center">
          {(() => {
            // Find the person we're currently viewing
            const centerPerson = viewConfig.centerPersonId 
              ? employees.find(emp => emp.id === viewConfig.centerPersonId) || currentUser
              : currentUser;
            
            // Show "Move Up" if they have a manager
            if (centerPerson?.managerInfo) {
              return (
                <button
                  onClick={() => {
                    console.log('🔼 Move Up clicked!', {
                      managerId: centerPerson.managerInfo!.id,
                      managerName: centerPerson.managerInfo!.name,
                      fromPerson: centerPerson.name
                    });
                    onViewChange({
                      mode: 'search',
                      centerPersonId: centerPerson.managerInfo!.id,
                      searchQuery: centerPerson.managerInfo!.name
                    });
                  }}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  title={`Navigate to ${centerPerson.managerInfo.name}'s team context (if accessible)`}
                >
                  <ArrowUp className="w-4 h-4" />
                  Move up to {centerPerson.managerInfo.name}
                </button>
              );
            }
            return null;
          })()}
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
        </div>
      </div>
    </div>
  );
}