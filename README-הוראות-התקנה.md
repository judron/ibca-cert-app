# אפליקציית הסמכת קוד המקצוע — מדריך התקנה והפעלה

אפליקציה זו מאפשרת למשתתפי סדנת ההסמכה:
- להתחבר עם כתובת מייל (בלי סיסמה).
- למלא ולחתום על כתב ההתחייבות ישירות באפליקציה.
- להוריד את התבניות למילוי.
- להעלות את המסמכים הנדרשים.
- כל משתתף מקבל מרחב אישי, וחברי הוועדה רואים את כל המשתתפים במסך ניהול.

הכול בנוי מקבצים סטטיים (HTML/CSS/JS) ומתחבר ל-Firebase. אין צורך בשרת.

---

## מבנה הקבצים
```
ibca-cert-app/
├── index.html              ← הדף הראשי
├── css/styles.css          ← עיצוב
├── js/firebase-config.js   ← *** למילוי: הגדרות Firebase ***
├── js/config.js            ← הגדרות: מנהלים, תבניות, רשימת העלאות, טפסים
├── js/app.js               ← הקוד של האפליקציה
├── templates/              ← קבצי ה-Word להורדה
├── firestore.rules         ← כללי גישה לנתונים
└── storage.rules           ← כללי גישה לקבצים
```

---

## חלק א׳ — הקמת Firebase (פעם אחת)

1. כניסה ל-https://console.firebase.google.com והתחברות עם חשבון Google.
2. **Add project** → תנו שם (למשל `ibca-certification`) → המשך (אפשר לבטל Analytics) → Create.

### 1. הפעלת התחברות במייל
- בתפריט הצד: **Build → Authentication → Get started**.
- בלשונית **Sign-in method**: בחרו **Email/Password**, הפעילו את האפשרות **Email link (passwordless sign-in)**, ושמרו.

### 2. יצירת מסד נתונים
- **Build → Firestore Database → Create database** → בחרו אזור (למשל `europe-west`) → התחילו במצב **Production**.

### 3. הפעלת אחסון קבצים
- **Build → Storage → Get started** → אשרו → בחרו אותו אזור.

### 4. רישום אפליקציית Web והעתקת ההגדרות
- בגלגל השיניים (למעלה משמאל) → **Project settings**.
- בחלק **Your apps** לחצו על סמל ה-Web `</>`, תנו כינוי, ולחצו **Register app**.
- יוצג בלוק קוד עם `firebaseConfig`. העתיקו את הערכים אל הקובץ `js/firebase-config.js` במקום ה-`XXXX`.

---

## חלק ב׳ — הדבקת כללי האבטחה

1. **Firestore Database → לשונית Rules**: מחקו את התוכן, הדביקו את כל התוכן מהקובץ `firestore.rules`, ולחצו **Publish**.
2. **Storage → לשונית Rules**: הדביקו את התוכן מהקובץ `storage.rules`, ולחצו **Publish**.

> חשוב: בשני הקבצים האלה, וגם בקובץ `js/config.js`, מופיעה כתובת המייל `jude@excelleader.co.il` כמנהלת. כדי להוסיף חברי ועדה נוספים, הוסיפו את כתובות המייל שלהם בשלושת המקומות (שורות `request.auth.token.email in [...]` בשני קבצי ה-rules, ו-`adminEmails` ב-config.js).

---

## חלק ג׳ — העלאת האפליקציה לאוויר (GitHub Pages)

1. כניסה ל-https://github.com → **New repository** → שם למשל `ibca-cert-app` → Public → Create.
2. בעמוד הריפוזיטורי: **Add file → Upload files**, גררו את כל התוכן של תיקיית `ibca-cert-app` (כולל התיקיות css/js/templates), ולחצו **Commit changes**.
3. **Settings → Pages** → תחת Source בחרו **Deploy from a branch**, ענף `main`, תיקייה `/ (root)` → Save.
4. אחרי דקה-שתיים יופיע הקישור, בצורה: `https://<שם-המשתמש>.github.io/ibca-cert-app/`.

### לאשר את הכתובת ב-Firebase (חשוב להתחברות)
- חזרה ל-Firebase: **Authentication → Settings → Authorized domains → Add domain**.
- הוסיפו את הדומיין `<שם-המשתמש>.github.io`.

> חלופה: אפשר גם לארח דרך Firebase Hosting (דורש התקנת כלי שורת פקודה). GitHub Pages פשוט יותר ולא דורש התקנות.

---

## חלק ד׳ — בדיקה
1. פתחו את הקישור של GitHub Pages.
2. הזינו את כתובת המייל שלכם → קבלו קישור במייל → לחצו עליו → אתם בפנים.
3. נסו: למלא ולחתום על כתב ההתחייבות, להוריד תבנית, ולהעלות קובץ.
4. התחברו עם המייל של הלשכה (המוגדר כמנהל) ובדקו שמסך הוועדה מציג את המשתתפים.

---

## איך זה עובד מבחינת אחסון
- הנתונים נשמרים ב-Firestore תחת `participants/<מזהה המשתמש>`.
- הקבצים והחתימות נשמרים ב-Storage תחת `participants/<מזהה המשתמש>/`.
- כל משתתף ניגש רק לתיקייה שלו; חברי הוועדה ניגשים להכול.

## העברה ל-SharePoint בהמשך
ניתן להוריד את הקבצים של כל משתתף מתוך Firebase Storage (דרך ה-Console או דוח שאפשר להפיק) ולהעלות אותם לתיקיית המשתתף ב-SharePoint של הוועדה. בשלב מאוחר יותר אפשר להוסיף סנכרון אוטומטי, אך הוא דורש הרשאות מנהל ב-Microsoft 365.

## עריכות נפוצות (בלי ידע בתכנות)
כל אלה בקובץ `js/config.js`:
- **הוספת/הסרת תבנית להורדה** — ערכו את הרשימה `templates` (ושימו את קובץ ה-Word בתיקיית `templates/`).
- **שינוי רשימת המסמכים להעלאה** — ערכו את `requiredUploads`.
- **שינוי נוסח כתב ההתחייבות** — ערכו את `forms`.
