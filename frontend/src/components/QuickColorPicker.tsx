import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { getCardColorStyles } from './ColorPicker';

interface QuickColorPickerProps {
  currentColor?: string;
  onColorChange: (color: string | undefined) => void;
  disabled?: boolean;
}

const QUICK_COLORS = [
  { name: 'Default', value: undefined, bg: 'bg-white', border: 'border-gray-200' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-50', border: 'border-blue-300' },
  { name: 'Green', value: 'green', bg: 'bg-green-50', border: 'border-green-300' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-50', border: 'border-purple-300' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-50', border: 'border-orange-300' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-50', border: 'border-pink-300' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-300' },
  { name: 'Red', value: 'red', bg: 'bg-red-50', border: 'border-red-300' },
];

export function QuickColorPicker({ currentColor, onColorChange, disabled = false }: QuickColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (e: React.MouseEvent, color: string | undefined) => {
    e.stopPropagation(); // Prevent triggering parent events
    onColorChange(color);
    setIsOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering employee selection
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  if (disabled) {
    return null;
  }

  const handleContainerEvents = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent all mouse events from bubbling up
  };

  return (
    <div 
      className="relative"
      onClick={handleContainerEvents}
      onMouseDown={handleContainerEvents}
      onMouseUp={handleContainerEvents}
    >
      {/* Trigger button */}
      <button
        onClick={handleToggle}
        className={`
          w-6 h-6 rounded-full border-2 transition-all duration-200 shadow-sm
          ${currentColor ? getCardColorStyles(currentColor).border : 'border-gray-300'}
          ${currentColor ? getCardColorStyles(currentColor).background : 'bg-white'}
          hover:scale-110 hover:shadow-md
          flex items-center justify-center
          group
        `}
        title="Quick color change"
      >
        {currentColor ? (
          <div className="w-2 h-2 bg-gray-600 rounded-full opacity-60"></div>
        ) : (
          <Palette className="h-3 w-3 text-gray-500 opacity-60" />
        )}
      </button>

      {/* Color palette dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Color grid */}
          <div 
            className="absolute top-8 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[140px]"
            onClick={handleContainerEvents}
            onMouseDown={handleContainerEvents}
            onMouseUp={handleContainerEvents}
            onMouseEnter={handleContainerEvents}
            onMouseLeave={handleContainerEvents}
          >
            <div className="grid grid-cols-3 gap-2">
              {QUICK_COLORS.map((color) => (
                <button
                  key={color.value || 'default'}
                  onClick={(e) => handleColorSelect(e, color.value)}
                  className={`
                    w-8 h-8 rounded border-2 transition-all
                    ${color.bg} ${color.border}
                    ${currentColor === color.value ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    hover:scale-105 hover:shadow-md
                    relative
                  `}
                  title={color.name}
                >
                  {currentColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                  {color.value === undefined && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}