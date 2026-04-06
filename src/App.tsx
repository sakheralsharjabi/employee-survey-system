import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { 
  Users, ClipboardList, BarChart3, LogOut, Plus, 
  LayoutDashboard, Menu, X, ChevronRight, UserPlus, 
  Settings, Building2, Bell, Search,
  CheckCircle2, Trash2, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from './lib/api';
import { cn } from './lib/utils';

// Import modular components
import SurveyBuilder from './components/Admin/SurveyBuilder';
import Reports from './components/Admin/Reports';
import SurveyRunner from './components/Employee/SurveyRunner';
import UserManagement from './components/Admin/UserManagement';

const RTLWrapper = ({ children }: { children: React.ReactNode }) => (
  <div dir="rtl" className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
    {children}
  </div>
);

const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onLogin();
      navigate(res.data.user.role === 'admin' ? '/admin' : '/employee');
    } catch (err) {
      setError('خطأ في اسم المستخدم أو كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-white">
        <div className="flex flex-col items-center mb-10">
          <div className="p-5 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-200">
            <ClipboardList className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">نظام الاستبيانات</h1>
          <p className="text-slate-400 font-medium">مرحباً بك مجدداً في منصتك</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 mr-2">اسم المستخدم</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all text-lg font-medium" placeholder="أدخل اسم المستخدم" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 mr-2">كلمة المرور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all text-lg font-medium" placeholder="••••••••" />
          </div>
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm text-center font-bold">{error}</motion.p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl text-xl shadow-2xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50">
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'الرئيسية' },
    { path: '/admin/surveys', icon: ClipboardList, label: 'الاستبيانات' },
    { path: '/admin/users', icon: Users, label: 'الموظفين' },
    { path: '/admin/reports', icon: BarChart3, label: 'التقارير' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-72 bg-white border-l border-slate-200 flex flex-col z-50 transition-transform duration-300 transform lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-100"><ClipboardList className="w-6 h-6 text-white" /></div>
            <span className="text-xl font-black tracking-tight">برو سيرفي</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>
        
        <nav className="flex-grow p-6 space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all group",
                location.pathname === item.path ? "bg-blue-600 text-white shadow-xl shadow-blue-100" : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "text-white" : "text-slate-400 group-hover:text-blue-600")} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-3xl mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black">{user.full_name?.[0]}</div>
            <div className="flex-grow overflow-hidden">
              <p className="text-sm font-black text-slate-900 truncate">{user.full_name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">مدير النظام</p>
            </div>
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="flex items-center gap-4 w-full px-5 py-4 rounded-2xl text-red-500 font-bold hover:bg-red-50 transition-all">
            <LogOut className="w-5 h-5" /><span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 md:px-10 sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-50 rounded-xl text-slate-600"><Menu className="w-6 h-6" /></button>
          <div className="hidden md:flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 w-96">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="ابحث عن استبيان أو موظف..." className="bg-transparent outline-none text-sm font-medium w-full" />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 relative transition-all">
              <Bell className="w-5 h-5" /><div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="w-10 h-10 bg-slate-900 rounded-2xl shadow-lg shadow-slate-200" />
          </div>
        </header>
        <main className="flex-grow">{children}</main>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [surveys, setSurveys] = useState<any[]>([]);
  useEffect(() => { api.get('/admin/surveys').then(res => setSurveys(res.data)); }, []);

  return (
    <div className="p-6 md:p-10 space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">الرئيسية</h1>
          <p className="text-slate-500 font-medium">أهلاً بك مجدداً، إليك آخر التحديثات</p>
        </div>
        <Link to="/admin/surveys/create" className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl shadow-blue-100 flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95">
          <Plus className="w-6 h-6" /> إنشاء استبيان جديد
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {surveys.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col group hover:shadow-2xl hover:shadow-slate-200/50 transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><ClipboardList className="w-6 h-6" /></div>
              <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest", s.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                {s.is_active ? 'نشط' : 'متوقف'}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">{s.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-grow line-clamp-3">{s.description}</p>
            <div className="flex gap-3 pt-6 border-t border-slate-50">
              <Link to={`/admin/reports/${s.id}`} className="flex-grow bg-slate-900 text-white text-center py-3.5 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4" /> عرض التقارير
              </Link>
              <button className="p-3.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
            </div>
          </motion.div>
        ))}
        {surveys.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200"><ClipboardList className="w-12 h-12" /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">لا توجد استبيانات بعد</h3>
            <p className="text-slate-400 mb-10">ابدأ بإنشاء أول استبيان لموظفيك الآن</p>
            <Link to="/admin/surveys/create" className="inline-flex items-center gap-3 bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-blue-100">
              <Plus className="w-6 h-6" /> أنشئ استبيانك الأول
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const EmployeeDashboard = () => {
  const [surveys, setSurveys] = useState<any[]>([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { api.get('/employee/surveys').then(res => setSurveys(res.data)); }, []);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-6 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-100"><ClipboardList className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-black tracking-tight">بوابة الموظف</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900">{user.full_name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">موظف</p>
            </div>
            <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all active:scale-90"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-[3rem] p-10 md:p-16 text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black leading-tight">أهلاً بك، {user.full_name?.split(' ')[0]} 👋</h2>
            <p className="text-slate-400 text-lg md:text-xl font-medium">لديك {surveys.length} استبيانات بانتظار مشاركتك القيمة</p>
          </div>
          <ClipboardList className="absolute -bottom-20 -left-20 w-80 h-80 text-white/5 rotate-12" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {surveys.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col group hover:shadow-2xl hover:shadow-slate-200/50 transition-all">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all mb-8"><ClipboardList className="w-8 h-8" /></div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-blue-600 transition-colors">{s.title}</h3>
              <p className="text-slate-500 text-lg leading-relaxed mb-10 flex-grow line-clamp-3">{s.description}</p>
              <Link to={`/survey/${s.id}`} className="w-full bg-blue-600 text-white text-center py-5 rounded-2xl font-black text-xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100">ابدأ الاستبيان</Link>
            </motion.div>
          ))}
          {surveys.length === 0 && (
            <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500"><CheckCircle2 className="w-12 h-12" /></div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">أنت على اطلاع دائم!</h3>
              <p className="text-slate-400">لا توجد استبيانات جديدة بانتظارك حالياً. شكراً لالتزامك.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'));
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <RTLWrapper>
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => setIsAuth(true)} />} />
          
          {/* Admin Routes */}
          <Route path="/admin/*" element={isAuth && user.role === 'admin' ? (
            <AdminLayout>
              <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/surveys" element={<AdminDashboard />} />
                <Route path="/surveys/create" element={<SurveyBuilder />} />
                <Route path="/surveys/edit/:id" element={<SurveyBuilder />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/:id" element={<Reports />} />
                <Route path="/users" element={<UserManagement />} />
              </Routes>
            </AdminLayout>
          ) : <Navigate to="/login" />} />

          {/* Employee Routes */}
          <Route path="/employee" element={isAuth ? <EmployeeDashboard /> : <Navigate to="/login" />} />
          <Route path="/survey/:id" element={isAuth ? <SurveyRunner /> : <Navigate to="/login" />} />

          <Route path="/" element={<Navigate to={isAuth ? (user.role === 'admin' ? '/admin' : '/employee') : '/login'} />} />
        </Routes>
      </Router>
    </RTLWrapper>
  );
}
