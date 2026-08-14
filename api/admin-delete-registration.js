// Vercel Serverless Function — POST /api/admin-delete-registration
// بيتحقق من الباسورد، ولو صح، بيمسح تسجيل واحد من Firestore بالـ ID بتاعه.

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
    const { password, id } = req.body || {};

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: "ADMIN_PASSWORD مش متظبط في السيرفر." });
    }
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "الباسورد غلط." });
    }
    if (!id) {
      return res.status(400).json({ error: "معرّف التسجيل ناقص." });
    }
    if (!admin.apps.length) {
      return res.status(500).json({ error: "Firebase مش متظبط في السيرفر." });
    }

    const db = admin.firestore();
    await db.collection("registrations").doc(id).delete();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Admin delete registration error:", err.message);
    return res.status(500).json({ error: "حصل خطأ أثناء المسح." });
  }
};
