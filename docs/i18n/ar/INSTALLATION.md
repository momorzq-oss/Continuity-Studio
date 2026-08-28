<div dir="rtl">

# التثبيت

## الطرق المتاحة

1. مثبت Windows بصيغة NSIS من GitHub Releases.
2. نسخة Windows محمولة لا تحتاج إلى تثبيت.
3. استنساخ Git للتطوير على Windows وmacOS وLinux.
4. تنزيل ZIP من GitHub ثم فك الضغط.

تم اختبار حزم سطح المكتب فقط على Windows 10/11 x64. يمكن تشغيل المصدر كخادم محلي على macOS وLinux، لكن لا توجد حزم سطح مكتب أصلية لهما في v1.1.0.

## المتطلبات

- Node.js 20.19 أو أحدث؛ يوصى بـ Node.js 22 LTS.
- npm 10 أو أحدث.
- Git مطلوب فقط للاستنساخ.
- Python وFFmpeg وقاعدة بيانات خارجية غير مطلوبة.
- مفاتيح الذكاء الاصطناعي اختيارية؛ المحرك المدمج يعمل دونها.

## مثبت CLI العربي

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang ar
```

للإعداد التلقائي: `npm run setup -- --lang ar --yes`.

بعد الإعداد شغّل `npm run desktop:dev` على Windows، أو `npm run dev` ثم افتح `http://127.0.0.1:8787` في وضع تطوير المتصفح.

انسخ `.env.example` إلى `.env` فقط عند استخدام موفر اختياري. `OPENAI_API_KEY` مستخدم فعلياً للنص، ولا يلزم `LOCAL_LLM_API_KEY` إلا إذا كان الخادم المحلي يطلب المصادقة. مفاتيح MiniMax وSeedance وHiggsfield محجوزة لموصلات مستقبلية ولا يتم استدعاء APIs الخاصة بها في هذا الإصدار. تسجيل Codex يتم من شاشة Settings ولا يحتاج إلى نسخ كلمة مرور ChatGPT.

للتحقق:

```bash
npm run typecheck
npm test
npm run build
```

</div>
