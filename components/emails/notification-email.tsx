type NotificationEmailProps = {
  actionLabel?: string | null;
  actionUrl?: string | null;
  body: string;
  previewText?: string;
  recipientName?: string | null;
  title: string;
};

export function NotificationEmail({
  actionLabel,
  actionUrl,
  body,
  previewText,
  recipientName,
  title,
}: NotificationEmailProps) {
  const greetingName = recipientName?.trim() || "there";

  return (
    <div
      style={{
        backgroundColor: "#f4f4f0",
        color: "#18181b",
        fontFamily:
          "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif",
        margin: 0,
        padding: "24px 0",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e4e4e7",
          margin: "0 auto",
          maxWidth: "560px",
          padding: "32px",
        }}
      >
        <p style={{ color: "#71717a", fontSize: "12px", letterSpacing: "0.08em", margin: 0 }}>
          {previewText ?? "Autobot notification"}
        </p>
        <h1 style={{ fontSize: "28px", lineHeight: 1.2, margin: "16px 0 12px" }}>{title}</h1>
        <p style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
          Hi {greetingName},
        </p>
        <p style={{ fontSize: "16px", lineHeight: 1.7, margin: "0 0 24px", whiteSpace: "pre-wrap" }}>
          {body}
        </p>
        {actionLabel && actionUrl ? (
          <a
            href={actionUrl}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              display: "inline-block",
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px 18px",
              textDecoration: "none",
            }}
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
