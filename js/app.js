/* =====================================================================
   אפליקציית הסמכת קוד המקצוע — לוגיקה ראשית
   ===================================================================== */
(function () {
  "use strict";

  var appEl = document.getElementById("app");
  var userBox = document.getElementById("userBox");
  var userEmailEl = document.getElementById("userEmail");
  var CFG = window.APP_CONFIG;

  var auth = null, db = null, storage = null, currentUser = null;

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

  function ensureParticipant(user){
    var ref = db.collection("participants").doc(user.uid);
    return ref.set({ email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch(function(){});
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
        '<p class="lead">זהו המרחב האישי שלכם בתהליך ההסמכה. כאן ממלאים, מורידים ומעלים את המסמכים הנדרשים.</p>';

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
    var html = backLink()+'<h1>'+esc(form.title)+'</h1><p class="lead">'+esc(form.subtitle||"")+'</p>';
    if (existing){ html += '<div class="alert alert-ok">הטופס כבר נחתם ב-'+fmtDate(existing.submittedAt)+'. ניתן לצפות, להדפיס, או למלא מחדש.</div>'; }
    html += '<div class="card">';
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
        var rec = { formTitle: form.title, data: data, confirmed: true, submittedAt: firebase.firestore.FieldValue.serverTimestamp(), email: currentUser.email };
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
      var html = backLink()+'<h1>מסך הוועדה</h1><p class="lead">'+parts.length+' משתתפים רשומים.</p>';
      if (!parts.length){ setHTML(html+'<div class="card"><div class="alert alert-info">אין עדיין משתתפים.</div></div>'); return; }
      html += '<div id="adminList"></div>';
      setHTML(html);
      var list = document.getElementById("adminList");
      parts.forEach(function(p){
        var card = document.createElement("div"); card.className="card";
        card.innerHTML = '<h3 style="margin-top:0">'+esc(p.data.email||p.uid)+'</h3><div class="muted">עודכן: '+fmtDate(p.data.updatedAt)+'</div><div class="muted">טוען מסמכים…</div>';
        list.appendChild(card);
        Promise.all([
          db.collection("participants").doc(p.uid).collection("forms").get(),
          db.collection("participants").doc(p.uid).collection("uploads").get()
        ]).then(function(r){
          var h = '<h3 style="margin-top:0">'+esc(p.data.email||p.uid)+'</h3><div class="muted">עודכן: '+fmtDate(p.data.updatedAt)+'</div>';
          h += '<table class="tbl"><tr><th>פריט</th><th>סטטוס</th><th></th></tr>';
          var forms = {}; r[0].forEach(function(d){ forms[d.id]=d.data(); });
          CFG.forms.forEach(function(f){ var fd=forms[f.id]; h += '<tr><td>'+esc(f.title)+'</td><td>'+(fd?'<span class="badge badge-done">נחתם</span>':'<span class="badge badge-missing">חסר</span>')+'</td><td>'+(fd&&fd.signatureUrl?'<a href="'+esc(fd.signatureUrl)+'" target="_blank">חתימה</a>':'')+'</td></tr>'; });
          var ups = {}; r[1].forEach(function(d){ var u=d.data(); (ups[u.itemId]=ups[u.itemId]||[]).push(u); });
          CFG.requiredUploads.forEach(function(it){ var arr=ups[it.id]||[]; var links=arr.map(function(u){return '<a href="'+esc(u.url)+'" target="_blank">'+esc(u.fileName)+'</a>';}).join("<br>"); h += '<tr><td>'+esc(it.title)+'</td><td>'+(arr.length?'<span class="badge badge-done">'+arr.length+'</span>':'<span class="badge badge-missing">חסר</span>')+'</td><td>'+links+'</td></tr>'; });
          h += '</table>';
          card.innerHTML = h;
        }).catch(function(err){ card.innerHTML = '<h3 style="margin-top:0">'+esc(p.data.email||p.uid)+'</h3><div class="alert alert-err">שגיאה בטעינת מסמכים: '+esc(err.message)+'</div>'; });
      });
    }).catch(function(err){ setHTML('<div class="card"><div class="alert alert-err">שגיאה (ודאו שכתובת המייל מוגדרת כמנהל בכללי האבטחה): '+esc(err.message)+'</div></div>'); });
  }

  init();
})();
