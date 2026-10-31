import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserCog,
  X,
  Key,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw
} from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  roleTitle: string;
  isActive: boolean;
  officialId?: string;
  permissions?: string[];
  lastLogin?: string;
  createdAt: string;
}

export const UserManager: React.FC = () => {
  const { addToast, currentUser, officials } = useApp();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | any>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [roleTitle, setRoleTitle] = useState('Operator Modul');
  const [isActive, setIsActive] = useState(true);
  const [officialId, setOfficialId] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['services', 'complaints']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password reset modal states
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const MODULE_OPTIONS = [
    { id: 'services', label: 'Buku Arsip & Surat' },
    { id: 'complaints', label: 'Aduan Warga' },
    { id: 'webgis', label: 'WebGIS & PBB/SPORADIK' },
    { id: 'posyandu', label: 'e-Posyandu & Stunting' },
    { id: 'apbdes', label: 'Transparansi APBDes & TPK' },
    { id: 'news', label: 'Warta & Pengumuman Desa' },
    { id: 'officials', label: 'Kelola Perangkat Desa' },
    { id: 'territories', label: 'Master Wilayah (RT/RW)' },
  ];

  const fetchUsers = async () => {
    setIsLoading(true);
    const res = await api.getUsers();
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      addToast('error', 'Gagal Memuat Data', res.error || 'Terjadi kesalahan saat mengambil daftar pengguna.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOfficialSelect = (id: string) => {
    setOfficialId(id);
    const selected = officials.find(o => o.id === id);
    if (selected) {
      if (!name) setName(selected.name);
      if (!username) setUsername(selected.name.toLowerCase().replace(/[^a-z0-9]/g, '.'));
    }
  };

  const togglePermission = (modId: string) => {
    if (permissions.includes(modId)) {
      setPermissions(permissions.filter(p => p !== modId));
    } else {
      setPermissions([...permissions, modId]);
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('operator');
    setRoleTitle('Operator Modul');
    setIsActive(true);
    setOfficialId('');
    setPermissions(['services', 'complaints']);
    setModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || '');
    setPassword('');
    setRole(user.role);
    setRoleTitle(user.roleTitle);
    setIsActive(user.isActive);
    setOfficialId(user.officialId || '');
    setPermissions(user.permissions || ['services', 'complaints']);
    setModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!name || !username || (!editingUser && !password)) {
      addToast('warning', 'Data Belum Lengkap', 'Nama, username, dan password wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const res = await api.updateUser(editingUser.id, { 
          name, 
          role, 
          roleTitle, 
          isActive,
          officialId,
          permissions: role === 'operator' ? permissions : [] 
        });
        if (res.success) {
          addToast('success', 'Berhasil Diperbarui', `Akun ${username} telah diperbarui.`);
          fetchUsers();
          setModalOpen(false);
        } else {
          addToast('error', 'Gagal Update', res.error || 'Terjadi kesalahan saat menyimpan.');
        }
      } else {
        const res = await api.createUser({ 
          name, 
          username, 
          email, 
          password, 
          role, 
          roleTitle,
          officialId,
          permissions: role === 'operator' ? permissions : []
        });
        if (res.success) {
          addToast('success', 'Pengguna Ditambahkan', `Akun baru ${username} berhasil dibuat.`);
          fetchUsers();
          setModalOpen(false);
        } else {
          addToast('error', 'Gagal Menambah', res.error || 'Terjadi kesalahan saat membuat akun.');
        }
      }
    } catch (err) {
      addToast('error', 'Server Error', 'Gagal menghubungi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (user.id === currentUser?.userId) {
      addToast('error', 'Tindakan Dilarang', 'Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!window.confirm(`Hapus akun ${user.username} (${user.name})? Tindakan ini permanen.`)) return;

    const res = await api.deleteUser(user.id);
    if (res.success) {
      addToast('success', 'Akun Dihapus', `Akun ${user.username} telah dihapus dari sistem.`);
      fetchUsers();
    } else {
      addToast('error', 'Gagal Hapus', res.error || 'Terjadi kesalahan.');
    }
  };

  const handleResetPassword = async () => {
    if (!targetResetUser || !newPassword || newPassword.length < 6) {
      addToast('warning', 'Password Lemah', 'Minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    const res = await api.changePassword(targetResetUser.id, newPassword);
    if (res.success) {
      addToast('success', 'Password Direset', `Password untuk ${targetResetUser.username} berhasil diperbarui.`);
      setResetModalOpen(false);
      setNewPassword('');
    } else {
      addToast('error', 'Gagal Reset', res.error || 'Terjadi kesalahan.');
    }
    setIsSubmitting(false);
  };

  const filteredUsers = users.filter(u => {
    const searchLower = searchQuery.toLowerCase();
    const matchesUser = u.name.toLowerCase().includes(searchLower) || 
                       u.username.toLowerCase().includes(searchLower) ||
                       u.roleTitle.toLowerCase().includes(searchLower);
    
    // Search by linked official name if exists
    let matchesOfficial = false;
    if (u.officialId) {
      const off = officials.find(o => o.id === u.officialId);
      if (off) {
        matchesOfficial = off.name.toLowerCase().includes(searchLower) || 
                          off.position.toLowerCase().includes(searchLower);
      }
    }
    
    return matchesUser || matchesOfficial;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Stats */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <UserCog className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Pengguna</h2>
            <p className="text-xs text-slate-500 font-medium">Otorisasi & Keamanan Akses Portal SADEWA</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari admin atau perangkat..."
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none w-56 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-700/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Admin</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama & Username</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Perangkat Desa Terkait</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Peran / Role</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4"><div className="h-10 bg-slate-100 rounded-xl w-full"></div></td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const linkedOfficial = officials.find(o => o.id === user.officialId);
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${user.role === 'super_admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{user.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {linkedOfficial ? (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 rounded-lg">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-800">{linkedOfficial.name}</div>
                              <div className="text-[9px] text-slate-500 font-medium">{linkedOfficial.position}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Tidak terhubung</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                            user.role === 'super_admin' ? 'bg-indigo-100 text-indigo-800' :
                            user.role === 'admin_desa' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {user.roleTitle}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.isActive ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Aktif</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Nonaktif</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setTargetResetUser(user); setResetModalOpen(true); }}
                            title="Reset Password"
                            className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(user)}
                            title="Edit User"
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.id === currentUser?.userId || (user.role === 'super_admin' && currentUser?.role !== 'super_admin')}
                            title="Hapus Akun"
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-xs text-slate-400 font-medium">Tidak ada data pengguna ditemukan.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD/EDIT USER */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{editingUser ? 'Edit Pengguna' : 'Tambah Admin Baru'}</h3>
                  <p className="text-[10px] text-slate-500">Kelola identitas dan hak akses sistem</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Hubungkan Perangkat Desa</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik nama perangkat untuk mencari..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] focus:ring-2 focus:ring-indigo-600 outline-none"
                    onChange={(e) => {
                      const term = e.target.value.toLowerCase();
                      const options = document.querySelectorAll('.official-option');
                      options.forEach((opt: any) => {
                        const text = opt.textContent.toLowerCase();
                        if (text.includes(term) || opt.value === "") {
                          opt.style.display = 'block';
                        } else {
                          opt.style.display = 'none';
                        }
                      });
                    }}
                  />
                </div>
                <select
                  value={officialId}
                  onChange={(e) => handleOfficialSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="" className="official-option">-- Pilih Aparatur Terdaftar --</option>
                  {officials.map(off => (
                    <option key={off.id} value={off.id} className="official-option">{off.name} ({off.position})</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-1 ml-1">* Hubungkan agar data operator tersinkron dengan profil perangkat.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nama Tampilan</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ahmad Subardjo"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Username</label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ahmad.desa"
                    disabled={!!editingUser}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none disabled:opacity-50" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Peran SADEWA</label>
                  <select 
                    value={role} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setRole(val);
                      if (val === 'super_admin') setRoleTitle('Administrator Utama');
                      else if (val === 'admin_desa') setRoleTitle('Admin Desa / Sekdes');
                      else if (val === 'editor') setRoleTitle('Editor Publikasi');
                      else setRoleTitle('Operator Pelayanan');
                    }}
                    disabled={editingUser?.role === 'super_admin' && currentUser?.role !== 'super_admin'}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    {currentUser?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                    <option value="admin_desa">Admin Desa</option>
                    <option value="operator">Operator</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kata Sandi Awal</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 outline-none" 
                  />
                </div>
              )}

              {role !== 'super_admin' && (
                <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">Penentuan Hak Akses Modul (RBAC)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MODULE_OPTIONS.map(mod => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => togglePermission(mod.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                          permissions.includes(mod.id)
                            ? 'bg-white border-indigo-200 text-indigo-700 shadow-sm'
                            : 'bg-slate-50 border-slate-100 text-slate-400 grayscale opacity-60'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                          permissions.includes(mod.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {permissions.includes(mod.id) && <CheckCircle2 className="w-2.5 h-2.5" />}
                        </div>
                        <span className="truncate">{mod.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 ml-1 italic leading-relaxed">
                    * Centang modul yang boleh diakses oleh akun ini.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 px-2 py-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  checked={isActive} 
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-indigo-700" 
                />
                <label htmlFor="isActive" className="text-xs font-bold text-indigo-900 cursor-pointer">Status Akun Aktif</label>
                <div className="ml-auto">
                  <ShieldCheck className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-300'}`} />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={isSubmitting}
                  className="flex-[2] py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-700/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingUser ? 'Simpan Perubahan' : 'Buat Pengguna'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetModalOpen && targetResetUser && (
        <div className="fixed inset-0 z-[110] overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setResetModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-700">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Reset Password</h3>
                <p className="text-[10px] text-slate-500">Akun: {targetResetUser.username}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                  Tindakan ini akan mengganti password akses untuk user <strong>{targetResetUser.name}</strong>. Pastikan Anda menginformasikan password baru ke pengguna terkait.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password Baru</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ketik password baru..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-600 outline-none" 
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setResetModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={isSubmitting || newPassword.length < 6}
                  className="flex-[2] py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>Update Password</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
