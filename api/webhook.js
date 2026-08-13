// Vercel Serverless Function — POST /api/webhook
// ده المصدر الموثوق لتأكيد إن الدفع نجح فعلاً (أضمن من مجرد إعادة توجيه المتصفح لـ success.html).
// لازم تسجّل اللينك ده في Stripe Dashboard > Developers > Webhooks
// وتحط الـ Signing secret بتاعه في متغير البيئة STRIPE_WEBHOOK_SECRET

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // -------------------------------------------------------------
    // هنا المكان المناسب إنك تحفظ بيانات التسجيل عندك بشكل دائم، مثلاً:
    // - إرسال إيميل تأكيد للمسجّل (عبر Resend / SendGrid / Nodemailer)
    // - حفظ البيانات في Google Sheet أو قاعدة بيانات (Airtable, Supabase, إلخ)
    // - إرسال إشعار لفريق التنظيم على واتساب/تليجرام
    //
    // مبدئيًا، البيانات محفوظة أصلاً داخل Stripe Dashboard > Payments
    // (لأننا حفظناها كـ metadata وقت إنشاء الـ Checkout Session)
    // -------------------------------------------------------------
    console.log("✅ Payment confirmed for:", registration.member1_name, registration.member1_email);
  }

  return res.status(200).json({ received: true });
};
