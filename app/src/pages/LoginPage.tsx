import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building3D } from "../components/Building3D";
import { Logo } from "../components/ui";
import { useApp } from "../lib/store";
import { login, register } from "../lib/api";
import { useT } from "../lib/i18n";

const DEMO_EMAIL = "demo@nobel.az";

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const signIn = useApp((s) => s.signIn);
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("Enter an email address, for example demo@nobel.az."));
      return;
    }
    if (!password) {
      setError(t("Enter a password."));
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError(t("Use a password of at least 8 characters."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = mode === "signin" ? await login(email.trim(), password) : await register(email.trim(), password, name.trim());
      signIn(session);
      navigate("/projects", { replace: true });
    } catch (err: any) {
      setError(err?.message || t("Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "register" : "signin");
    setError("");
    if (mode === "signin") {
      setEmail("");
      setPassword("");
    }
  };

  return (
    <div className="login">
      <section className="login-form-side">
        <span className="brand-inline">
          <Logo size={34} />
          <span className="brand-words">
            <strong>Nobel BOQ</strong>
            <small>{t("Quantity takeoff platform")}</small>
          </span>
        </span>

        <div className="lang login-lang" role="group" aria-label={t("Interface language")}>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
          <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
            AZ
          </button>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <h1>{mode === "signin" ? t("Sign in") : t("Create account")}</h1>
          <p className="muted">{t("Open your projects, their drawings and the bills built from them.")}</p>
          {mode === "register" ? (
            <label className="field">
              <span>{t("Name")}</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          ) : null}
          <label className="field">
            <span>{t("Email")}</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("Password")}</span>
            <input className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="bad-text small">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? t("Please wait…") : mode === "signin" ? t("Sign in") : t("Create account")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={switchMode}>
            {mode === "signin" ? t("Create an account") : t("I already have an account")}
          </button>
          {mode === "signin" ? <p className="faint small">{t("Demo account: demo@nobel.az, password demo.")}</p> : null}
        </form>

        <p className="faint small login-foot">{t("Nobel BOQ demo")}</p>
      </section>

      <section className="login-art" aria-hidden="true">
        <Building3D />
        <div className="login-art-copy">
          <strong>{t("Every quantity traced to its sheet")}</strong>
          <span>{t("Drawings read, cross-checked and priced into a bill of quantities.")}</span>
        </div>
      </section>
    </div>
  );
}
