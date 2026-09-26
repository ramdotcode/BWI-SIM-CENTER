import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/Logo";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="pub" style={{ maxWidth: 640, textAlign: "center", paddingTop: 80 }}>
      <div className="row" style={{ justifyContent: "center", marginBottom: 24 }}><Logo /></div>
      <div className="card pad" style={{ padding: 36 }}>
        <h2>{t("notFound")}</h2>
        <p className="muted" style={{ marginTop: 10 }}>{t("notFoundDesc")}</p>
        <Link href="/" className="btn lime" style={{ marginTop: 20 }}>{t("toHome")}</Link>
      </div>
    </div>
  );
}
