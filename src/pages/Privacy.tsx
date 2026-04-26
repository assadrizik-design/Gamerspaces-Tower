import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto overflow-y-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-white/5 shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">سياسة الخصوصية</h1>
        
        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">1. جمع البيانات</h2>
            <p>
              نحن في TowerStack نحترم خصوصيتك. موقعنا لا يقوم بجمع أي بيانات شخصية أو معلومات حساسة عن زوارنا. اللعبة تعمل بالكامل على متصفحك المحلي (Client-side) ولا تتطلب أي تسجيل دخول.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">2. ملفات تعريف الارتباط (Cookies) والطرف الثالث</h2>
            <p>
              يستخدم موقعنا خدمات إعلانية من أطراف ثالثة (مثل Google AdSense) لعرض الإعلانات عند زيارة موقعنا. هذه الشركات قد تستخدم معلومات (باستثناء الاسم، العنوان، عنوان البريد الإلكتروني، أو رقم الهاتف) حول زياراتك لهذا الموقع والمواقع الأخرى من أجل تقديم إعلانات حول البضائع والخدمات التي تهمك.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">3. إعلانات Google Analytics و AdSense</h2>
            <p>
              جوجل تستخدم ملفات تعريف الارتباط (DART) لعرض الإعلانات للمستخدمين بناءً على زياراتهم السابقة لهذا الموقع ومواقع أخرى على الإنترنت. يمكنك اختيار عدم استخدام ملفات تعريف ارتباط DART من خلال زيارة سياسة الخصوصية الخاصة بإعلانات جوجل وشبكة المحتوى.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">4. التغييرات على سياسة الخصوصية</h2>
            <p>
              قد نقوم بتحديث سياسة الخصوصية الخاصة بنا من وقت لآخر. سيتم نشر أي تغييرات على هذه الصفحة. استخدامك المستمر للموقع بعد أي تغيير يمثل موافقتك على هذه التغييرات.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
