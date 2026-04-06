import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Edit2, Search, Upload, Download, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import * as XLSX from 'xlsx';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>({ departments: [], jobLevels: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    department_id: '',
    job_level_id: '',
    mobile: '',
    status: 'active'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, orgRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/org-data')
      ]);
      setUsers(usersRes.data);
      setOrgData(orgRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        full_name: user.full_name,
        department_id: user.department_id || '',
        job_level_id: user.job_level_id || '',
        mobile: user.mobile || '',
        status: user.status || 'active'
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        department_id: '',
        job_level_id: '',
        mobile: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, formData);
      } else {
        await api.post('/admin/users', formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'حدث خطأ ما');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchData();
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      try {
        await api.post('/admin/users/bulk', { users: data });
        alert('تم استيراد البيانات بنجاح');
        fetchData();
      } catch (err) {
        alert('فشل استيراد البيانات');
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.mobile?.includes(searchTerm)
  );

  if (loading) return <div className="p-10 text-center font-bold text-slate-400">جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-10 space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">إدارة الموظفين</h1>
          <p className="text-slate-500 font-medium">إضافة وتعديل بيانات الموظفين والتحكم في صلاحياتهم</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <label className="flex-grow md:flex-grow-0 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-all">
            <Upload className="w-5 h-5" /> استيراد (Excel)
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleBulkImport} />
          </label>
          <button onClick={() => handleOpenModal()} className="flex-grow md:flex-grow-0 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95">
            <UserPlus className="w-5 h-5" /> إضافة موظف
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم، اسم المستخدم، أو الجوال..." 
              className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
            <span>إجمالي الموظفين:</span>
            <span className="text-blue-600">{filteredUsers.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-xs font-black uppercase tracking-widest">
                <th className="px-6 py-4">الموظف</th>
                <th className="px-6 py-4">القسم / المستوى</th>
                <th className="px-6 py-4">الجوال</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">{u.full_name[0]}</div>
                      <div>
                        <p className="font-bold text-slate-900">{u.full_name}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">{u.department_name || 'بدون قسم'}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{u.job_level_name || 'بدون مستوى'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-medium text-slate-500">{u.mobile || '-'}</td>
                  <td className="px-6 py-5">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", 
                      u.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {u.status === 'active' ? 'نشط' : 'متوقف'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900">{editingUser ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الاسم الكامل</label>
                    <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">اسم المستخدم</label>
                    <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">كلمة المرور {editingUser && '(اتركها فارغة لعدم التغيير)'}</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم الجوال</label>
                    <input type="text" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">القسم</label>
                    <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">اختر القسم</option>
                      {orgData.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المستوى الوظيفي</label>
                    <select value={formData.job_level_id} onChange={e => setFormData({...formData, job_level_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">اختر المستوى</option>
                      {orgData.jobLevels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الحالة</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="active">نشط</option>
                      <option value="inactive">متوقف</option>
                    </select>
                  </div>
                </div>
                <div className="pt-6 flex gap-3">
                  <button type="submit" className="flex-grow bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">حفظ البيانات</button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl transition-all active:scale-95">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
