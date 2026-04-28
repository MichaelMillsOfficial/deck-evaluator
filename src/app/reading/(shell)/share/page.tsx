"use client";

import { useEffect, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { encodeCompactDeckPayload } from "@/lib/deck-codec";
import {
  formatJsonReport,
  formatMarkdownReport,
} from "@/lib/export-report";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader from "@/components/reading/SectionHeader";
import DiscordExportModal from "@/components/DiscordExportModal";
import styles from "./share.module.css";

type Status = "idle" | "working" | "done" | "error";
type Channel =
  | "link"
  | "image"
  | "discord"
  | "markdown"
  | "json";

const FEEDBACK_TIMEOUT_MS = 2000;

export default function SharePage() {
  const { payload, analysisResults } = useDeckSession();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Partial<Record<Channel, string>>>(
    {}
  );
  const [imageStatus, setImageStatus] = useState<Status>("idle");
  const [discordOpen, setDiscordOpen] = useState(false);

  // Encode the share URL once cardMap is populated.
  useEffect(() => {
    if (!payload?.deck || !payload.cardMap) {
      setShareUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const encoded = await encodeCompactDeckPayload(
          payload.deck,
          payload.cardMap!
        );
        if (!cancelled) {
          setShareUrl(`${window.location.origin}/shared?d=${encoded}`);
        }
      } catch {
        // Encoding failure — leave shareUrl null.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload?.deck, payload?.cardMap]);

  if (!payload?.cardMap || !analysisResults) return null;

  const { deck, cardMap } = payload;

  const ping = (channel: Channel, message: string) => {
    setFeedback((prev) => ({ ...prev, [channel]: message }));
    setTimeout(() => {
      setFeedback((prev) => {
        const next = { ...prev };
        delete next[channel];
        return next;
      });
    }, FEEDBACK_TIMEOUT_MS);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      ping("link", "Link copied!");
    } catch {
      ping("link", "Copy failed");
    }
  };

  const handleSaveImage = async () => {
    if (imageStatus === "working") return;
    setImageStatus("working");
    try {
      const { generateAndDownloadPng, buildExportImageData } = await import(
        "@/lib/export-image"
      );
      const totalCards =
        deck.commanders.reduce((s, c) => s + c.quantity, 0) +
        deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
        deck.sideboard.reduce((s, c) => s + c.quantity, 0);
      const data = buildExportImageData(
        deck.name,
        deck.commanders.map((c) => c.name),
        totalCards,
        analysisResults
      );
      await generateAndDownloadPng(data);
      setImageStatus("done");
      ping("image", "Image saved!");
      setTimeout(() => setImageStatus("idle"), FEEDBACK_TIMEOUT_MS);
    } catch {
      setImageStatus("error");
      ping("image", "Save failed");
      setTimeout(() => setImageStatus("idle"), FEEDBACK_TIMEOUT_MS);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = formatMarkdownReport(analysisResults, deck);
      await navigator.clipboard.writeText(md);
      ping("markdown", "Markdown copied!");
    } catch {
      ping("markdown", "Copy failed");
    }
  };

  const handleCopyJson = async () => {
    try {
      const json = formatJsonReport(analysisResults, deck);
      await navigator.clipboard.writeText(json);
      ping("json", "JSON copied!");
    } catch {
      ping("json", "Copy failed");
    }
  };

  type Tile = {
    channel: Channel;
    eyebrow: string;
    title: string;
    description: string;
    button: string;
    onClick: () => void;
    primary?: boolean;
    disabled?: boolean;
  };

  const featured: Tile[] = [
    {
      channel: "link",
      eyebrow: "Link",
      title: "Copy Share URL",
      description:
        "A self-contained URL that decodes the deck list right in the browser. No server, no account — paste it anywhere.",
      button: shareUrl ? "Copy Link" : "Generating...",
      onClick: handleCopyLink,
      disabled: !shareUrl,
      primary: true,
    },
    {
      channel: "image",
      eyebrow: "Image",
      title: "Save as PNG",
      description:
        "A self-contained card with the verdict, mana curve, and standout themes — perfect for chats and social.",
      button: imageStatus === "working" ? "Generating..." : "Save Image",
      onClick: handleSaveImage,
      disabled: imageStatus === "working",
    },
  ];

  const secondary: Tile[] = [
    {
      channel: "discord",
      eyebrow: "Discord",
      title: "Export to Discord",
      description:
        "Tailor a markdown post that fits Discord's character limits.",
      button: "Open Exporter",
      onClick: () => setDiscordOpen(true),
    },
    {
      channel: "markdown",
      eyebrow: "Markdown",
      title: "Copy Markdown",
      description:
        "Full analysis as markdown — paste anywhere that renders MD.",
      button: "Copy Markdown",
      onClick: handleCopyMarkdown,
    },
    {
      channel: "json",
      eyebrow: "JSON",
      title: "Copy JSON",
      description: "Raw structured analysis data for further processing.",
      button: "Copy JSON",
      onClick: handleCopyJson,
    },
  ];

  const renderTile = (tile: Tile, variant: "featured" | "secondary") => (
    <article
      key={tile.channel}
      className={[
        styles.card,
        tile.primary && styles.cardPrimary,
        variant === "secondary" && styles.cardSecondary,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.cardEyebrow}>{tile.eyebrow}</span>
      <h2 className={styles.cardTitle}>{tile.title}</h2>
      <p className={styles.cardDesc}>{tile.description}</p>
      <div className={styles.cardAction}>
        <button
          type="button"
          data-testid={`share-${tile.channel}-button`}
          onClick={tile.onClick}
          disabled={tile.disabled}
          className={[
            styles.button,
            tile.primary && styles.buttonPrimary,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {tile.button}
        </button>
        {feedback[tile.channel] && (
          <p className={styles.feedback}>{feedback[tile.channel]}</p>
        )}
      </div>
    </article>
  );

  return (
    <>
      <div
        role="tabpanel"
        id="tabpanel-deck-share"
        aria-labelledby="tab-deck-share"
      >
        <SectionHeader
          slug="share"
          runningHead={readingRunningHead(payload.createdAt, deck.name)}
          eyebrow="Share"
          title="Take It Elsewhere"
          tagline="Hand the reading off as a link, image, Discord post, markdown, or raw JSON."
        />
        <div className={styles.layout}>
          <div className={styles.featuredRow}>
            {featured.map((tile) => renderTile(tile, "featured"))}
          </div>
          <div className={styles.secondaryRow}>
            {secondary.map((tile) => renderTile(tile, "secondary"))}
          </div>
        </div>
      </div>

      <DiscordExportModal
        open={discordOpen}
        onClose={() => setDiscordOpen(false)}
        analysisResults={analysisResults}
        deck={deck}
        shareUrl={shareUrl ?? undefined}
      />
    </>
  );
}
