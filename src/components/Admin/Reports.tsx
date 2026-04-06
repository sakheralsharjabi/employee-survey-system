import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Users, CheckCircle, Clock, Download, Printer, ChevronRight, Search, TrendingUp, Activity, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import * as XLSX from 'xlsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(id);

  useEffect(() => {
    if (!selectedId) {
      fetchSurveys();
    } else {
      fetchReport(selectedId);
    }
  }, [selectedId]);

  const fetchSurveys = async () => {
    try {
      const res = await api.get('/admin/surveys');
      setSurveys(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (surveyId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/surveys/${surveyId}/report`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!report) return;
    
    // 1. Questions Summary
    const matrixData = report.questions.map((q: any) => {
      const row: any = { 'السؤال': q.text, 'النوع': q.type, 'المجموعة': q.group_title, 'عدد الاستجابات': q.responseCount };
      if (q.type === 'rating') {
        row['المتوسط'] = q.analysis.average;
        row['الوسيط'] = q.analysis.median;
        row['المنوال'] = q.analysis.mode;
      }
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(wb, ws1, "ملخص الأسئلة");

    // 2. Group Analysis
    const groupData = report.groupAnalysis.map((g: any) => ({
      'المجموعة': g.title,
      'متوسط التقييم': g.avgRating,
      'عدد الأسئلة': g.questionCount
    }));
    const ws2 = XLSX.utils.json_to_sheet(groupData);
    XLSX.utils.book_append_sheet(wb, ws2, "تحليل المجموعات");

    // 3. Raw Responses
    const rawData: any[] = [];
    report.questions.forEach((q: any) => {
      if (q.type === 'text' && q.analysis.rawAnswers) {
        q.analysis.rawAnswers.forEach((ans: any) => {
          rawData.push({
            'السؤال': q.text,
            'الموظف': ans.full_name,
            'الإجابة': ans.answer_text
          });
        });
      }
    });
    if (rawData.length) {
      const ws3 = XLSX.utils.json_to_sheet(rawData);
      XLSX.utils.book_append_sheet(wb, ws3, "الإجابات النصية");
    }

    XLSX.writeFile(wb, `تقرير_${report.survey.title}.xlsx`);
  };

  if (loading && !report) return <div className="p-10 text-center font-bold text-slate-400">جاري التحميل...</div>;

  if (!selectedId) {
    return (
      <div className="p-4 md:p-10 space-y-8" dir="rtl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900">التقارير والتحليلات</h1>
            <p className="text-slate-500 font-medium">اختر استبياناً لعرض النتائج التفصيلية</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {surveys.map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedId(s.id.toString())}
              className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-right group transition-all hover:shadow-xl hover:shadow-slate-100/50"
            >
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">عرض التقرير</span>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  if (!report) return <div className="p-10 text-center font-bold text-red-400">التقرير غير موجود</div>;

  return (
    <div className="p-4 md:p-10 space-y-8 print:p-0" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedId(undefined)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">{report.survey.title}</h1>
            <p className="text-slate-500 font-medium">تحليل شامل لنتائج الاستبيان</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={exportToExcel} className="flex-grow md:flex-grow-0 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
            <Download className="w-5 h-5" /> تصدير Excel
          </button>
          <button onClick={() => window.print()} className="flex-grow md:flex-grow-0 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
            <Printer className="w-5 h-5" /> طباعة PDF
          </button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي المشاركين', value: report.totalResponses, icon: Users, color: 'blue' },
          { label: 'نسبة الإنجاز', value: `${report.completionRate}%`, icon: CheckCircle, color: 'green' },
          { label: 'المدعوين', value: report.invitedCount, icon: Target, color: 'purple' },
          { label: 'متوسط الوقت', value: `${Math.floor(report.avgTime / 60)}د ${report.avgTime % 60}ث`, icon: Clock, color: 'orange' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5"
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", 
              stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
              stat.color === 'green' ? "bg-green-50 text-green-600" :
              stat.color === 'purple' ? "bg-purple-50 text-purple-600" :
              "bg-orange-50 text-orange-600"
            )}>
              <stat.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Group Analysis Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" /> أداء المجموعات
            </h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.groupAnalysis}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="title" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="avgRating" name="متوسط التقييم" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-purple-600" /> تحليل الرادار
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={report.groupAnalysis}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="title" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar name="التقييم" dataKey="avgRating" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Questions Analysis */}
      <div className="space-y-8">
        <h2 className="text-2xl font-black text-slate-900">التحليل التفصيلي للأسئلة</h2>
        {report.questions?.map((q: any, i: number) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 break-inside-avoid"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">{q.group_title}</span>
                <h3 className="text-xl font-bold text-slate-900">{q.text}</h3>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">الاستجابات</p>
                  <p className="text-lg font-black text-slate-900">{q.responseCount}</p>
                </div>
              </div>
            </div>

            {q.type === 'rating' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'المتوسط الحسابي', value: q.analysis.average, desc: 'Mean' },
                  { label: 'الوسيط الإحصائي', value: q.analysis.median, desc: 'Median' },
                  { label: 'المنوال (الأكثر تكراراً)', value: q.analysis.mode, desc: 'Mode' },
                ].map((stat, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                    <p className="text-3xl font-black text-blue-600 mb-1">{stat.value}</p>
                    <p className="text-[10px] font-bold text-slate-400">{stat.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {q.type === 'choice' && q.analysis?.distribution && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(q.analysis.distribution).map(([name, value]) => ({ name, value }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {Object.entries(q.analysis.distribution).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {Object.entries(q.analysis.distribution).map(([name, value]: [string, any], index) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{value} ({((value / q.responseCount) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {q.type === 'text' && q.analysis?.rawAnswers && (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {q.analysis.rawAnswers.map((ans: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">{ans.answer_text}</p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <Users className="w-3 h-3" />
                      <span>{ans.full_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
