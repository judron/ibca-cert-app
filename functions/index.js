/* =====================================================================
   Cloud Function — שולח מייל לוועדה כשמשתתף משלים את כל פריטי ההסמכה.
   2nd gen. מופעל על כל עדכון של מסמך משתתף; בודק השלמה; שולח פעם אחת.
   ===================================================================== */
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// מפתח ה-SMTP של Brevo נשמר כסוד (firebase functions:secrets:set BREVO_SMTP_KEY)
const BREVO_SMTP_KEY = defineSecret("BREVO_SMTP_KEY");

// הפריטים הנדרשים להשלמה — חייב להתאים ל-certItems שב-js/config.js
const REQUIRED_FORMS = ["selfAssessCompetence", "projectExperience", "processUnderstanding", "declaration"];
const REQUIRED_UPLOADS = ["cv", "certificates", "clientRefs", "finalExercise"];

const NOTIFY_TO = "jude@excelleader.co.il";
const NOTIFY_FROM = '"הסמכת קוד המקצוע" <jude@excelleader.co.il>';
const ADMIN_URL = "https://judron.github.io/ibca-cert-app/#/admin";

exports.notifyOnComplete = onDocumentUpdated(
  { document: "participants/{uid}", region: "us-central1", secrets: [BREVO_SMTP_KEY] },
  async (event) => {
    const after = event.data && event.data.after ? event.data.after.data() : null;
    if (!after) return;
    if (after.notifiedComplete) return; // כבר נשלחה התראה

    const uid = event.params.uid;
    const db = admin.firestore();
    const [formsSnap, upsSnap] = await Promise.all([
      db.collection(`participants/${uid}/forms`).get(),
      db.collection(`participants/${uid}/uploads`).get(),
    ]);

    const forms = new Set();
    formsSnap.forEach((d) => forms.add(d.id));
    const uploads = {};
    upsSnap.forEach((d) => {
      const u = d.data() || {};
      if (u.itemId) uploads[u.itemId] = (uploads[u.itemId] || 0) + 1;
    });

    const formsDone = REQUIRED_FORMS.every((id) => forms.has(id));
    const uploadsDone = REQUIRED_UPLOADS.every((id) => uploads[id] > 0);
    if (!(formsDone && uploadsDone)) return; // עדיין לא הושלם הכול

    const name = after.name || after.email || uid;
    const pn = after.processNumber || "";
    const email = after.email || "";

    const transport = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: { user: "aee7e5001@smtp-brevo.com", pass: BREVO_SMTP_KEY.value() },
    });

    await transport.sendMail({
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      subject: `תהליך הושלם: ${name} (${pn})`,
      html:
        `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">` +
        `<p>המשתתף/ת <b>${name}</b> השלים/ה את כל פריטי ההסמכה.</p>` +
        `<p>מספר תהליך: <b>${pn}</b><br>מייל: ${email}</p>` +
        `<p>אפשר להוציא תעודה במסך הוועדה: <a href="${ADMIN_URL}">${ADMIN_URL}</a></p>` +
        `</div>`,
    });

    // סימון שנשלחה התראה — מונע מיילים כפולים
    await event.data.after.ref.set({ notifiedComplete: true }, { merge: true });
  }
);
