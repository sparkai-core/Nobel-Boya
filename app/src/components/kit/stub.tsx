import { Hammer } from "lucide-react";
import { Empty, useL } from "./core";

/** Placeholder used while a page is being built. */
export function StubPage({ title }: { title: string }) {
  const { t } = useL();
  return (
    <div className="k-page">
      <Empty icon={<Hammer size={20} />} title={t(title)}>
        {t("This page is being prepared.")}
      </Empty>
    </div>
  );
}
