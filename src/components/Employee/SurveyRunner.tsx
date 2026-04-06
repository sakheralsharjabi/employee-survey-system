import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Send, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export default function SurveyRunner() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});
  const [currentStep, setCurrentStep] = useState(0); // 0: Instructions, 1+: Groups
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/surveys/${id}/full`).then(res => {
      setSurvey(res.data);
      setLoading(false);
      // Mark survey as started
      api.post(`/employee/surveys/${id}/start`).catch(console.error);
    });
  }, [id]);

  const handleNext = () => {
    if (currentStep < (survey.groups?.length || 0)) setCurrentStep(currentStep + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    try {
      await api.post(`/employee/surveys/${id}/responses`, { answers });
      setSubmitted(true);
    } catch (err) {
      alert('فشل في إرسال الرد');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">جاري التحميل...</div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center font-bold text-red-400">الاستبيان غير موجود</div>;

  const groups = survey.groups || [];
  const currentGroup = currentStep > 0 ? groups[currentStep - 1] : null;
  const progress = (currentStep / groups.length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6" dir="rtl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900">شكراً لك!</h2>
            <p className="text-slate-500 text-lg">لقد تم تسجيل ردك بنجاح. مشاركتك تساعدنا على التحسن المستمر.</p>
          </div>
          <button onClick={() => navigate('/employee')} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl text-lg shadow-xl shadow-slate-100 transition-all active:scale-95">العودة للرئيسية</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" dir="rtl">
      <header className="fixed top-0 left-0 right-0 h-1.5 bg-slate-100 z-50">
        <motion.div className="h-full bg-blue-600" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
      </header>

      <main className="flex-grow flex flex-col max-w-2xl mx-auto w-full px-6 py-12 md:py-20">
        <AnimatePresence mode="wait">
          {currentStep === 0 ? (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-grow flex flex-col justify-center space-y-10">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">{survey.title}</h1>
                <p className="text-xl text-slate-500 leading-relaxed">{survey.description}</p>
              </div>
              <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100/50 space-y-4">
                <h3 className="font-bold text-blue-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> تعليمات هامة</h3>
                <p className="text-blue-800/80 whitespace-pre-wrap leading-relaxed">{survey.instructions}</p>
              </div>
              <button onClick={handleNext} className="w-full bg-blue-600 text-white font-bold py-5 rounded-3xl text-xl shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                ابدأ الاستبيان <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            </motion.div>
          ) : (
            <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
              <div className="flex items-center gap-4">
                <div className={cn("w-2 h-10 rounded-full", {
                  "bg-blue-600": currentGroup.color_theme === 'blue',
                  "bg-green-600": currentGroup.color_theme === 'green',
                  "bg-purple-600": currentGroup.color_theme === 'purple',
                  "bg-orange-600": currentGroup.color_theme === 'orange',
                  "bg-red-600": currentGroup.color_theme === 'red',
                })} />
                <h2 className="text-2xl font-black text-slate-800">{currentGroup.title}</h2>
              </div>

              <div className="space-y-16">
                {currentGroup.questions?.map((q: any) => (
                  <div key={q.id} className="space-y-8">
                    <h3 className="text-2xl font-bold text-slate-900 leading-snug">{q.text}</h3>
                    <div className="space-y-4">
                      {q.type === 'choice' && q.options?.map((opt: any, idx: number) => (
                        <motion.label 
                          key={idx} 
                          whileTap={{ scale: 0.98 }}
                          className={cn("flex items-center gap-4 p-6 rounded-3xl border-2 transition-all cursor-pointer", 
                            answers[q.id] === opt.value ? "border-blue-600 bg-blue-50/50 shadow-md" : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all", 
                            answers[q.id] === opt.value ? "border-blue-600 bg-blue-600" : "border-slate-300"
                          )}>
                            {answers[q.id] === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <input type="radio" name={`q-${q.id}`} className="hidden" checked={answers[q.id] === opt.value} onChange={() => setAnswers({...answers, [q.id]: opt.value})} />
                          <span className="text-lg font-bold text-slate-700">{opt.text}</span>
                        </motion.label>
                      ))}
                      
                      {q.type === 'rating' && (
                        <div className="flex flex-wrap justify-between gap-3">
                          {Array.from({ length: q.options?.max || 5 }, (_, i) => i + 1).map(val => (
                            <motion.button 
                              key={val} 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setAnswers({...answers, [q.id]: val})} 
                              className={cn("flex-grow h-16 rounded-2xl border-2 font-black text-xl transition-all", 
                                answers[q.id] === val ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-100" : "border-slate-100 text-slate-300 hover:border-slate-200"
                              )}
                            >
                              {val}
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {q.type === 'text' && (
                        <textarea 
                          value={answers[q.id] || ''} 
                          onChange={e => setAnswers({...answers, [q.id]: e.target.value})} 
                          className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-600 focus:bg-white transition-all min-h-[180px] text-lg font-medium placeholder:text-slate-300" 
                          placeholder="اكتب إجابتك هنا بكل صراحة..." 
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-10">
                <button onClick={handleNext} className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl text-xl shadow-2xl shadow-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                  {currentStep === groups.length ? 'إرسال الاستبيان' : 'التالي'}
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <button onClick={() => setCurrentStep(currentStep - 1)} className="w-full md:w-auto px-10 bg-slate-100 text-slate-500 font-bold py-5 rounded-3xl text-xl transition-all active:scale-95">السابق</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
