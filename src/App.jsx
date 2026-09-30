import { useState, useEffect } from "react";
import schemes from "./schemes.json";
import T from "./i18n";
import "./App.css";

// [code, label, speech-language]. Add a language here after adding it in i18n.js
const LANGS = [
  ["en", "English", "en-IN"],
  ["hi", "हिन्दी", "hi-IN"],
  ["gu", "ગુજરાતી", "gu-IN"],
  ["pa", "ਪੰਜਾਬੀ", "pa-IN"],
];

// Put your real contact email here to show a "Report wrong information" link. Leave "" to hide it.
const CONTACT_EMAIL = "";

// Falls back to English when a scheme has no text in the chosen language yet
const tr = (o, l) => (o && (o[l] || o.en)) || "";

const YN = [["yes", "yes"], ["no", "no"]];
const QUESTIONS = [
  { k: "age", icon: "🎂", label: "age", num: true },
  { k: "gender", icon: "🧑", label: "gender", opts: [["male", "male"], ["female", "female"]] },
  { k: "occupation", icon: "💼", label: "occupation",
    opts: [["farmer", "farmer"], ["labourer", "labourer"], ["student", "student"], ["other", "other"]] },
  { k: "income", icon: "💰", label: "income", num: true },
  { k: "hasLand", icon: "🌾", label: "land", opts: YN },
  { k: "hasPucca", icon: "🏠", label: "house", opts: YN },
  { k: "hasLPG", icon: "🔥", label: "lpg", opts: YN },
];
const ICON = { "pm-kisan": "🌾", "pmjay-ma": "🏥", "pmay-g": "🏠", "e-shram": "👷", pmuy: "🔥" };
const emptyAnswers = Object.fromEntries(QUESTIONS.map((q) => [q.k, ""]));

function isEligible(scheme, a) {
  const e = scheme.eligibility;
  const age = Number(a.age);
  const income = Number(a.income);
  if (e.minAge && age < e.minAge) return false;
  if (e.maxAge && age > e.maxAge) return false;
  if (e.gender && e.gender !== a.gender) return false;
  if (e.occupations && !e.occupations.includes(a.occupation)) return false;
  if (e.maxIncome && income > e.maxIncome) return false;
  if (e.needsLand && a.hasLand !== "yes") return false;
  if (e.noPuccaHouse && a.hasPucca === "yes") return false;
  if (e.noLPG && a.hasLPG === "yes") return false;
  return true;
}

// Age 0-120, income 0 or more. Blank or out-of-range answers are rejected.
function validNumber(key, v) {
  if (v === "" || Number.isNaN(Number(v))) return false;
  const n = Number(v);
  return key === "age" ? n >= 0 && n <= 120 : n >= 0;
}

function shareOnWhatsApp(t) {
  const url = window.location.href.split("#")[0];
  window.open("https://wa.me/?text=" + encodeURIComponent(t.shareText + " " + url), "_blank", "noopener");
}

function speak(text, code) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  window.speechSynthesis.speak(u);
}

function SchemeDetail({ scheme, lang, speech, t, onBack }) {
  const [have, setHave] = useState({});
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const count = Object.values(have).filter(Boolean).length;
  const total = scheme.documents.length;
  const spoken = [
    tr(scheme.name, lang),
    tr(scheme.benefit, lang),
    t.steps,
    ...scheme.steps.map((s, i) => i + 1 + ". " + tr(s, lang)),
  ].join(". ");

  return (
    <div className="page detail">
      <button className="link" onClick={onBack}>← {t.back}</button>
      <div className="detail-head">
        <span className="big-icon">{ICON[scheme.id] || "📄"}</span>
        <h1>{tr(scheme.name, lang)}</h1>
        <p className="benefit">{tr(scheme.benefit, lang)}</p>
        <div className="row">
          <button className="btn light" onClick={() => speak(spoken, speech)}>🔊 {t.listen}</button>
          <button className="btn light" onClick={() => window.speechSynthesis?.cancel()}>⏹ {t.stop}</button>
        </div>
      </div>

      <p className="note-box">ℹ️ {tr(scheme.note, lang)}</p>

      <section className="panel">
        <h3>📑 {t.docs}</h3>
        <div className="bar"><i style={{ width: (count / total) * 100 + "%" }} /></div>
        <p className="count">{count}/{total} {t.ready}</p>
        <ul className="checklist">
          {scheme.documents.map((d, i) => (
            <li key={i}>
              <label className={have[i] ? "done" : ""}>
                <input type="checkbox" checked={!!have[i]}
                  onChange={(e) => setHave({ ...have, [i]: e.target.checked })} />
                <span>{tr(d, lang)}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>🪜 {t.steps}</h3>
        <ol className="steps">
          {scheme.steps.map((s, i) => <li key={i}>{tr(s, lang)}</li>)}
        </ol>
      </section>

      <section className="panel">
        <h3>📍 {t.where}</h3>
        <p>{tr(scheme.where, lang)}</p>
        <a className="btn light" href={"tel:" + scheme.helpline.replace(/[^0-9]/g, "")}>
          📞 {t.helpline}: {scheme.helpline}
        </a>
      </section>

      <p className="fee-box">🚫 {t.noFee}</p>

      <a className="btn" href={scheme.applyUrl} target="_blank" rel="noreferrer">🌐 {t.open}</a>
      <p className="note">{scheme.lastVerified ? `${t.verified}: ${scheme.lastVerified}` : t.notChecked}</p>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("lang");
      return LANGS.some((l) => l[0] === saved) ? saved : "hi";
    } catch { return "hi"; }
  });
  const [view, setView] = useState("home");
  const [i, setI] = useState(0);
  const [a, setA] = useState(emptyAnswers);
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const t = T[lang];
  const speech = LANGS.find((l) => l[0] === lang)[2];
  const q = QUESTIONS[i];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.title;
    try { localStorage.setItem("lang", lang); } catch { /* private mode: ignore */ }
  }, [lang, t.title]);

  function start() { setA(emptyAnswers); setI(0); setView("quiz"); }

  function advance(next) {
    if (i < QUESTIONS.length - 1) { setI(i + 1); return; }
    setResults(schemes.filter((s) => isEligible(s, next)));
    setView("results");
  }

  function choose(val) {
    const next = { ...a, [q.k]: val };
    setA(next);
    advance(next);
  }

  function editAnswers() { setI(0); setView("quiz"); window.scrollTo(0, 0); }

  function goHome() { setView("home"); setPicked(null); window.scrollTo(0, 0); }

  return (
    <div className="site">
      <nav className="nav">
        <button className="brand" onClick={goHome}>
          <span className="logo">🇮🇳</span>
          <span>{t.title}</span>
        </button>
        <div className="langs" role="group" aria-label="Language">
          {LANGS.map(([code, label]) => (
            <button key={code} className={lang === code ? "on" : ""} onClick={() => setLang(code)}>{label}</button>
          ))}
        </div>
      </nav>

      {picked ? (
        <SchemeDetail key={picked.id} scheme={picked} lang={lang} speech={speech} t={t}
          onBack={() => { setPicked(null); window.scrollTo(0, 0); }} />
      ) : view === "home" ? (
        <>
          <header className="hero">
            <div className="hero-in">
              <h1>{t.heroTitle}</h1>
              <p>{t.heroSub}</p>
              <button className="btn cta" onClick={start}>{t.start} →</button>
              <p className="pill">✔ {t.free}</p>
            </div>
          </header>
          <section className="page">
            <h2 className="center">{t.how}</h2>
            <div className="how">
              {[["📝", t.h1], ["🎯", t.h2], ["✅", t.h3]].map(([ic, txt], n) => (
                <div className="how-card" key={n}>
                  <span className="num">{n + 1}</span>
                  <span className="big-icon">{ic}</span>
                  <strong>{txt}</strong>
                </div>
              ))}
            </div>
            <div className="chips">
              {schemes.map((s) => <span key={s.id}>{ICON[s.id]} {tr(s.name, lang)}</span>)}
            </div>
            <p className="trust note">🔒 {t.privacy}</p>
            <button className="btn wa" onClick={() => shareOnWhatsApp(t)}>💬 {t.share}</button>
          </section>
        </>
      ) : view === "quiz" ? (
        <div className="page quiz">
          <div className="bar"><i style={{ width: ((i + 1) / QUESTIONS.length) * 100 + "%" }} /></div>
          <p className="count">{t.q} {i + 1} / {QUESTIONS.length}</p>
          <div className="qcard" key={q.k}>
            <span className="big-icon">{q.icon}</span>
            <h2>{t[q.label]}</h2>
            {q.num ? (
              <>
                <input type="number" inputMode="numeric" min="0" max={q.k === "age" ? 120 : undefined} autoFocus placeholder={q.k === "age" ? t.agePh : "0"}
                  value={a[q.k]} onChange={(e) => setA({ ...a, [q.k]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && validNumber(q.k, a[q.k]) && advance(a)} />
                {a[q.k] !== "" && !validNumber(q.k, a[q.k]) && <p className="err">{t.invalid}</p>}
                <button className="btn" disabled={!validNumber(q.k, a[q.k])} onClick={() => advance(a)}>{t.next} →</button>
              </>
            ) : (
              <div className="choices">
                {q.opts.map(([val, key]) => (
                  <button key={val} className={"choice" + (a[q.k] === val ? " on" : "")}
                    onClick={() => choose(val)}>{t[key]}</button>
                ))}
              </div>
            )}
          </div>
          <button className="link" onClick={() => (i > 0 ? setI(i - 1) : goHome())}>← {t.back}</button>
        </div>
      ) : (
        <div className="page">
          <h2>{t.found} ({results.length})</h2>
          {results.length === 0 && <p className="note-box">{t.none}</p>}
          <div className="grid">
            {results.map((s) => (
              <button key={s.id} className="card" onClick={() => { setPicked(s); window.scrollTo(0, 0); }}>
                <span className="big-icon">{ICON[s.id] || "📄"}</span>
                <strong>{tr(s.name, lang)}</strong>
                <span>{tr(s.benefit, lang)}</span>
                <em>{t.steps} →</em>
              </button>
            ))}
          </div>
          <p className="note">{t.resultNote}</p>
          <button className="btn light" onClick={editAnswers}>{t.edit}</button>
          <button className="btn wa" onClick={() => shareOnWhatsApp(t)}>💬 {t.share}</button>
        </div>
      )}

      <footer>
        <p>{t.notice}</p>
        <p className="fee">{t.noFee}</p>
        {CONTACT_EMAIL && (
          <a className="small-link" style={{ color: "#d6e6dc" }}
            href={"mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(t.title)}>{t.report}</a>
        )}
      </footer>
    </div>
  );
}

