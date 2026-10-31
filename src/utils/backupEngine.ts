export const createBackup = (onSuccess?: () => void) => {
  const backup: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('pulau_betung_')) {
      try {
        backup[key] = JSON.parse(localStorage.getItem(key) || '');
      } catch (e) {
        backup[key] = localStorage.getItem(key);
      }
    }
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sadewa_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (onSuccess) {
    onSuccess();
  }
};

export const restoreBackup = (file: File, callback: () => void, onError?: (msg: string) => void) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (typeof data !== 'object' || data === null) {
        throw new Error('Data snapshot tidak valid');
      }
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
      callback();
    } catch (e: unknown) {
      if (onError) {
        onError(e instanceof Error ? e.message : String(e) || 'Format file JSON tidak valid.');
      } else {
        alert('Gagal memulihkan data. Format file tidak valid.');
      }
    }
  };
  reader.onerror = () => {
    if (onError) {
      onError('Gagal membaca file.');
    } else {
      alert('Gagal membaca file.');
    }
  };
  reader.readAsText(file);
};

