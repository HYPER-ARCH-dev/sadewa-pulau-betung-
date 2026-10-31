import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { UIProvider, useUI, UIContextType } from './UIContext';
import { DataProvider, useData, DataContextType } from './DataContext';
import { api } from '../services/api';
import { User, ComplaintStatus, BudgetYearData, NewsItem } from '../types';

export interface AppContextType extends UIContextType, DataContextType {
  loginAs: (user: User | null) => void;
  loginWithCredentials: (u: string, p: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  apbdesData: BudgetYearData;
  updateComplaintStatus: (id: string, status: ComplaintStatus, response: string, proofImg?: string, followUp?: string) => void;
  addNews: (item: Omit<NewsItem, 'id' | 'views'>) => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <UIProvider>
      <DataProvider>
        <AppContextWrapper>{children}</AppContextWrapper>
      </DataProvider>
    </UIProvider>
  );
};

const AppContextWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ui = useUI();
  const data = useData();

  const loginAs = useCallback((user: User | null) => {
    data.setCurrentUser(user);
    if (user) {
      data.logActivity('USER_LOGIN', 'Otentikasi', `Login sebagai ${user.roleTitle}`);
      ui.addToast('success', 'Akses Admin Berhasil', `Selamat datang, ${user.name}`);
      ui.navigateTo('admin_dashboard');
      data.reloadServerData();
    } else {
      api.logout();
      data.logActivity('USER_LOGOUT', 'Otentikasi', 'Logout');
      ui.addToast('info', 'Sesi Berakhir', 'Kembali ke Portal Publik.');
      ui.navigateTo('beranda');
    }
  }, [data, ui]);

  const loginWithCredentials = useCallback(async (u: string, p: string) => {
    const res = await api.login(u, p);
    if (res.success && res.user) {
      data.setCurrentUser(res.user);
      ui.addToast('success', 'Akses Admin Berhasil', `Selamat datang, ${res.user.name}`);
      ui.navigateTo('admin_dashboard');
      data.reloadServerData();
      return { success: true };
    }
    return { success: false, error: res.error || 'Login gagal.' };
  }, [data, ui]);

  const value = useMemo(() => ({
    ...ui,
    ...data,
    loginAs,
    loginWithCredentials,
    logout: () => loginAs(null),
    apbdesData: data.budget,
    updateComplaintStatus: (id: string, status: ComplaintStatus, response: string, proofImg?: string, followUp?: string) => data.respondToComplaint(id, status, response, proofImg, followUp),
    addNews: data.addNewsItem,
  }), [ui, data, loginAs, loginWithCredentials]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
