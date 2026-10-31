import { useState } from 'react';
import { api } from '../services/api';

export const useMasterReset = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);

  const performMasterReset = async () => {
    setIsResetting(true);
    setResetProgress(0);
    
    try {
      setResetProgress(20);
      
      // Memanggil API Admin untuk reset seluruh data di backend Express
      const serverReset = await api.resetDatabase();
      
      setResetProgress(80);
      
      if (!serverReset.success) {
        throw new Error(serverReset.error || 'Gagal reset database server.');
      }

      setResetProgress(100);
      return { success: true };
    } catch (error: any) {
      console.error('Master Reset Error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsResetting(false);
    }
  };

  return { performMasterReset, isResetting, resetProgress };
};
