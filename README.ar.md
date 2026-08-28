<div dir="rtl">

# Continuity Studio By BURABEEH

أنشأه **محمد المرزوقي (BURABEEH)** من دولة الإمارات العربية المتحدة.

[English](README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [中文](README.zh-CN.md)

Continuity Studio By BURABEEH هو نظام محلي لإنتاج الأفلام بالذكاء الاصطناعي وإدارة الاستمرارية. يحوّل فكرة الفيلم إلى سجل إنتاج منظم يشمل Movie DNA والقصة ودليل الفيلم والشخصيات والمراجع والأصول والسيناريو والتسلسلات واللقطات وأوامر المنصات.

![Sequence Workspace v3](docs/screenshots/39-sequence-detail.png)

## الإصدار الحالي v1.1.0

- Visual Movie DNA: عدد 27 فئة و629 خياراً بصرياً، مع المقارنة والإصدارات والقفل والصورة الرئيسية والموقع العالمي.
- Story v2: القصة الكاملة والبنية والخط الزمني وأقواس الشخصيات وتقسيم التسلسلات والموافقة والقفل.
- Film Bible وتحليل الشخصيات والمراجع المحمية وأوراق الشخصيات وحالات كل شخصية حسب التسلسل.
- Asset Manifest مرقّم، ومكتبة صور الأصول، والفحص، وتعديل الأمر، والإصدارات، والموافقة، والقفل.
- Full Script v2 مع السيناريو والحوار فقط وShot Script وProduction Script.
- Sequence Workspace v3 مع Normal Prompt وJSON Prompt متزامنين، والتحقق، والإصدارات، والتنقل Previous/Next، وStoryboard Grid الاختياري.
- ملفات منصة قابلة للإصدار لـ Seedance وHiggsfield وMiniMax وVeo وKling وRunway وSora وCustom.
- ربط المراجع بالمعرّفات الدائمة وترقيم `@Image` وترتيب الرفع وحزم مراجع التسلسل.
- تخزين محلي بصيغ JSON وMarkdown والوسائط، ووضعا Full وPhases، وProduction Agent، وZIP export.

## حدود الإصدار

يدعم الإصدار المصدري الحالي استيراد الفيديو الناتج، وسجل المحاولات، وقرارات الموافقة أو الرفض اليدوية، وقفل المحاولة المعتمدة، ونقل حالة النهاية المعتمدة تلقائياً إلى بداية التسلسل التالي، ولوحة تقدم الفيلم، وتصدير المشروع الكامل. يظل توليد الفيديو المباشر عبر المنصات، والفحص البصري الآلي لبكسلات الفيديو، وتجميع الفيلم النهائي ضمن [خارطة الطريق](docs/ROADMAP.md).

## التثبيت بالعربية

المتطلبات: Node.js 20.19 أو أحدث، وnpm 10 أو أحدث، وGit عند الاستنساخ.

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang ar
npm run desktop:dev
```

للإعداد غير التفاعلي استخدم `npm run setup -- --lang ar --yes`. يمكن أيضاً تنزيل مثبت Windows أو النسخة المحمولة من [GitHub Releases](https://github.com/momorzq-oss/Continuity-Studio/releases). الحزم غير موقعة رقمياً حالياً وقد يعرض Windows تحذير الناشر غير المعروف.

## استخدام سريع

1. أنشئ مشروعاً واختر Full أو Phases.
2. اختر Movie DNA وراجعه ثم اقفل النسخة المعتمدة.
3. أنشئ Story v2 وFilm Bible والشخصيات والمراجع والأصول ثم وافق عليها.
4. راجع Full Script v2 واقفل الحوار وخطط اللقطات والتسلسلات.
5. افتح Sequence Workspace، واختر Platform Profile، وافحص Normal وJSON Prompt.
6. راجع ترقيم المراجع وترتيب رفعها، ثم انقل الأمر والحزمة يدوياً إلى المنصة.
7. صدّر ملف ZIP المنظم للمشروع.

راجع [دليل التثبيت العربي](docs/i18n/ar/INSTALLATION.md)، و[البدء السريع](docs/i18n/ar/QUICK_START.md)، و[دليل المستخدم](docs/i18n/ar/USER_GUIDE.md)، و[معرض الصور](docs/SCREENSHOTS.md).

يتم تخزين المشاريع والمراجع والوسائط محلياً وهي مستبعدة من Git. ضع المفاتيح في `.env` المستبعد فقط. أسماء المنصات لا تعني رعاية أو شراكة رسمية.

حقوق النشر 2026 محمد المرزوقي. مرخّص وفق [Apache License 2.0](LICENSE).

</div>
