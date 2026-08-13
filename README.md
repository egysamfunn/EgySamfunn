# فورم تسجيل تجمع عيد الأضحي + Stripe

مشروع بسيط وجاهز للنشر المجاني على **Vercel**: فورم تسجيل (HTML/CSS/JS عادي، من غير أي framework) + سيرفر صغير (Vercel Serverless Functions) بيحسب السعر ويعمل عملية دفع عبر **Stripe Checkout**.

## بنية المشروع

```
eid-registration/
├── index.html                     ← الفورم نفسه
├── style.css                      ← التصميم
├── script.js                      ← منطق الفورم (إظهار/إخفاء حقول، حساب السعر، إرسال الطلب)
├── config.js                      ← أسعار الاشتراك (عدّلها هنا بس)
├── success.html / cancel.html     ← صفحات بعد الدفع
├── api/
│   ├── create-checkout-session.js ← بيستقبل بيانات الفورم وينشئ عملية دفع Stripe
│   └── webhook.js                 ← بيتأكد فعليًا إن الدفع نجح (اختياري بس منصوح بيه)
├── package.json
└── .env.example
```

## 1) عدّل الأسعار

افتح `config.js` وغيّر الأرقام حسب اللي عايزينه (بالكرونر النرويجي):

```js
individual: { member: 100, nonMember: 150 },
family:     { member: 180, nonMember: 260 },
perChild:   0
```

## 2) جهّز حساب Stripe

1. اعمل حساب على [stripe.com](https://stripe.com) (أو استخدم حسابكم الحالي لو موجود).
2. من **Developers > API keys** خد الـ **Secret key** (ابدأ بوضع Test mode أول ما تجرب: `sk_test_...`).
3. لسه هتحتاج الـ **Webhook signing secret** — هنجيبه في خطوة 4 بعد النشر.

## 3) انشر المشروع على Vercel (مجاني)

الأسهل: ارفع الفولدر ده على GitHub (repo جديد)، وبعدين:

1. روح [vercel.com](https://vercel.com) → **Add New Project** → اختار الـ repo.
2. Vercel هيكتشف المشروع أوتوماتيك (Node.js + static files)، سيب الإعدادات زي ما هي واضغط **Deploy**.
3. بعد النشر، روح **Settings > Environment Variables** وضيف:
   - `STRIPE_SECRET_KEY` = المفتاح السري بتاعك
   - `SITE_URL` = رابط المشروع اللي Vercel ديه ليك (مثلاً `https://eid-registration.vercel.app`)
4. اضغط **Redeploy** بعد إضافة المتغيرات عشان تتفعّل.

(بديل: تقدر تستخدم [Vercel CLI](https://vercel.com/docs/cli) بدل GitHub لو مرتاح للـ terminal: `npm i -g vercel` ثم `vercel`.)

## 4) فعّل الـ Webhook (مهم لتأكيد الدفع)

1. من Stripe Dashboard: **Developers > Webhooks > Add endpoint**.
2. الرابط: `https://your-project.vercel.app/api/webhook`
3. اختار الحدث (event): `checkout.session.completed`
4. خد الـ **Signing secret** اللي هيظهرلك وضيفه في Vercel كمتغير بيئة باسم `STRIPE_WEBHOOK_SECRET`، وبعدين اعمل Redeploy تاني.

## 5) جرّب قبل ما تنشر رسمي

Stripe بيديك بيانات بطاقات وهمية للتجربة في وضع Test mode، مثلاً رقم البطاقة `4242 4242 4242 4242` وأي تاريخ مستقبلي وأي CVC. جرّب تسجيل كامل وشوف إن العملية بتظهر في **Stripe Dashboard > Payments** ببيانات المسجّل كاملة (تحت Metadata).

لما تتأكد إن كل حاجة شغالة، بدّل المفتاح من Test إلى **Live** (من نفس صفحة API keys) وحدّث `STRIPE_SECRET_KEY` و`STRIPE_WEBHOOK_SECRET` بمفاتيح الـ Live mode.

## أين بتتحفظ بيانات المسجّلين؟

كل بيانات الفورم (الاسم، الإيميل، الهاتف، نوع التسجيل...) بتتحفظ كـ **Metadata** جوه كل عملية دفع في Stripe Dashboard — تقدر تصدّرها من هناك كـ CSV في أي وقت.

لو عايز حفظ أوتوماتيك في مكان تاني (Google Sheet، إيميل تأكيد للمسجّل، إشعار واتساب)، ده بيتضاف جوه `api/webhook.js` في المكان المُعلّم بتعليق داخل الملف — قوللي لو عايز أضيفه.

## ملاحظات أمان

- المبلغ بيتحسب **من السيرفر** (`api/create-checkout-session.js`) مش من المتصفح، عشان محدش يقدر يعدّل السعر من الـ dev tools.
- مفتاح Stripe السري بيفضل دايمًا في متغيرات البيئة (Environment Variables) ومتحطوش أبدًا جوه الكود أو الفورم نفسه.
