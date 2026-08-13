// ============================================================
// إعدادات الأسعار — عدّل الأرقام دي وبس، مفيش داعي تلمس أي حاجة تانية
// كل الأرقام بالكرونر النرويجي (NOK) وبالـ"أوره" (1 كرونة = 100 أوره)
// عشان Stripe بياخد المبالغ بأصغر وحدة عملة (زي السنت بالنسبة للدولار)
// ============================================================

const PRICING_CONFIG = {
  currency: "nok",

  // سعر التسجيل الفردي حسب حالة العضوية (بالكرونر)
  individual: {
    member: 100,      // عضو 2026
    nonMember: 150    // مش عضو
  },

  // سعر التسجيل العائلي (فردين) حسب حالة العضوية (بالكرونر)
  family: {
    member: 180,
    nonMember: 260
  },

  // سعر إضافي لكل طفل تحت 16 سنة (بالكرونر) — سيبه 0 لو مفيش رسوم للأطفال
  perChild: 0
};

// دالة حساب السعر الإجمالي — نفس الدالة مستخدمة في الفورم (script.js)
// وفي السيرفر (api/create-checkout-session.js) عشان السعر يتأكد مرتين
function calculatePriceNOK(formValues) {
  const { isMember, registrationType, kidsCount } = formValues;
  const tier = registrationType === "family" ? PRICING_CONFIG.family : PRICING_CONFIG.individual;
  const base = isMember === "yes" ? tier.member : tier.nonMember;
  const kids = Math.max(0, parseInt(kidsCount, 10) || 0);
  const total = base + (kids * PRICING_CONFIG.perChild);
  return total;
}

if (typeof module !== "undefined") {
  module.exports = { PRICING_CONFIG, calculatePriceNOK };
}
