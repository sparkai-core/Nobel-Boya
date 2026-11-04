import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Building3D } from "../components/brand/Building3D";
import { Logo } from "../components/ui";
import { DEMO_USER, useApp } from "../lib/store";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useApp((s) => s.login);
  const [tab, setTab] = useState<"signin" | "signup" | "demo">("signin");
  const [email, setEmail] = useState(DEMO_USER.email);
  const [password, setPassword] = useState("••••••••••••");
  const [name, setName] = useState(DEMO_USER.name);
  const [org, setOrg] = useState(DEMO_USER.organization);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  const handleAuth = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setBusy(true);

    setTimeout(() => {
      login({
        name: name || DEMO_USER.name,
        email: email || DEMO_USER.email,
        role: "Lead Quantity Surveyor",
        organization: org || DEMO_USER.organization,
      });
      setLeaving(true);
      setTimeout(() => {
        navigate("/overview", { replace: true });
      }, 240);
    }, 450);
  };

  const handleDemoAccess = () => {
    setBusy(true);
    login(DEMO_USER);
    setLeaving(true);
    setTimeout(() => {
      navigate("/overview", { replace: true });
    }, 200);
  };

  return (
    <div className={`login-view${leaving ? " leaving" : ""}`}>
      <div className="login-stage">
        {/* Left hero: 3D canvas, branding, live telemetry */}
        <section className="login-hero" aria-label="Project context">
          <div className="login-hero-header">
            <div className="login-brand">
              <Logo size={32} />
              <div>
                <strong>Storm</strong>
                <span className="login-brand-tag">Takeoff &amp; BOQ Platform</span>
              </div>
            </div>
            <div className="login-status-badge">
              <span className="status-dot-pulse" />
              <span>Qobu Logistics Hub • Working Design</span>
            </div>
          </div>

          <div className="login-hero-center">
            <h1>Every quantity, traced to the drawing it came from.</h1>
            <p className="login-hero-subtitle">
              Automated structural takeoff, vector schedule extraction, and pixel-level redline evidence for Azerbaijani construction packages.
            </p>

            <div className="login-canvas-container">
              <Building3D showCaption />
            </div>
          </div>

          <div className="login-metrics-bar">
            <div className="metric-chip">
              <span className="metric-val">1,122 m²</span>
              <span className="metric-lbl">Warehouse Hall</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">205</span>
              <span className="metric-lbl">Drawing Sheets</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">323</span>
              <span className="metric-lbl">Verified Items</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">16</span>
              <span className="metric-lbl">Audit Checks</span>
            </div>
          </div>
        </section>

        {/* Right card: Apple-grade authentication card */}
        <section className="login-auth-card">
          <div className="auth-card-inner">
            <div className="auth-header">
              <h2>{tab === "signup" ? "Create an account" : "Sign in to workspace"}</h2>
              <p className="auth-lead">
                {tab === "signup"
                  ? "Collaborate on drawing packages and audited takeoff bills."
                  : "Access verified takeoffs, drawing citations, and cost models."}
              </p>
            </div>

            {/* Segmented control tabs */}
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "signin"}
                className={tab === "signin" ? "active" : ""}
                onClick={() => setTab("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "signup"}
                className={tab === "signup" ? "active" : ""}
                onClick={() => setTab("signup")}
              >
                Register
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "demo"}
                className={tab === "demo" ? "active highlight" : "highlight"}
                onClick={() => setTab("demo")}
              >
                <Sparkles size={13} />
                Instant Demo
              </button>
            </div>

            {error ? <div className="auth-alert">{error}</div> : null}

            {tab === "demo" ? (
              <div className="demo-access-card">
                <div className="demo-profile-preview">
                  <div className="demo-avatar">EM</div>
                  <div>
                    <strong>{DEMO_USER.name}</strong>
                    <div className="demo-role">{DEMO_USER.role}</div>
                    <div className="demo-org">{DEMO_USER.organization}</div>
                  </div>
                </div>

                <ul className="demo-features-list">
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>Full access to 323 verified Qobu takeoff lines</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>205 drawing sheets with interactive SVG redlines</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>Dynamic AZN rate library & ExcelJS export</span>
                  </li>
                </ul>

                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block auth-submit-btn"
                  onClick={handleDemoAccess}
                  disabled={busy}
                >
                  {busy ? <span className="spinner" /> : null}
                  <span>{busy ? "Opening Workspace..." : "Launch Qobu Complex Demo"}</span>
                  {!busy ? <ArrowRight size={16} /> : null}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="auth-form" noValidate>
                {tab === "signup" ? (
                  <>
                    <label className="field">
                      <span className="field-label">Full Name</span>
                      <input
                        className="input"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Elmir Məmmədov"
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Organization</span>
                      <div className="input-group">
                        <Building2 size={15} />
                        <input
                          className="input"
                          type="text"
                          required
                          value={org}
                          onChange={(e) => setOrg(e.target.value)}
                          placeholder="e.g. Storm Building MMC"
                        />
                      </div>
                    </label>
                  </>
                ) : null}

                <label className="field">
                  <span className="field-label">Work Email</span>
                  <div className="input-group">
                    <Mail size={15} />
                    <input
                      className="input"
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.az"
                    />
                  </div>
                </label>

                <label className="field">
                  <span className="field-label">Password</span>
                  <div className="input-group password-group">
                    <Lock size={15} />
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      className="icon-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <div className="auth-options">
                  <label className="remember-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Remember this session</span>
                  </label>
                  <a href="#demo" onClick={(e) => { e.preventDefault(); setTab("demo"); }} className="auth-link">
                    Use demo mode
                  </a>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block auth-submit-btn"
                  disabled={busy}
                >
                  {busy ? <span className="spinner" /> : null}
                  <span>
                    {busy
                      ? "Authenticating..."
                      : tab === "signup"
                      ? "Create Account & Enter"
                      : "Sign In as Estimator"}
                  </span>
                  {!busy ? <ArrowRight size={16} /> : null}
                </button>
              </form>
            )}

            <div className="auth-card-footer">
              <ShieldCheck size={14} className="text-muted" />
              <span>256-bit encrypted engineering session • Baku, Azerbaijan</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

