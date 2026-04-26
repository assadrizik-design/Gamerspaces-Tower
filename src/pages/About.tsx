import React from 'react';

export default function About() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto overflow-y-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-white/5 shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">من نحن</h1>
        
        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            مرحباً بك في <strong className="text-white">TowerStack</strong>، اللعبة التفاعلية التي تختبر دقة ملاحظتك وسرعة استجابتك!
          </p>
          <p>
            بدأت فكرة اللعبة بهدف تقديم تجربة بسيطة وممتعة ومسببة للإدمان إيجابياً للجميع. هدفنا هو تقديم تجربة سلسة تعمل بأفضل كفاءة على المتصفحات والهواتف المحمولة بدون الحاجة لأي عمليات تحميل معقدة.
          </p>
          <p>
            نسعى دائماً لتطوير اللعبة وإضافة مستويات وتحديات جديدة. يمكنك الاستمتاع باللعبة في أوقات الفراغ حيث لا تتطلب الكثير من الوقت لكنها تتطلب الكثير من التركيز!
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4 text-white">كيف تلعب؟</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-300">
            <li>قم بالنقر أو اللمس في أي مكان على الشاشة لإسقاط البناية.</li>
            <li>حاول أن تسقط كل بناية فوق البناية التي تسبقها بدقة متناهية.</li>
            <li>أي جزء زائد عن البناية السابقة سيتم قطعه! مما يصعب المهمة في المرات القادمة.</li>
            <li>تستمر اللعبة طالما أنك تضع البنايات فوق بعضها. تنتهي اللعبة عند عدم ملامسة البناية للجزء السفلي تماماً.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
