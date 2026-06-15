/* =====================================================================
   אפליקציית הסמכת קוד המקצוע — לוגיקה ראשית
   ===================================================================== */
(function () {
  "use strict";

  var appEl = document.getElementById("app");
  var userBox = document.getElementById("userBox");
  var userEmailEl = document.getElementById("userEmail");
  var CFG = window.APP_CONFIG;

  var auth = null, db = null, storage = null, currentUser = null, participantData = {};

  /* ---------- utilities ---------- */
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function isAdmin(email){ return email && CFG.adminEmails.map(function(e){return e.toLowerCase();}).indexOf(email.toLowerCase()) !== -1; }
  function setHTML(html){ appEl.innerHTML = html; }
  function go(hash){ location.hash = hash; }
  function fmtDate(ts){ try{ var d = ts && ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } }
  function toast(msg, kind){ var d=document.createElement("div"); d.className="alert alert-"+(kind||"info"); d.style.position="fixed"; d.style.bottom="20px"; d.style.left="50%"; d.style.transform="translateX(-50%)"; d.style.zIndex="9999"; d.style.boxShadow="0 4px 16px rgba(0,0,0,.2)"; d.textContent=msg; document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 3500); }

  /* ---------- Firebase init ---------- */
  function configMissing(){ return !window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "XXXX"; }

  function init(){
    if (configMissing()){
      setHTML('<div class="card"><h1>האפליקציה עדיין לא חוברה ל-Firebase</h1>'+
        '<p class="lead">כדי להפעיל, יש למלא את הקובץ <code>js/firebase-config.js</code> בערכים מפרויקט ה-Firebase של הלשכה.</p>'+
        '<p>הוראות מלאות נמצאות בקובץ <strong>README-הוראות-התקנה.md</strong>.</p></div>');
      return;
    }
    firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth(); db = firebase.firestore(); storage = firebase.storage();

    // השלמת התחברות מקישור מייל
    if (auth.isSignInWithEmailLink(window.location.href)){
      var email = window.localStorage.getItem("emailForSignIn");
      if (!email){ email = window.prompt("לאישור ההתחברות, הזינו שוב את כתובת המייל:"); }
      setHTML('<div class="loading">מתחבר…</div>');
      auth.signInWithEmailLink(email, window.location.href).then(function(){
        window.localStorage.removeItem("emailForSignIn");
        history.replaceState(null, "", window.location.pathname);
      }).catch(function(err){
        setHTML('<div class="card"><div class="alert alert-err">ההתחברות נכשלה: '+esc(err.message)+'</div>'+
          '<button class="btn btn-primary" onclick="location.href=location.pathname">לניסיון נוסף</button></div>');
      });
    }

    auth.onAuthStateChanged(function(user){
      currentUser = user;
      if (user){
        userBox.hidden = false; userEmailEl.textContent = user.email;
        ensureParticipant(user).then(route);
      } else {
        userBox.hidden = true; renderLogin();
      }
    });
    window.addEventListener("hashchange", function(){ if (currentUser) route(); });
  }

  function genProcessNumber(uid){ return "CISBC-" + (new Date().getFullYear()) + "-" + String(uid).slice(-5).toUpperCase(); }

  function ensureParticipant(user){
    var ref = db.collection("participants").doc(user.uid);
    return ref.get().then(function(snap){
      participantData = snap.exists ? (snap.data() || {}) : {};
      var upd = { email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (!participantData.processNumber){ participantData.processNumber = genProcessNumber(user.uid); upd.processNumber = participantData.processNumber; }
      return ref.set(upd, { merge: true });
    }).catch(function(){});
  }

  /* ---------- login ---------- */
  function renderLogin(){
    setHTML(
      '<div class="login-wrap"><div class="card">'+
      '<div class="login-logo">🏅</div>'+
      '<h1>הסמכת קוד המקצוע</h1>'+
      '<p class="lead">הזינו את כתובת המייל שלכם ונשלח אליכם קישור התחברות. אין צורך בסיסמה.</p>'+
      '<div class="field"><label for="email">כתובת מייל</label>'+
      '<input id="email" type="email" placeholder="name@example.com" autocomplete="email" /></div>'+
      '<button id="sendLink" class="btn btn-primary" style="width:100%">שליחת קישור התחברות</button>'+
      '<div id="loginMsg"></div>'+
      '</div></div>'
    );
    var btn = document.getElementById("sendLink");
    var input = document.getElementById("email");
    var msg = document.getElementById("loginMsg");
    function send(){
      var email = (input.value || "").trim();
      if (!email || email.indexOf("@") === -1){ msg.innerHTML = '<div class="alert alert-err">נא להזין כתובת מייל תקינה.</div>'; return; }
      btn.disabled = true; btn.textContent = "שולח…";
      var settings = { url: window.location.origin + window.location.pathname, handleCodeInApp: true };
      auth.sendSignInLinkToEmail(email, settings).then(function(){
        window.localStorage.setItem("emailForSignIn", email);
        msg.innerHTML = '<div class="alert alert-ok">נשלח קישור התחברות אל <strong>'+esc(email)+'</strong>. בדקו את תיבת המייל (גם בתיקיית הספאם) ולחצו על הקישור.</div>';
      }).catch(function(err){
        btn.disabled = false; btn.textContent = "שליחת קישור התחברות";
        msg.innerHTML = '<div class="alert alert-err">שגיאה בשליחה: '+esc(err.message)+'</div>';
      });
    }
    btn.onclick = send;
    input.addEventListener("keydown", function(e){ if (e.key === "Enter") send(); });
  }

  document.getElementById("logoutBtn").onclick = function(){ if (auth) auth.signOut().then(function(){ go(""); }); };

  /* ---------- router ---------- */
  function route(){
    var h = location.hash.replace(/^#\/?/, "");
    if (h.indexOf("form/") === 0) return viewForm(h.split("/")[1]);
    if (h === "templates") return viewTemplates();
    if (h === "upload") return viewUpload();
    if (h === "admin") return isAdmin(currentUser.email) ? viewAdmin() : viewDashboard();
    return viewDashboard();
  }
  function backLink(){ return '<a class="back" href="#/">→ חזרה לעמוד הראשי</a>'; }
  function procNumberBlock(){ return '<div class="field"><label>מספר תהליך (מלווה אתכם לאורך התהליך, ויהפוך למספר ההסמכה עם קבלת התעודה)</label><div style="font-weight:700;color:#1F3864;font-size:18px">'+esc(participantData.processNumber||"")+'</div></div>'; }

  /* ---------- dashboard ---------- */
  function viewDashboard(){
    setHTML('<div class="loading">טוען…</div>');
    var uid = currentUser.uid;
    Promise.all([
      db.collection("participants").doc(uid).collection("forms").get(),
      db.collection("participants").doc(uid).collection("uploads").get()
    ]).then(function(res){
      var doneForms = {}; res[0].forEach(function(d){ doneForms[d.id] = d.data(); });
      var uploadsByItem = {}; res[1].forEach(function(d){ var u=d.data(); (uploadsByItem[u.itemId]=uploadsByItem[u.itemId]||[]).push(u); });

      var totalItems = CFG.forms.length + CFG.requiredUploads.length;
      var doneCount = Object.keys(doneForms).length + CFG.requiredUploads.filter(function(it){ return uploadsByItem[it.id]; }).length;
      var pct = totalItems ? Math.round(doneCount/totalItems*100) : 0;

      var html = '<h1>שלום, '+esc(currentUser.email)+'</h1>'+
        '<p class="lead">זהו המרחב האישי שלכם בתהליך ההסמכה. כאן ממלאים, מורידים ומעלים את המסמכים הנדרשים.</p>'+
        '<div class="card" style="padding:12px 16px"><span class="muted">מספר תהליך:</span> <strong style="color:var(--navy)">'+esc(participantData.processNumber||"")+'</strong> '+
        '<span class="muted" style="font-size:12px">(מלווה אתכם לאורך התהליך, ויהפוך למספר ההסמכה עם קבלת התעודה)</span></div>';

      if (isAdmin(currentUser.email)){
        html += '<div class="alert alert-info">יש לך גישת ניהול. <a href="#/admin">למסך הוועדה ←</a></div>';
      }

      html += '<div class="card"><h3>התקדמות אישית</h3><div class="progress"><span style="width:'+pct+'%"></span></div>'+
        '<div class="muted">'+doneCount+' מתוך '+totalItems+' פריטים הושלמו</div></div>';

      html += '<div class="grid">'+
        tile("#/form/declaration","✍️","מילוי וחתימה","למלא ולחתום על כתב ההתחייבות")+
        tile("#/templates","⬇️","הורדת תבניות","להוריד את המסמכים למילוי")+
        tile("#/upload","⬆️","העלאת מסמכים","להעלות את הקבצים הנדרשים")+
        '</div>';

      // checklist
      html += '<div class="card"><h2 style="margin-top:0">רשימת המשימות שלי</h2>';
      CFG.forms.forEach(function(f){
        var done = !!doneForms[f.id];
        html += itemRow(f.title, "טופס למילוי וחתימה באפליקציה", done, done?("נחתם "+fmtDate(doneForms[f.id].submittedAt)) : null, "#/form/"+f.id, done?"לצפייה/עריכה":"למילוי");
      });
      CFG.requiredUploads.forEach(function(it){
        var arr = uploadsByItem[it.id]; var done = !!arr;
        html += itemRow(it.title, it.desc, done, done?(arr.length+" קבצים הועלו"):null, "#/upload", done?"לניהול":"להעלאה");
      });
      html += '</div>';

      setHTML(html);
    }).catch(function(err){ setHTML('<div class="card"><div class="alert alert-err">שגיאה בטעינה: '+esc(err.message)+'</div></div>'); });
  }
  function tile(href,ic,t,d){ return '<a class="tile" href="'+href+'"><div class="tile-ic">'+ic+'</div><div class="tile-t">'+esc(t)+'</div><div class="tile-d">'+esc(d)+'</div></a>'; }
  function itemRow(title, desc, done, sub, href, action){
    return '<div class="item-row"><div class="item-main"><span class="dot '+(done?"dot-done":"dot-missing")+'"></span>'+
      '<div><div class="item-title">'+esc(title)+'</div><div class="item-desc">'+esc(sub||desc)+'</div></div></div>'+
      '<div><span class="badge '+(done?"badge-done":"badge-missing")+'">'+(done?"הושלם":"חסר")+'</span> '+
      '<a class="btn btn-sm btn-outline" href="'+href+'">'+esc(action)+'</a></div></div>';
  }

  /* ---------- templates ---------- */
  function viewTemplates(){
    var html = backLink()+'<h1>הורדת תבניות</h1><p class="lead">הורידו את המסמכים, מלאו אותם, וחזרו להעלות במסך "העלאת מסמכים".</p><div class="card">';
    CFG.templates.forEach(function(t){
      var href = "templates/" + encodeURIComponent(t.file);
      html += '<div class="file-row"><div><div class="file-name">'+esc(t.title)+'</div><div class="item-desc">'+esc(t.desc)+'</div></div>'+
        '<a class="btn btn-sm btn-gold" href="'+href+'" download>הורדה</a></div>';
    });
    html += '</div>';
    setHTML(html);
  }

  /* ---------- form (declaration) ---------- */
  function viewForm(formId){
    var form = CFG.forms.filter(function(f){ return f.id===formId; })[0];
    if (!form){ return viewDashboard(); }
    var ref = db.collection("participants").doc(currentUser.uid).collection("forms").doc(formId);
    setHTML('<div class="loading">טוען…</div>');
    ref.get().then(function(snap){
      var existing = snap.exists ? snap.data() : null;
      renderForm(form, ref, existing);
    }).catch(function(err){
      setHTML(backLink()+'<div class="card"><div class="alert alert-err">שגיאה בטעינת הטופס: '+esc(err.message)+'</div></div>');
    });
  }

  function renderForm(form, ref, existing){
    if (form.items) return renderItemsForm(form, ref, existing);
    var html = backLink()+'<h1>'+esc(form.title)+'</h1><p class="lead">'+esc(form.subtitle||"")+'</p>';
    if (existing){ html += '<div class="alert alert-ok">הטופס כבר נחתם ב-'+fmtDate(existing.submittedAt)+'. ניתן לצפות, להדפיס, או למלא מחדש.</div>'; }
    html += '<div class="card">';
    html += procNumberBlock();
    html += '<p>'+esc(form.intro)+'</p>';
    (form.fields||[]).forEach(function(fld){
      var val = existing && existing.data ? (existing.data[fld.id]||"") : "";
      html += '<div class="field"><label>'+esc(fld.label)+(fld.required?' *':'')+'</label>'+
        '<input id="fld_'+fld.id+'" type="'+(fld.type||"text")+'" value="'+esc(val)+'" /></div>';
    });
    if (form.commitments){
      html += '<h3>ההתחייבויות</h3><ol class="commit">';
      form.commitments.forEach(function(c){ html += '<li>'+esc(c)+'</li>'; });
      html += '</ol>';
    }
    if (form.closing){ html += '<p class="muted">'+esc(form.closing)+'</p>'; }
    var checked = existing ? "checked" : "";
    html += '<div class="field"><label><input type="checkbox" id="confirmChk" '+checked+' /> '+esc(form.confirmText||"קראתי ואני מאשר/ת")+'</label></div>';

    if (form.requireSignature){
      html += '<h3>חתימה</h3><div class="muted">חִתמו בעזרת העכבר או האצבע במסגרת:</div>'+
        '<div class="sig-wrap"><canvas id="sig" class="sig-canvas"></canvas></div>'+
        '<div class="sig-actions"><button class="btn btn-sm btn-outline" id="sigClear">ניקוי חתימה</button></div>';
      if (existing && existing.signatureUrl){ html += '<div class="muted" style="margin-top:8px">חתימה קיימת:</div><img src="'+esc(existing.signatureUrl)+'" alt="חתימה" style="max-height:90px;border:1px solid var(--line);border-radius:8px"/>'; }
    }
    html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">'+
      '<button class="btn btn-primary" id="submitForm">שמירה וחתימה</button>'+
      (existing?'<button class="btn btn-outline no-print" id="printForm">הדפסה / שמירה כ-PDF</button>':'')+
      '</div><div id="formMsg"></div></div>';
    setHTML(html);

    var pad = form.requireSignature ? new SigPad(document.getElementById("sig")) : null;
    if (document.getElementById("sigClear")) document.getElementById("sigClear").onclick = function(){ pad.clear(); };
    if (document.getElementById("printForm")) document.getElementById("printForm").onclick = function(){ window.print(); };

    document.getElementById("submitForm").onclick = function(){
      var msg = document.getElementById("formMsg");
      var data = {}, ok = true;
      (form.fields||[]).forEach(function(fld){
        var v = (document.getElementById("fld_"+fld.id).value||"").trim();
        if (fld.required && !v) ok = false;
        data[fld.id] = v;
      });
      if (!ok){ msg.innerHTML = '<div class="alert alert-err">נא למלא את כל השדות המסומנים בכוכבית.</div>'; return; }
      if (!document.getElementById("confirmChk").checked){ msg.innerHTML = '<div class="alert alert-err">יש לאשר את ההתחייבות לפני השמירה.</div>'; return; }
      var sigData = null;
      if (form.requireSignature){
        if (pad.isEmpty() && !(existing && existing.signatureUrl)){ msg.innerHTML = '<div class="alert alert-err">נדרשת חתימה.</div>'; return; }
        if (!pad.isEmpty()) sigData = pad.toDataURL();
      }
      var btn = document.getElementById("submitForm"); btn.disabled = true; btn.textContent = "שומר…";

      var save = function(signatureUrl){
        var rec = { formTitle: form.title, data: data, confirmed: true, processNumber: participantData.processNumber || null, submittedAt: firebase.firestore.FieldValue.serverTimestamp(), email: currentUser.email };
        if (signatureUrl) rec.signatureUrl = signatureUrl;
        else if (existing && existing.signatureUrl) rec.signatureUrl = existing.signatureUrl;
        ref.set(rec, { merge: true }).then(function(){
          db.collection("participants").doc(currentUser.uid).set({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
          toast("נשמר בהצלחה", "ok"); go("");
        }).catch(function(err){ btn.disabled=false; btn.textContent="שמירה וחתימה"; msg.innerHTML='<div class="alert alert-err">'+esc(err.message)+'</div>'; });
      };

      if (sigData){
        var path = "participants/"+currentUser.uid+"/signatures/"+form.id+".png";
        storage.ref(path).putString(sigData, "data_url").then(function(s){ return s.ref.getDownloadURL(); })
          .then(save)
          .catch(function(err){ btn.disabled=false; btn.textContent="שמירה וחתימה"; msg.innerHTML='<div class="alert alert-err">שגיאת חתימה: '+esc(err.message)+'</div>'; });
      } else { save(null); }
    };
  }

  /* ---------- items-based form (self-assessments) ---------- */
  function renderItemsForm(form, ref, existing){
    var data = (existing && existing.data) || {};
    var html = backLink()+'<h1>'+esc(form.title)+'</h1><p class="lead">'+esc(form.subtitle||"")+'</p>';
    if (existing){ html += '<div class="alert alert-ok">הטופס נשמר ב-'+fmtDate(existing.submittedAt)+'. ניתן לעדכן ולשמור מחדש.</div>'; }
    html += '<div class="card">';
    html += procNumberBlock();
    form.items.forEach(function(it){
      var v = data[it.id];
      if (it.type==='section'){ html += (it.level===3?'<h3>':'<h2>')+esc(it.label)+(it.level===3?'</h3>':'</h2>'); }
      else if (it.type==='info'){ html += '<div class="alert alert-info" style="white-space:pre-line">'+esc(it.text)+'</div>'; }
      else if (it.type==='statement'){ html += '<div style="margin:4px 0">• '+esc(it.text)+'</div>'; }
      else if (it.type==='text'){ html += '<div class="field"><label>'+esc(it.label)+(it.required?' *':'')+'</label><input type="text" data-fid="'+it.id+'" value="'+esc(v||"")+'"/></div>'; }
      else if (it.type==='textarea'){ html += '<div class="field"><label>'+esc(it.label)+'</label><textarea data-fid="'+it.id+'" rows="3">'+esc(v||"")+'</textarea></div>'; }
      else if (it.type==='rating'){
        var mx=it.max||5, start=it.zero?0:1, o='';
        for (var n=start;n<=mx;n++){ var sel=(String(v)===String(n)); o += '<label class="rating-opt'+(sel?' sel':'')+'"><input type="radio" name="r_'+it.id+'" value="'+n+'"'+(sel?' checked':'')+'/>'+n+'</label>'; }
        html += '<div class="rating-row"><label>'+esc(it.label)+'</label><div class="rating-opts">'+o+'</div></div>';
      }
      else if (it.type==='checkboxes'){
        html += '<div class="field"><label>'+esc(it.label)+'</label><div class="chk-group">';
        var arr = Array.isArray(v)?v:[];
        it.options.forEach(function(opt){ var ck=arr.indexOf(opt)>-1; html += '<label class="chk"><input type="checkbox" data-cg="'+it.id+'" value="'+esc(opt)+'"'+(ck?' checked':'')+'/>'+esc(opt)+'</label>'; });
        html += '</div>';
        if (it.other){ html += '<input type="text" data-fid="'+it.id+'_other" placeholder="אחר / פירוט…" value="'+esc(data[it.id+'_other']||"")+'" style="margin-top:6px"/>'; }
        html += '</div>';
      }
    });
    if (form.confirmText){ html += '<div class="field"><label><input type="checkbox" id="confirmChk" '+(existing?'checked':'')+'/> '+esc(form.confirmText)+'</label></div>'; }
    if (form.requireSignature){
      html += '<h3>חתימה</h3><div class="muted">חִתמו בעזרת העכבר או האצבע:</div><div class="sig-wrap"><canvas id="sig" class="sig-canvas"></canvas></div><div class="sig-actions"><button class="btn btn-sm btn-outline" id="sigClear">ניקוי חתימה</button></div>';
      if (existing && existing.signatureUrl){ html += '<div class="muted" style="margin-top:8px">חתימה קיימת:</div><img src="'+esc(existing.signatureUrl)+'" alt="חתימה" style="max-height:80px;border:1px solid var(--line);border-radius:8px"/>'; }
    }
    html += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" id="submitForm">שמירה'+(form.requireSignature?' וחתימה':'')+'</button>'+(existing?'<button class="btn btn-outline no-print" id="printForm">הדפסה / שמירה כ-PDF</button>':'')+'</div><div id="formMsg"></div></div>';
    setHTML(html);

    Array.prototype.forEach.call(document.querySelectorAll('.rating-opts'), function(grp){
      grp.addEventListener('change', function(){
        Array.prototype.forEach.call(grp.querySelectorAll('.rating-opt'), function(l){ l.classList.toggle('sel', l.querySelector('input').checked); });
      });
    });

    var pad = form.requireSignature ? new SigPad(document.getElementById("sig")) : null;
    if (document.getElementById("sigClear")) document.getElementById("sigClear").onclick = function(){ pad.clear(); };
    if (document.getElementById("printForm")) document.getElementById("printForm").onclick = function(){ window.print(); };

    document.getElementById("submitForm").onclick = function(){
      var msg = document.getElementById("formMsg");
      var out = {}, ok = true, firstMissing = null;
      Array.prototype.forEach.call(document.querySelectorAll('[data-fid]'), function(el){ out[el.getAttribute("data-fid")] = (el.value||"").trim(); });
      form.items.forEach(function(it){
        if (it.type==='checkboxes'){ out[it.id] = Array.prototype.slice.call(document.querySelectorAll('[data-cg="'+it.id+'"]:checked')).map(function(c){return c.value;}); }
        if (it.type==='rating'){ var r=document.querySelector('input[name="r_'+it.id+'"]:checked'); out[it.id] = r?r.value:""; }
        if (it.required && (it.type==='text'||it.type==='textarea') && !out[it.id]){ ok=false; if(!firstMissing) firstMissing=it.label; }
      });
      if (!ok){ msg.innerHTML='<div class="alert alert-err">נא למלא: '+esc(firstMissing)+'</div>'; return; }
      if (form.confirmText && !document.getElementById("confirmChk").checked){ msg.innerHTML='<div class="alert alert-err">יש לאשר את ההצהרה לפני השמירה.</div>'; return; }
      var sigData=null;
      if (form.requireSignature){
        if (pad.isEmpty() && !(existing&&existing.signatureUrl)){ msg.innerHTML='<div class="alert alert-err">נדרשת חתימה.</div>'; return; }
        if (!pad.isEmpty()) sigData=pad.toDataURL();
      }
      var btn=document.getElementById("submitForm"); btn.disabled=true; btn.textContent="שומר…";
      var finish=function(signatureUrl){
        var rec={ formTitle:form.title, data:out, confirmed:true, processNumber: participantData.processNumber || null, submittedAt:firebase.firestore.FieldValue.serverTimestamp(), email:currentUser.email };
        if (signatureUrl) rec.signatureUrl=signatureUrl; else if (existing&&existing.signatureUrl) rec.signatureUrl=existing.signatureUrl;
        ref.set(rec,{merge:true}).then(function(){ db.collection("participants").doc(currentUser.uid).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); toast("נשמר בהצלחה","ok"); go(""); })
          .catch(function(err){ btn.disabled=false; btn.textContent="שמירה"; msg.innerHTML='<div class="alert alert-err">'+esc(err.message)+'</div>'; });
      };
      if (sigData){ var path="participants/"+currentUser.uid+"/signatures/"+form.id+".png"; storage.ref(path).putString(sigData,"data_url").then(function(s){return s.ref.getDownloadURL();}).then(finish).catch(function(err){ btn.disabled=false; btn.textContent="שמירה"; msg.innerHTML='<div class="alert alert-err">שגיאת חתימה: '+esc(err.message)+'</div>'; }); }
      else finish(null);
    };
  }

  /* ---------- signature pad ---------- */
  function SigPad(canvas){
    var ctx = canvas.getContext("2d");
    var drawing = false, dirty = false, last = null;
    function resize(){ var r = canvas.getBoundingClientRect(); var ratio = window.devicePixelRatio||1; canvas.width = r.width*ratio; canvas.height = r.height*ratio; ctx.setTransform(1,0,0,1,0,0); ctx.scale(ratio,ratio); ctx.lineWidth=2.2; ctx.lineCap="round"; ctx.strokeStyle="#16294a"; }
    resize();
    var _rsT; window.addEventListener("resize", function(){ clearTimeout(_rsT); _rsT=setTimeout(resize, 200); });
    function pos(e){ var r=canvas.getBoundingClientRect(); var t=e.touches?e.touches[0]:e; return {x:t.clientX-r.left, y:t.clientY-r.top}; }
    function start(e){ drawing=true; dirty=true; last=pos(e); e.preventDefault(); }
    function move(e){ if(!drawing) return; var p=pos(e); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; e.preventDefault(); }
    function end(){ drawing=false; }
    canvas.addEventListener("mousedown",start); canvas.addEventListener("mousemove",move); window.addEventListener("mouseup",end);
    canvas.addEventListener("touchstart",start,{passive:false}); canvas.addEventListener("touchmove",move,{passive:false}); canvas.addEventListener("touchend",end);
    this.clear=function(){ ctx.clearRect(0,0,canvas.width,canvas.height); dirty=false; };
    this.isEmpty=function(){ return !dirty; };
    this.toDataURL=function(){ return canvas.toDataURL("image/png"); };
  }

  /* ---------- upload ---------- */
  function viewUpload(){
    setHTML('<div class="loading">טוען…</div>');
    var col = db.collection("participants").doc(currentUser.uid).collection("uploads");
    col.get().then(function(snap){
      var byItem = {}; snap.forEach(function(d){ var u=d.data(); u._id=d.id; (byItem[u.itemId]=byItem[u.itemId]||[]).push(u); });
      var html = backLink()+'<h1>העלאת מסמכים</h1><p class="lead">העלו את הקבצים הנדרשים. ניתן להעלות מספר קבצים לכל פריט (PDF, Word, תמונה).</p>';
      CFG.requiredUploads.forEach(function(it){
        var arr = byItem[it.id]||[];
        html += '<div class="card"><div class="item-row" style="padding-top:0">'+
          '<div class="item-main"><span class="dot '+(arr.length?"dot-done":"dot-missing")+'"></span>'+
          '<div><div class="item-title">'+esc(it.title)+'</div><div class="item-desc">'+esc(it.desc)+'</div></div></div>'+
          '<label class="btn btn-sm btn-gold">העלאת קובץ<input type="file" data-item="'+it.id+'" hidden></label></div>';
        if (arr.length){ html += '<div style="margin-top:8px">'; arr.forEach(function(u){
          html += '<div class="file-row"><a class="file-name" href="'+esc(u.url)+'" target="_blank">'+esc(u.fileName)+'</a>'+
            '<button class="btn btn-sm btn-outline" data-del="'+u._id+'" data-path="'+esc(u.path)+'">מחיקה</button></div>';
        }); html += '</div>'; }
        html += '<div class="upmsg" data-msg="'+it.id+'"></div></div>';
      });
      setHTML(html);

      Array.prototype.forEach.call(document.querySelectorAll('input[type=file]'), function(inp){
        inp.onchange = function(){ if (inp.files[0]) { doUpload(inp.getAttribute("data-item"), inp.files[0]); inp.value=""; } };
      });
      Array.prototype.forEach.call(document.querySelectorAll('button[data-del]'), function(b){
        b.onclick = function(){ if (confirm("למחוק את הקובץ?")) doDelete(b.getAttribute("data-del"), b.getAttribute("data-path")); };
      });
    }).catch(function(err){ setHTML(backLink()+'<div class="card"><div class="alert alert-err">שגיאה בטעינה: '+esc(err.message)+'</div></div>'); });
  }
  function doUpload(itemId, file){
    var msg = document.querySelector('.upmsg[data-msg="'+itemId+'"]');
    msg.innerHTML = '<div class="alert alert-info">מעלה… 0%</div>';
    var path = "participants/"+currentUser.uid+"/uploads/"+itemId+"/"+Date.now()+"_"+file.name;
    var task = storage.ref(path).put(file);
    task.on("state_changed", function(s){ var p=Math.round(s.bytesTransferred/s.totalBytes*100); msg.innerHTML='<div class="alert alert-info">מעלה… '+p+'%</div>'; },
      function(err){ msg.innerHTML='<div class="alert alert-err">'+esc(err.message)+'</div>'; },
      function(){ task.snapshot.ref.getDownloadURL().then(function(url){
        return db.collection("participants").doc(currentUser.uid).collection("uploads").add({
          itemId:itemId, fileName:file.name, path:path, url:url, size:file.size, uploadedAt:firebase.firestore.FieldValue.serverTimestamp(), email:currentUser.email
        });
      }).then(function(){ db.collection("participants").doc(currentUser.uid).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); toast("הקובץ הועלה","ok"); viewUpload(); })
        .catch(function(err){ msg.innerHTML='<div class="alert alert-err">העלאה נכשלה: '+esc(err.message)+'</div>'; }); });
  }
  function doDelete(docId, path){
    storage.ref(path).delete().catch(function(){}).then(function(){
      return db.collection("participants").doc(currentUser.uid).collection("uploads").doc(docId).delete();
    }).then(function(){ toast("נמחק","ok"); viewUpload(); });
  }

  /* ---------- admin ---------- */
  function viewAdmin(){
    setHTML('<div class="loading">טוען נתוני משתתפים…</div>');
    db.collection("participants").get().then(function(snap){
      var parts = []; snap.forEach(function(d){ parts.push({uid:d.id, data:d.data()}); });
      if (!parts.length){ setHTML(backLink()+'<h1>מסך הוועדה</h1><div class="card"><div class="alert alert-info">אין עדיין משתתפים רשומים.</div></div>'); return; }
      return Promise.all(parts.map(function(p){
        return Promise.all([
          db.collection("participants").doc(p.uid).collection("forms").get(),
          db.collection("participants").doc(p.uid).collection("uploads").get()
        ]).then(function(r){
          p.forms = {}; r[0].forEach(function(d){ p.forms[d.id] = d.data(); });
          p.uploads = {}; r[1].forEach(function(d){ var u = d.data(); (p.uploads[u.itemId] = p.uploads[u.itemId] || []).push(u); });
          return p;
        });
      })).then(renderAdmin);
    }).catch(function(err){ setHTML(backLink()+'<div class="card"><div class="alert alert-err">שגיאה בטעינה (ודאו שכתובת המייל מוגדרת כמנהל בכללי האבטחה): '+esc(err.message)+'</div></div>'); });
  }

  function renderAdmin(parts){
    var totalItems = CFG.forms.length + CFG.requiredUploads.length;
    function doneCount(p){ var c=0; CFG.forms.forEach(function(f){ if(p.forms[f.id]) c++; }); CFG.requiredUploads.forEach(function(it){ if(p.uploads[it.id]) c++; }); return c; }
    var fullyDone = parts.filter(function(p){ return doneCount(p)===totalItems; }).length;

    var html = backLink()+'<h1>מסך הוועדה</h1>'+
      '<p class="lead">'+parts.length+' משתתפים · '+fullyDone+' השלימו את כל הפריטים.</p>';

    // ----- overview matrix: who submitted what -----
    var okC = '<span style="color:#2E7D32;font-weight:700">✓</span>';
    function xC(){ return '<span style="color:#C0392B">✗</span>'; }
    html += '<div class="card"><h2 style="margin-top:0">סטטוס כללי — מי הגיש מה</h2><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>משתתף</th>';
    CFG.forms.forEach(function(f){ html += '<th style="text-align:center">'+esc(f.short||f.title)+'</th>'; });
    CFG.requiredUploads.forEach(function(it){ html += '<th style="text-align:center">'+esc(it.short||it.title)+'</th>'; });
    html += '<th style="text-align:center">הושלם</th></tr></thead><tbody>';
    parts.forEach(function(p){
      html += '<tr><td style="white-space:nowrap">'+esc(p.data.email||p.uid)+'</td>';
      CFG.forms.forEach(function(f){ html += '<td style="text-align:center">'+(p.forms[f.id]?okC:xC())+'</td>'; });
      CFG.requiredUploads.forEach(function(it){ var n=(p.uploads[it.id]||[]).length; html += '<td style="text-align:center">'+(n?(okC+(n>1?' '+n:'')):xC())+'</td>'; });
      html += '<td style="text-align:center;white-space:nowrap">'+doneCount(p)+'/'+totalItems+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ----- per-participant detail with file links -----
    html += '<h2>פירוט וקבצים לכל משתתף</h2>';
    parts.forEach(function(p){
      html += '<div class="card"><h3 style="margin-top:0">'+esc(p.data.email||p.uid)+'</h3>'+
        '<div class="muted">מספר תהליך: '+esc(p.data.processNumber||'—')+' · עודכן: '+fmtDate(p.data.updatedAt)+' · הושלמו '+doneCount(p)+'/'+totalItems+'</div>'+
        '<table class="tbl"><tr><th>פריט</th><th>סטטוס</th><th>קבצים</th></tr>';
      CFG.forms.forEach(function(f){ var fd=p.forms[f.id];
        html += '<tr><td>'+esc(f.title)+'</td><td>'+(fd?'<span class="badge badge-done">נחתם '+fmtDate(fd.submittedAt)+'</span>':'<span class="badge badge-missing">חסר</span>')+'</td><td>'+(fd&&fd.signatureUrl?'<a href="'+esc(fd.signatureUrl)+'" target="_blank">צפייה בחתימה</a>':'')+'</td></tr>';
      });
      CFG.requiredUploads.forEach(function(it){ var arr=p.uploads[it.id]||[];
        var links=arr.map(function(u){ return '<a href="'+esc(u.url)+'" target="_blank">'+esc(u.fileName)+'</a>'; }).join('<br>');
        html += '<tr><td>'+esc(it.title)+'</td><td>'+(arr.length?'<span class="badge badge-done">'+arr.length+' קבצים</span>':'<span class="badge badge-missing">חסר</span>')+'</td><td>'+links+'</td></tr>';
      });
      html += '</table></div>';
    });

    setHTML(html);
  }

  init();
})();
