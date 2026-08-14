// Vercel Serverless Function — POST /api/webhook
// ده المصدر الموثوق لتأكيد إن الدفع نجح فعلاً (أضمن من مجرد إعادة توجيه المتصفح لـ success.html).
// لازم تسجّل اللينك ده في Stripe Dashboard > Developers > Webhooks
// وتحط الـ Signing secret بتاعه في متغير البيئة STRIPE_WEBHOOK_SECRET

const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// تهيئة Firebase Admin مرة واحدة بس (Vercel ممكن يعيد استخدام نفس الـ container بين الطلبات)
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    )
  });
}

// لازم نمنع Vercel من عمل parse للـ body تلقائي، عشان نتحقق من التوقيع (signature) بشكل صحيح
module.exports.config = {
  api: { bodyParser: false }
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const registration = session.metadata;

    console.log("✅ Payment confirmed for:", registration.member1_name, registration.member1_email);

    // -------------------------------------------------------------
    // حفظ بيانات التسجيل في Firestore — ده المصدر الدائم والموثوق
    // للبيانات (بدل الاعتماد بس على Stripe Dashboard)
    // -------------------------------------------------------------
    try {
      await saveRegistrationToFirestore(registration, session);
    } catch (err) {
      console.error("Failed to save registration to Firestore:", err.message);
    }

    // -------------------------------------------------------------
    // إرسال إيميل تأكيد للمسجّل عبر Resend
    // لو لسه معملتش حساب Resend أو مضفتش RESEND_API_KEY، السطر ده هيفشل بهدوء
    // ويسجل الخطأ في الـ Logs من غير ما يوقف باقي العملية
    // -------------------------------------------------------------
    try {
      await sendConfirmationEmail(registration, session.amount_total);
    } catch (err) {
      console.error("Failed to send confirmation email:", err.message);
    }
  }

  return res.status(200).json({ received: true });
};

async function saveRegistrationToFirestore(registration, session) {
  if (!admin.apps.length) {
    console.log("FIREBASE_SERVICE_ACCOUNT_KEY مش موجود — تم تخطي الحفظ في Firestore.");
    return;
  }

  const db = admin.firestore();

  await db.collection("registrations").doc(session.id).set({
    ...registration,
    kidsCount: Number(registration.kidsCount || 0),
    amountTotal: session.amount_total / 100,
    currency: session.currency,
    stripeSessionId: session.id,
    paymentStatus: "paid",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log("✅ Registration saved to Firestore:", session.id);
}

async function sendConfirmationEmail(registration, amountTotal) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY مش موجود — تم تخطي إرسال الإيميل.");
    return;
  }

  const amountKr = (amountTotal / 100).toFixed(0);
  const registrationTypeLabel = registration.registrationType === "family" ? "عائلي" : "فردي";

  const namesLine = registration.registrationType === "family" && registration.member2_name
    ? `${registration.member1_name} و ${registration.member2_name}`
    : registration.member1_name;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 480px; margin: 0 auto; padding: 24px; color: #2B2118;">
      <h2 style="color: #0A4F42;">تم تأكيد تسجيلكم 🎉</h2>
      <p>أهلاً ${registration.member1_name}،</p>
      <p>تم تأكيد دفعكم بنجاح لتجمع أغسطس الصيفي — المجتمع المصري في النرويج.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #5A4C3C;">الاسم/الأسماء</td>
          <td style="padding: 8px 0; font-weight: bold;">${namesLine}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #5A4C3C;">نوع التسجيل</td>
          <td style="padding: 8px 0; font-weight: bold;">${registrationTypeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #5A4C3C;">المبلغ المدفوع</td>
          <td style="padding: 8px 0; font-weight: bold;">${amountKr} kr</td>
        </tr>
      </table>
      <p>هنبعتلكم تفاصيل التجمع (المكان والموعد بالظبط) قريبًا.</p>
      <p style="margin-top: 24px; color: #5A4C3C; font-size: 13px;">EGYSAMFUNN — المجتمع المصري في النرويج</p>
    </div>
  `;

  const emailPayload = {
    from: process.env.FROM_EMAIL || "EGYSAMFUNN <onboarding@resend.dev>",
    to: registration.member1_email,
    subject: "تم تأكيد تسجيلكم — تجمع أغسطس الصيفي",
    html: emailHtml
  };

  // لو حاطط ADMIN_NOTIFY_EMAIL في Vercel، هتوصلك نسخة مطابقة من كل إيميل تأكيد
  // بيتبعت لأي مسجّل، عن طريق BCC (يعني المسجّل مش هيشوف إيميلك في النسخة بتاعته)
  if (process.env.ADMIN_NOTIFY_EMAIL) {
    emailPayload.bcc = [process.env.ADMIN_NOTIFY_EMAIL];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailPayload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error: ${response.status} ${errorBody}`);
  }

  console.log("✅ Confirmation email sent to:", registration.member1_email);
}
