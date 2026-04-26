import React from 'react';
import { Mail, MessageCircle, User } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto overflow-y-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-white/5 shadow-xl text-center md:text-right">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">اتصل بنا</h1>
        
        <p className="text-slate-300 mb-8 max-w-2xl text-lg">
          سعداء دائماً بتواصلكم معنا. إذا كان لديكم أي اقتراحات لتطوير اللعبة، أو واجهتم أي مشكلة تقنية، أو للاستفسارات التجارية، لا تترددوا بالتواصل عبر القنوات التالية:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 flex flex-col items-center md:items-start gap-4 hover:border-blue-500/30 transition-colors">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center">
              <User size={24} />
            </div>
            <div>
              <h3 className="text-sm text-slate-400 mb-1">المطور</h3>
              <p className="text-xl font-semibold text-white">Abu Saqr</p>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 flex flex-col items-center md:items-start gap-4 hover:border-blue-500/30 transition-colors">
            <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="text-sm text-slate-400 mb-1">الدعم الفني</h3>
              <a href="mailto:assadrizik2011@gmail.com" className="text-xl font-semibold text-white hover:text-purple-400 transition-colors">
                assadrizik2011@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 p-8 bg-indigo-900/30 rounded-2xl border border-indigo-500/20 flex flex-col items-center text-center">
           <div className="w-16 h-16 bg-[#5865F2] text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
             <MessageCircle size={32} />
           </div>
           <h3 className="text-2xl font-bold text-white mb-3">مجتمع ديسكورد</h3>
           <p className="text-slate-300 mb-6 max-w-md">
             انضم إلى سيرفر الديسكورد الرسمي الخاص بنا! شارك أرقامك القياسية، وتحدث مع لاعبين آخرين وكُن أول من يعرف عن التحديثات القادمة للعبة.
           </p>
           <a 
              href="https://discord.gg/BJ5kYUNutq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105 active:scale-95"
           >
              انضم إلينا الآن
           </a>
        </div>
      </div>
    </div>
  );
}
