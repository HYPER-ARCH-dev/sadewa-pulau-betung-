import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ViewType, ToastMessage } from '../types';

export interface UIContextType {
  currentView: ViewType;
  navigateTo: (view: ViewType, options?: { trackingCode?: string; newsId?: string; serviceId?: string }) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
  selectedNewsId: string | null;
  setSelectedNewsId: (id: string | null) => void;
  selectedServiceId: string | null;
  setSelectedServiceId: (id: string | null) => void;
  directTrackingCode: string | null;
  setDirectTrackingCode: (code: string | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  setFontSize: (size: 'normal' | 'large' | 'xlarge') => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('beranda');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [directTrackingCode, setDirectTrackingCode] = useState<string | null>(null);
  const [fontSize, setFontSizeState] = useState<'normal' | 'large' | 'xlarge'>(() => {
    try {
      const saved = localStorage.getItem('sadewa_font_size');
      if (saved === 'large' || saved === 'xlarge' || saved === 'normal') return saved;
      return 'normal';
    } catch (e) {
      return 'normal';
    }
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sadewa_dark_mode');
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sadewa_font_size', fontSize);
      if (fontSize === 'large') {
        document.documentElement.style.fontSize = '112.5%';
      } else if (fontSize === 'xlarge') {
        document.documentElement.style.fontSize = '125%';
      } else {
        document.documentElement.style.fontSize = '100%';
      }
    } catch (e) {}
  }, [fontSize]);

  const setFontSize = useCallback((size: 'normal' | 'large' | 'xlarge') => {
    setFontSizeState(size);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sadewa_dark_mode', JSON.stringify(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  const navigateTo = useCallback((view: ViewType, options?: { trackingCode?: string; newsId?: string; serviceId?: string }) => {
    setCurrentView(view);
    if (options?.newsId) setSelectedNewsId(options.newsId);
    if (options?.serviceId) setSelectedServiceId(options.serviceId);
    if (options?.trackingCode) setDirectTrackingCode(options.trackingCode);
    window.scrollTo(0, 0);
  }, []);

  const addToast = useCallback((type: ToastMessage['type'], title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <UIContext.Provider value={{
      currentView, 
      navigateTo, 
      isSearchOpen, 
      setIsSearchOpen, 
      toasts, 
      addToast, 
      removeToast,
      selectedNewsId, 
      setSelectedNewsId, 
      selectedServiceId, 
      setSelectedServiceId,
      directTrackingCode, 
      setDirectTrackingCode,
      darkMode,
      toggleDarkMode,
      fontSize,
      setFontSize
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
