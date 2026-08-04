import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { openExternalUrl } from "../platform";

const SOURCE_URL = "https://github.com/zhekin83-glitch/vess";
const UPSTREAM_URL = "https://github.com/openakita/openakita";

export function AboutLegalDialog({
  version,
  onClose,
  onOpenReleaseNotes,
}: {
  version: string;
  onClose: () => void;
  onOpenReleaseNotes?: () => void;
}) {
  const { t } = useTranslation();
  const ver = String(version || "").trim().replace(/^v/i, "") || "—";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("aboutLegal.title")}</DialogTitle>
          <DialogDescription>{t("aboutLegal.subtitle", { version: ver })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t("aboutLegal.line1")}</p>
          <p>
            {t("aboutLegal.line2Prefix")}{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline break-all"
              onClick={() => openExternalUrl(SOURCE_URL)}
            >
              {SOURCE_URL}
            </button>
            {t("aboutLegal.line2Suffix", { version: ver })}
          </p>
          <p>{t("aboutLegal.line3")}</p>
          <p className="text-xs opacity-80">{t("aboutLegal.thirdParty")}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl(UPSTREAM_URL)}>
            {t("aboutLegal.openUpstream")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl(SOURCE_URL)}>
            {t("aboutLegal.openSource")}
          </Button>
          {onOpenReleaseNotes && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenReleaseNotes();
              }}
            >
              {t("version.releaseNotesButton")}
            </Button>
          )}
          <Button type="button" size="sm" onClick={onClose}>{t("common.close")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
