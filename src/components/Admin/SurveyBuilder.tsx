import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Save, ChevronLeft, Settings, Users, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

const MultipleChoiceBuilder = ({ options, onChange }: { options: any[], onChange: (opts: any[]) => void }) => {
  const addOption = () => onChange([...options, { text: '', value: '' }]);
  const removeOption = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const updateOption = (idx: number, text: string) => {
    const newOpts = [...options];
    newOpts[idx] = { text, value: text };
    onChange(newOpts);
  };

  return (
    <div className="space-y-3 pl-4 border-r-2 border-slate-100 mt-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">خيارات الإجابة</p>
      {options.map((opt, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input 
            type="text" 
            value={opt.text} 
            onChange={(e) => updateOption(idx, e.target.value)}
            className="flex-grow text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`الخيار ${idx + 1}`}
          />
          <button onClick={() => removeOption(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={addOption} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
        <Plus className="w-3 h-3" /> إضافة خيار
      </button>
    </div>
  );
};

const RatingBuilder = ({ options, onChange }: { options: any, onChange: (opts: any) => void }) => {
  const max = options.max || 5;
  return (
    <div className="mt-4 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <label className="text-sm font-bold text-slate-600">أقصى تقييم:</label>
      <select 
        value={max} 
        onChange={(e) => onChange({ max: parseInt(e.target.value) })}
        className="bg-white border border-slate-200 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={5}>5 نجوم</option>
        <option value={10}>10 نجوم</option>
      </select>
    </div>
  );
};

export default function SurveyBuilder() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>({ departments: [], jobLevels: [] });
  const [assignments, setAssignments] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/org-data').then(res => setOrgData(res.data));
  }, []);

  const addGroup = () => setGroups([...groups, { title: '', color_theme: 'blue', questions: [] }]);
  
  const addQuestion = (gIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx].questions.push({ 
      type: 'choice', 
      text: '', 
      options: [{ text: 'نعم', value: 'yes' }, { text: 'لا', value: 'no' }] 
    });
    setGroups(newGroups);
  };

  const handleSave = async () => {
    if (!title) return alert('يرجى إدخال عنوان الاستبيان');
    try {
      await api.post('/admin/surveys/full', { title, description, instructions, groups, assignments });
      navigate('/admin/surveys');
    } catch (err) {
      alert('فشل في حفظ الاستبيان');
    }
  };

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto pb-32" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <Link to="/admin/surveys" className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2">
            <ChevronLeft className="w-4 h-4 rotate-180" /> العودة للاستبيانات
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">إنشاء استبيان جديد</h1>
        </div>
        <button onClick={handleSave} className="w-full md:w-auto bg-green-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95">
          <Save className="w-5 h-5" /> حفظ الاستبيان
        </button>
      </div>

      <div className="space-y-8">
        <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> المعلومات الأساسية</h2>
          <input placeholder="عنوان الاستبيان" className="w-full text-xl md:text-2xl font-bold border-b-2 border-slate-100 focus:border-blue-500 outline-none py-2 transition-all" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea placeholder="وصف الاستبيان..." className="w-full border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} />
          <textarea placeholder="تعليمات عامة للموظفين..." className="w-full border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" value={instructions} onChange={e => setInstructions(e.target.value)} />
        </section>

        <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-orange-600" /> استهداف الموظفين</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => {
              if (e.target.value) setAssignments([...assignments, { department_id: e.target.value, job_level_id: null }]);
            }}>
              <option value="">إضافة استهداف حسب القسم</option>
              {orgData.departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => {
              if (e.target.value) setAssignments([...assignments, { department_id: null, job_level_id: e.target.value }]);
            }}>
              <option value="">إضافة استهداف حسب المستوى الوظيفي</option>
              {orgData.jobLevels?.map((j: any) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {assignments.map((a, i) => (
              <span key={i} className="bg-slate-100 px-4 py-2 rounded-full text-sm flex items-center gap-2 font-medium text-slate-600">
                {a.department_id ? `القسم: ${orgData.departments.find((d:any)=>d.id==a.department_id)?.name}` : `المستوى: ${orgData.jobLevels.find((j:any)=>j.id==a.job_level_id)?.name}`}
                <button onClick={() => setAssignments(assignments.filter((_, idx)=>idx!==i))} className="text-red-500 hover:scale-125 transition-transform">×</button>
              </span>
            ))}
            {assignments.length === 0 && <span className="text-slate-400 text-sm italic">سيتم إرسال الاستبيان لجميع الموظفين افتراضياً</span>}
          </div>
        </section>

        {groups.map((g, gIdx) => (
          <motion.div key={gIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className={cn("p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4", {
              "bg-blue-600": g.color_theme === 'blue',
              "bg-green-600": g.color_theme === 'green',
              "bg-purple-600": g.color_theme === 'purple',
              "bg-orange-600": g.color_theme === 'orange',
              "bg-red-600": g.color_theme === 'red',
            })}>
              <input placeholder="عنوان المجموعة (مثلاً: بيئة العمل)" className="bg-transparent text-white text-xl font-bold placeholder:text-white/50 outline-none w-full" value={g.title} onChange={e => {
                const newGroups = [...groups]; newGroups[gIdx].title = e.target.value; setGroups(newGroups);
              }} />
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select className="bg-white/20 text-white rounded-xl px-3 py-1.5 text-sm outline-none border-none flex-grow md:flex-grow-0" value={g.color_theme} onChange={e => {
                  const newGroups = [...groups]; newGroups[gIdx].color_theme = e.target.value; setGroups(newGroups);
                }}>
                  <option value="blue">أزرق</option><option value="green">أخضر</option><option value="purple">بنفسجي</option><option value="orange">برتقالي</option><option value="red">أحمر</option>
                </select>
                <button onClick={() => setGroups(groups.filter((_, i) => i !== gIdx))} className="p-1.5 text-white/50 hover:text-white"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 md:p-8 space-y-6">
              {g.questions.map((q: any, qIdx: number) => (
                <div key={qIdx} className="p-5 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex gap-2 flex-grow">
                      <select className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={q.type} onChange={e => {
                        const newGroups = [...groups]; 
                        newGroups[gIdx].questions[qIdx].type = e.target.value;
                        if (e.target.value === 'rating') newGroups[gIdx].questions[qIdx].options = { max: 5 };
                        setGroups(newGroups);
                      }}>
                        <option value="choice">اختيار من متعدد</option><option value="text">نصي</option><option value="rating">تقييم</option>
                      </select>
                      <input placeholder="نص السؤال..." className="flex-grow font-bold bg-transparent outline-none border-b border-slate-200 focus:border-blue-500 py-1" value={q.text} onChange={e => {
                        const newGroups = [...groups]; newGroups[gIdx].questions[qIdx].text = e.target.value; setGroups(newGroups);
                      }} />
                    </div>
                    <button onClick={() => {
                      const newGroups = [...groups]; newGroups[gIdx].questions.splice(qIdx, 1); setGroups(newGroups);
                    }} className="self-end md:self-auto text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  
                  {q.type === 'choice' && (
                    <MultipleChoiceBuilder 
                      options={q.options} 
                      onChange={(opts) => {
                        const newGroups = [...groups];
                        newGroups[gIdx].questions[qIdx].options = opts;
                        setGroups(newGroups);
                      }} 
                    />
                  )}
                  {q.type === 'rating' && (
                    <RatingBuilder 
                      options={q.options} 
                      onChange={(opts) => {
                        const newGroups = [...groups];
                        newGroups[gIdx].questions[qIdx].options = opts;
                        setGroups(newGroups);
                      }} 
                    />
                  )}
                </div>
              ))}
              <button onClick={() => addQuestion(gIdx)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2 font-medium">
                <Plus className="w-5 h-5" /> إضافة سؤال للمجموعة
              </button>
            </div>
          </motion.div>
        ))}

        <button onClick={addGroup} className="w-full py-6 border-2 border-dashed border-blue-200 rounded-3xl text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-bold shadow-sm">
          <Plus className="w-6 h-6" /> إضافة مجموعة أسئلة جديدة
        </button>
      </div>
    </div>
  );
}
