import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, HardHat, Plus, Trash2, Truck, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, Dialog, Field, PageHero, Panel, StatTiles, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { R, tradeName, type Tone } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import { addPartyPerson, removePartyPerson, restorePartyPerson } from "../../../ops/ext/records";
import type { Party, PartyRole, Txt } from "../../../ops/types";

type Access = Party["people"][number]["access"];
type Person = { name: string; title: Txt; access: Access | null };
type OrgNode = {
  key: string;
  partyId: string | null;
  role: PartyRole;
  name: string;
  people: Person[];
  sub?: string;
  editable: boolean;
  link?: { to: string; label: string };
  status?: { kind: string; value: string };
  value?: number;
};

const ACCESS: Record<Access, { label: string; tone: Tone; hint: string }> = {
  PROJECT_ADMIN: { label: "Admin", tone: "brand", hint: "Can change the programme, approve and manage people." },
  PROJECT_MEMBER: { label: "Member", tone: "info", hint: "Can raise and update records." },
  PROJECT_VIEWER: { label: "Viewer", tone: "muted", hint: "Can read the project, nothing else." },
};
const ROLE_LABEL: Record<PartyRole, string> = { OWNER: "Client", CONSULTANT: "Consultant", CONTRACTOR: "Main contractor", SUBCONTRACTOR: "Subcontractor", VENDOR: "Vendor" };

/** Project organisation as an org chart: who the companies are, how they connect, and who has access. */
export function PartiesPage() {
  const { t, x, lang } = useL();
  const parties = useOps((s) => s.parties);
  const subs = useOps((s) => s.subs);
  const vendors = useOps((s) => s.vendors);
  const pos = useOps((s) => s.pos);
  const [sel, setSel] = useState<string>("CONTRACTOR");
  const [adding, setAdding] = useState(false);

  const nodes = useMemo(() => {
    const byRole = (r: PartyRole) => parties.find((p) => p.role === r);
    const fromParty = (p: Party | undefined, role: PartyRole, key: string): OrgNode => ({ key, partyId: p?.id ?? null, role, name: p?.name ?? "—", people: p?.people ?? [], editable: true });
    const owner = fromParty(byRole("OWNER"), "OWNER", "OWNER");
    const consultant = fromParty(byRole("CONSULTANT"), "CONSULTANT", "CONSULTANT");
    const contractor = fromParty(byRole("CONTRACTOR"), "CONTRACTOR", "CONTRACTOR");
    const subNodes: OrgNode[] = subs.map((s) => {
      const p = parties.find((q) => q.role === "SUBCONTRACTOR" && q.name === s.name);
      return {
        key: `sub:${s.id}`,
        partyId: p?.id ?? null,
        role: "SUBCONTRACTOR",
        name: s.name,
        people: p?.people ?? [{ name: s.contact, title: { en: "Package manager", az: "Paket meneceri" }, access: null }],
        sub: x(s.trade),
        editable: true,
        status: { kind: "sub", value: s.status },
        value: s.packageValue,
        link: { to: R.subs, label: "Subcontractors" },
      };
    });
    const vendorNodes: OrgNode[] = vendors
      .map((v) => ({ v, n: pos.filter((p) => p.vendorId === v.id && p.status !== "CANCELLED").length }))
      .filter((r) => r.n > 0)
      .map(({ v, n }) => ({
        key: `vendor:${v.id}`,
        partyId: null,
        role: "VENDOR" as const,
        name: v.name,
        people: [{ name: v.contact, title: { en: "Sales contact", az: "Satış üzrə əlaqə" }, access: null }],
        sub: `${tradeName(v.trade, lang)} · ${t("{n} orders", { n })}`,
        editable: false,
        link: { to: R.vendor(v.id), label: "Open vendor record" },
      }));
    return { owner, consultant, contractor, subNodes, vendorNodes, all: [owner, consultant, contractor, ...subNodes, ...vendorNodes] };
  }, [parties, subs, vendors, pos, x, lang, t]);

  const selected = nodes.all.find((n) => n.key === sel) ?? nodes.contractor;
  const people = nodes.all.reduce((a, n) => a + n.people.filter((p) => p.access).length, 0);
  const admins = nodes.all.reduce((a, n) => a + n.people.filter((p) => p.access === "PROJECT_ADMIN").length, 0);

  const remove = (node: OrgNode, name: string) => {
    if (!node.partyId) return;
    const gone = removePartyPerson(node.partyId, name);
    if (!gone) return;
    const pid = node.partyId;
    toast(t("{name} removed from the project", { name }), "neutral", { label: t("Undo"), onClick: () => restorePartyPerson(pid, gone) });
  };

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Parties")}
        title={t("Project organisation")}
        subtitle={t("The companies on the Qobu project, how they connect, and the people who can see and change records.")}
        art="parties"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlus size={15} />
            {t("Add person")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("Companies"), value: nodes.all.length, sub: t("{s} subcontractors, {v} vendors", { s: nodes.subNodes.length, v: nodes.vendorNodes.length }) },
          { label: t("People with access"), value: people, sub: t("{n} admins", { n: admins }) },
          { label: t("Subcontract packages"), value: fmtMoneyShort(subs.reduce((a, s) => a + s.packageValue, 0)), sub: t("AZN across {n} packages", { n: subs.length }) },
        ]}
      />

      <div className="k-grid-main">
        <section className="pmr-org" aria-label={t("Organisation chart")}>
          <div className="pmr-org-row top">
            <NodeCard node={nodes.owner} on={sel === nodes.owner.key} onPick={setSel} icon={<Building2 size={14} />} />
          </div>
          <div className="pmr-org-mid">
            <span className="pmr-org-trunk" aria-hidden="true" />
            <span className="pmr-org-branch" aria-hidden="true">
              <em>{t("advises the client")}</em>
            </span>
            <div className="pmr-org-main">
              <NodeCard node={nodes.contractor} on={sel === nodes.contractor.key} onPick={setSel} icon={<HardHat size={14} />} big />
            </div>
            <div className="pmr-org-side">
              <NodeCard node={nodes.consultant} on={sel === nodes.consultant.key} onPick={setSel} icon={<Users size={14} />} />
            </div>
          </div>
          <div className="pmr-org-tier">
            <h3>
              <HardHat size={13} />
              {t("Subcontractors")}
            </h3>
            <div className="pmr-org-kids">
              {nodes.subNodes.map((n) => (
                <NodeCard key={n.key} node={n} on={sel === n.key} onPick={setSel} small />
              ))}
            </div>
          </div>
          <div className="pmr-org-tier vendors">
            <h3>
              <Truck size={13} />
              {t("Key vendors (with orders)")}
            </h3>
            <div className="pmr-org-kids">
              {nodes.vendorNodes.map((n) => (
                <NodeCard key={n.key} node={n} on={sel === n.key} onPick={setSel} small />
              ))}
              {!nodes.vendorNodes.length ? <p className="muted small">{t("No orders placed yet.")}</p> : null}
            </div>
          </div>
        </section>

        <div className="k-stack pmr-org-detail">
          <Panel
            title={selected.name}
            icon={selected.role === "VENDOR" ? <Truck size={15} /> : <Building2 size={15} />}
            sub={
              <span className="k-row" style={{ gap: 6 }}>
                <Badge tone={selected.role === "VENDOR" ? "info" : selected.role === "CONTRACTOR" ? "brand" : "neutral"}>{t(ROLE_LABEL[selected.role])}</Badge>
                {selected.status ? <StatusBadge kind={selected.status.kind} status={selected.status.value} /> : null}
                {selected.value ? <span className="muted small">{t("package {v} AZN", { v: fmtMoneyShort(selected.value) })}</span> : null}
              </span>
            }
            pad={false}
            actions={
              selected.editable ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
                  <Plus size={13} />
                  {t("Add person")}
                </button>
              ) : null
            }
          >
            {selected.sub ? <p className="pmr-org-subline">{selected.sub}</p> : null}
            <ul className="pmr-people">
              {selected.people.map((p) => (
                <li key={p.name}>
                  <Avatar name={p.name} size={32} />
                  <span className="k-cell-title">
                    <strong>{p.name}</strong>
                    <small>{x(p.title)}</small>
                  </span>
                  {p.access ? (
                    <Badge tone={ACCESS[p.access].tone} title={t(ACCESS[p.access].hint)}>
                      {t(ACCESS[p.access].label)}
                    </Badge>
                  ) : (
                    <Badge tone="muted" dot={false}>
                      {t("No access")}
                    </Badge>
                  )}
                  {selected.editable && selected.partyId && p.access ? (
                    <button type="button" className="icon-btn" onClick={() => remove(selected, p.name)} aria-label={t("Remove {name}", { name: p.name })}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </li>
              ))}
              {!selected.people.length ? <li className="muted small">{t("Nobody added yet.")}</li> : null}
            </ul>
            {selected.link ? (
              <div className="pmr-org-link">
                <Link to={selected.link.to} className="k-link-btn">
                  {t(selected.link.label)} <ArrowRight size={13} />
                </Link>
              </div>
            ) : null}
          </Panel>

          <Panel title={t("Access levels")}>
            <ul className="pmr-access">
              {(Object.keys(ACCESS) as Access[]).map((a) => (
                <li key={a}>
                  <Badge tone={ACCESS[a].tone}>{t(ACCESS[a].label)}</Badge>
                  <span>{t(ACCESS[a].hint)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <AddPersonDialog open={adding} onClose={() => setAdding(false)} node={selected.editable ? selected : nodes.contractor} />
    </div>
  );
}

function NodeCard({ node, on, onPick, icon, big, small }: { node: OrgNode; on: boolean; onPick: (k: string) => void; icon?: ReactNode; big?: boolean; small?: boolean }) {
  const { t } = useL();
  const shown = node.people.slice(0, small ? 3 : 6);
  const more = node.people.length - shown.length;
  return (
    <button type="button" className={`pmr-node r-${node.role}${on ? " on" : ""}${big ? " big" : ""}${small ? " small" : ""}${node.status?.value === "SUSPENDED" ? " suspended" : ""}`} onClick={() => onPick(node.key)} aria-pressed={on}>
      <span className="pmr-node-role">
        {icon}
        {t(ROLE_LABEL[node.role])}
      </span>
      <strong>{node.name}</strong>
      {node.sub && !small ? <small>{node.sub}</small> : null}
      <span className="pmr-node-people">
        {shown.map((p) => (
          <Avatar key={p.name} name={p.name} size={small ? 22 : 26} />
        ))}
        {more > 0 ? <em>+{more}</em> : null}
      </span>
    </button>
  );
}

function AddPersonDialog({ open, onClose, node }: { open: boolean; onClose: () => void; node: OrgNode }) {
  const { t } = useL();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<Access>("PROJECT_MEMBER");
  const [tried, setTried] = useState(false);
  const submit = () => {
    setTried(true);
    if (!name.trim() || !title.trim()) return;
    addPartyPerson({ id: node.partyId, role: node.role, name: node.name }, { name: name.trim(), title: title.trim(), access });
    toast(t("{name} added to {company}", { name: name.trim(), company: node.name }));
    setName("");
    setTitle("");
    setAccess("PROJECT_MEMBER");
    setTried(false);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={node.name}
      title={t("Add person")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Add person")}
          </button>
        </>
      }
    >
      <div className="k-form pmr-dlg">
        <Field label={t("Full name")} wide error={tried && !name.trim() ? t("Enter a name.") : undefined}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Aysel Həsənli")} />
        </Field>
        <Field label={t("Job title")} wide error={tried && !title.trim() ? t("Enter a job title.") : undefined}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Site engineer")} />
        </Field>
        <Field label={t("Access")} wide hint={t(ACCESS[access].hint)}>
          <select className="input select" value={access} onChange={(e) => setAccess(e.target.value as Access)}>
            {(Object.keys(ACCESS) as Access[]).map((a) => (
              <option key={a} value={a}>
                {t(ACCESS[a].label)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}
