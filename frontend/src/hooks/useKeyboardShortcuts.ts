import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  selectedEmployeeId?: string;
  isSandboxMode: boolean;
  onColorChange: (employeeId: string, color: string | undefined) => void;
}

const COLOR_SHORTCUTS = {
  '1': undefined, // Default/clear
  '2': 'blue',
  '3': 'green', 
  '4': 'purple',
  '5': 'orange',
  '6': 'pink',
  '7': 'yellow',
  '8': 'red',
  '9': 'indigo'
};

export function useKeyboardShortcuts({ 
  selectedEmployeeId, 
  isSandboxMode, 
  onColorChange 
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when:
      // 1. In sandbox mode
      // 2. An employee is selected (via modal or focus)
      // 3. Ctrl/Cmd is held down
      // 4. Not typing in an input field
      if (!isSandboxMode || 
          !selectedEmployeeId || 
          !(event.ctrlKey || event.metaKey) ||
          (event.target as HTMLElement)?.tagName === 'INPUT' ||
          (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      const color = COLOR_SHORTCUTS[event.key as keyof typeof COLOR_SHORTCUTS];
      if (color !== undefined) {
        event.preventDefault();
        onColorChange(selectedEmployeeId, color);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmployeeId, isSandboxMode, onColorChange]);
}

export { COLOR_SHORTCUTS };