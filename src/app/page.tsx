export default function Home() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "4rem 2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        📬 Mail Triage Bot
      </h1>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.6, marginBottom: "2rem" }}>
        Outlook hesabına bağlan, bot maillerini Gemini ile sınıflandırıp önemli
        olanları Telegram'a anlık göndersin, gerisini günde iki kez özet olarak
        iletsin.
      </p>

      <a
        href="/api/auth/outlook/login"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#0078d4",
          color: "white",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: 500,
        }}
      >
        Outlook ile Bağlan →
      </a>

      <hr
        style={{
          margin: "3rem 0 2rem",
          border: 0,
          borderTop: "1px solid #333",
        }}
      />

      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Durum</h2>
      <p style={{ color: "#888", fontSize: "0.9rem" }}>
        Bağlandıktan sonra cron'lar otomatik çalışır:
        <br />· Saatlik poll → yeni mailleri sınıflandır
        <br />· 09:00 ve 18:00 → özet dijest
        <br />· "Instant" sınıflandırılan mailler için anlık bildirim
      </p>
    </main>
  );
}
