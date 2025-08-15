import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Replace the global localStorage with our mock
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('returns initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
    
    expect(result.current[0]).toBe('initial-value');
  });

  it('returns stored value from localStorage', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
    
    expect(result.current[0]).toBe('stored-value');
  });

  it('updates localStorage when value is set', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
    
    act(() => {
      result.current[1]('new-value');
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
    expect(result.current[0]).toBe('new-value');
  });

  it('handles function updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 5));
    
    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });
    
    expect(result.current[0]).toBe(6);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(6));
  });

  it('handles complex objects', () => {
    const complexObject = { name: 'John', age: 30, items: ['a', 'b', 'c'] };
    
    const { result } = renderHook(() => useLocalStorage('test-key', complexObject));
    
    const newObject = { ...complexObject, age: 31 };
    
    act(() => {
      result.current[1](newObject);
    });
    
    expect(result.current[0]).toEqual(newObject);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(newObject));
  });

  it('handles localStorage getItem errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback-value'));
    
    expect(result.current[0]).toBe('fallback-value');
    expect(consoleSpy).toHaveBeenCalledWith('Error reading localStorage key "test-key":', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('handles localStorage setItem errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
    
    act(() => {
      result.current[1]('new-value');
    });
    
    // State should still update even if localStorage fails (hook behavior)
    expect(result.current[0]).toBe('new-value');
    expect(consoleSpy).toHaveBeenCalledWith('Error setting localStorage key "test-key":', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('handles invalid JSON in localStorage', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json{');
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback-value'));
    
    expect(result.current[0]).toBe('fallback-value');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});