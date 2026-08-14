// Vercel Serverless Function — POST /api/admin-registrations
// بيتحقق من الباسورد الأول، ولو صح، بيرجّع كل التسجيلات من Firestore
// مرتبة من الأحدث للأقدم. الباسورد بيتقارن على السيرفر بس، والمفتاح
// السري بتاع Firebase مايوصلش للمتصفح خالص.

const admin = require("firebase-admin");

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    )
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password } = req.body || {};

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: "ADMIN_PASSWORD مش متظبط في السيرفر." });
    }
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "الباسورد غلط." });
    }
    if (!admin.apps.length) {
      return res.status(500).json({ error: "Firebase مش متظبط في السيرفر." });
    }

    const db = admin.firestore();
    const snapshot = await db
      .collection("registrations")
      .orderBy("createdAt", "desc")
      .get();

    const registrations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        member1_name: data.member1_name || "",
        member1_email: data.member1_email || "",
        member1_phone: data.member1_phone || "",
        member1_gender: data.member1_gender || "",
        member2_name: data.member2_name || "",
        member2_email: data.member2_email || "",
        member2_phone: data.member2_phone || "",
        registrationType: data.registrationType || "",
        isMember: data.isMember || "",
        hasKidsUnder16: data.hasKidsUnder16 || "",
        kidsCount: data.kidsCount || 0,
        childAges: data.childAges || "",
        amountTotal: data.amountTotal || 0,
        currency: data.currency || "",
        paymentStatus: data.paymentStatus || "",
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
      };
    });

    return res.status(200).json({ registrations });
  } catch (err) {
    console.error("Admin registrations error:", err.message);
    return res.status(500).json({ error: "حصل خطأ في جلب البيانات." });
  }
};
