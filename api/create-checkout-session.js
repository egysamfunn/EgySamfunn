// Vercel Serverless Function — POST /api/create-checkout-session
// بيستقبل بيانات الفورم، يحسب السعر بنفسه من عنده (مش بياخده من المتصفح، عشان الأمان)،
// وبيعمل Stripe Checkout Session ويرجّع الرابط للفرونت إند يحوّل عليه المستخدم.

const Stripe = require("stripe");
const { calculatePriceNOK, PRICING_CONFIG } = require("../config.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// عدّل الدومين ده لدومين موقعك الحقيقي بعد النشر على Vercel
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = req.body;

    // -------- تحقق أساسي من البيانات المطلوبة --------
    const required = [
      "isMember", "registrationType", "member1_name", "member1_gender",
      "member1_email", "member1_phone", "hasKidsUnder16", "agreeTerms"
    ];
    for (const field of required) {
      if (!data[field] && data[field] !== false) {
        return res.status(400).json({ error: `الحقل الناقص: ${field}` });
      }
    }
    if (data.agreeTerms !== true && data.agreeTerms !== "true") {
      return res.status(400).json({ error: "لازم توافق على الشروط والأحكام." });
    }
    if (data.registrationType === "family") {
      const familyRequired = ["member2_name", "member2_gender", "member2_email", "member2_phone"];
      for (const field of familyRequired) {
        if (!data[field]) return res.status(400).json({ error: `الحقل الناقص: ${field}` });
      }
    }

    // -------- حساب السعر من السيرفر (مصدر الحقيقة الوحيد) --------
    const totalNOK = calculatePriceNOK({
      isMember: data.isMember,
      registrationType: data.registrationType,
      kidsCount: data.kidsCount
    });

    if (!totalNOK || totalNOK <= 0) {
      return res.status(400).json({ error: "تعذر حساب المبلغ المستحق." });
    }

    // Stripe بياخد المبلغ بأصغر وحدة عملة (أوره)، فبنضرب × 100
    const amountInOre = Math.round(totalNOK * 100);

    const description = data.registrationType === "family"
      ? `تسجيل عائلي — ${data.member1_name} و ${data.member2_name}`
      : `تسجيل فردي — ${data.member1_name}`;

    // كل بيانات الفورم بتتحفظ كـ metadata على الـ Checkout Session
    // هتلاقيها في Stripe Dashboard > Payments > تفاصيل العملية
    const metadata = {
      isMember: String(data.isMember),
      registrationType: String(data.registrationType),
      member1_name: String(data.member1_name),
      member1_gender: String(data.member1_gender),
      member1_email: String(data.member1_email),
      member1_phone: String(data.member1_phone),
      member2_name: String(data.member2_name || ""),
      member2_gender: String(data.member2_gender || ""),
      member2_email: String(data.member2_email || ""),
      member2_phone: String(data.member2_phone || ""),
      hasKidsUnder16: String(data.hasKidsUnder16),
      kidsCount: String(data.kidsCount || 0)
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: data.member1_email,
      line_items: [
        {
          price_data: {
            currency: PRICING_CONFIG.currency,
            unit_amount: amountInOre,
            product_data: {
              name: "تسجيل تجمع أغسطس الصيفي — المجتمع المصري في النرويج",
              description
            }
          },
          quantity: 1
        }
      ],
      metadata,
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cancel.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: "حصل خطأ في السيرفر أثناء تجهيز الدفع." });
  }
};
