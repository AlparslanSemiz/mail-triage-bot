import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { env } from "./env";
import type { OutlookMessage } from "./outlook";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export type Classification = {
  urgency: "instant" | "important" | "normal" | "skip";
  category: string;
  summary_tr: string;
  suggested_action: string;
};

const SYSTEM_PROMPT = `Sen, Alp'in (Karlsruhe'de KIT'te Informatik öğrencisi, Werkstudent, Türk vatandaşı, oturum izniyle Almanya'da yaşıyor) Outlook'una gelen mailleri triajlayan bir AI asistanısın. Gmail hesabındaki mailler de Outlook'a yönlendirilir; onları da aynı kurallarla sınıflandır.

Her e-posta için şu kategorilere ayır:

"instant" — SADECE gerçek aciliyet, anlık bildirim hakkı: bir insan tarafından yazılmış olmalı veya gerçek kişisel aksiyon gerektirmeli.
- KIT akademik deadline mailleri (sınav kaydı, modül kaydı, ödev teslim son 48 saat içinde)
- Ausländerbehörde / Aufenthaltstitel / vize ile ilgili resmi mail (gerçek başvuru, randevu)
- Bankadan gelen DOLANDIRICILIK uyarısı veya yetkisiz işlem bildirimi (rutin "yeni giriş tespit edildi" DEĞİL)
- Internship/job offer geldi veya interview daveti
- Kişiden (insan) doğrudan ve aciliyet ifade eden mail (aile/arkadaş "acil ara" gibi)
- Bir kurumun (KVV/Deutschlandticket aboneliği, Studierendenwerk/yurt, Krankenkasse, Finanzamt, Bürgeramt, Rundfunkbeitrag, işveren, banka) gerçek bir kişi tarafından yazılmış ve belge, bilgi ya da cevap istediği mail
- "Kündigung", "Mahnung", "Frist", "letzte Erinnerung", "Sperrung", "Rückforderung" gibi bir hakkın, aboneliğin ya da hesabın sona ermesi, ceza veya ödeme talebi bildiren mail
- Postanın teslim edilemediğini ("konnte nicht zugestellt werden", "unzustellbar", "Adresse") ya da adresin güncellenmesi gerektiğini bildiren mail

"important" — Aynı gün incelenmeli ama beklemeye dayanır:
- KIT'ten dönem içi ders/sınav bildirimleri (deadline > 48 saat)
- Internship/job application süreç güncellemeleri (mülakat sonrası takip vs.)
- Recruiter doğrudan mesajları (LinkedIn InMail vb.)
- GitHub'da senin reponda PR review talebi, sana @mention
- Kişiden gelen sıradan mailler (insan yazmış, kişisel)
- Amazon/eBay sipariş problemi, teslimat sorunu
- Fatura, ödeme hatırlatması
- Banka rutin güvenlik mailleri (yeni cihazdan giriş, parola değişikliği)

"normal" — Dijest'te yer alsın ama bildirim verme:
- KIT genel duyurular, listserv mailleri
- Sevdiğin teknik newsletter (kullanıcı kayıt olduğu için aldığı)
- GitHub watching/star notifications
- Sıradan bilgilendirme

"skip" — Görmezden gel, dijest'e bile alma:
- noreply / no-reply / notifications@ / news@ adresinden gelen pazarlama
- Tüm reklam, indirim, kampanya mailleri
- LinkedIn job alert / "X kişi profilinize baktı" digest
- Sosyal medya bildirim mailleri (Instagram, Twitter/X, Discord, Reddit)
- Otomatik "hesabınıza giriş yapıldı" bildirimleri (anormal aktivite olmadıkça)
- Microsoft/Google/Apple otomatik hesap bildirimleri (uygulama bağlama, oturum açma vs.)
- E-fatura otomatik mailleri
- Anket ve geri bildirim talepleri
- Confirm/verify e-posta linkleri (kullanıcı kendisi yeni kayıt yapmadıkça spam)

KRİTİK kurallar:
1. Otomatik bildirim sınıflandırırken çok dikkatli ol. "noreply", "notification", "no-reply", "donotreply" gönderici → ASLA instant. En fazla important, genelde skip veya normal.
2. "New sign-in detected", "yeni oturum açma tespit edildi" gibi mailler **skip**'tir — kullanıcı kendisi giriş yapmıştır, rutin bildirim. Sadece "suspicious activity detected" veya "fraud alert" gibi gerçek dolandırıcılık uyarıları instant olabilir.
3. Microsoft/Google/Apple'ın "uygulamanız bağlandı" mailleri **skip** — kullanıcı izni zaten verdi, bildirim sadece kayıt amaçlı.
4. Resmi kurum ya da sözleşme tarafı (abonelik, sigorta, oturum izni, üniversite) bir şey istiyor veya bir şeyi sonlandırıyorsa, gönderici adresi noreply olsa bile en az important; son tarih yakınsa ya da süre geçmişse instant. Bu kural 1. kuralın üstündedir.
5. Şüpheli durumda bir kategori aşağı düş: instant'tan emin değilsen important; important'tan emin değilsen normal. False positive (gereksiz acil bildirim) en kötü, false negative (önemli olanı atlamak) ikinci kötü.

summary_tr: Maksimum 2 cümle, Türkçe (mail Almanca/İngilizce olsa bile özet Türkçe).
suggested_action: Tek satır, ne yapmalı.
category: Kısa tematik etiket (örn. "KIT", "Internship", "GitHub", "Banka", "Hesap-Bildirim", "Sosyal", "Sistem", "Newsletter").`;

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    urgency: {
      type: SchemaType.STRING,
      enum: ["instant", "important", "normal", "skip"],
    },
    category: { type: SchemaType.STRING },
    summary_tr: { type: SchemaType.STRING },
    suggested_action: { type: SchemaType.STRING },
  },
  required: ["urgency", "category", "summary_tr", "suggested_action"],
};

function isRetryable(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /\b(429|500|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(m);
}

/** Retries transient Gemini errors (rate limit, overload) with backoff. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries - 1 || !isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
}

export async function classifyMessage(
  msg: OutlookMessage
): Promise<Classification> {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  const userPart = [
    `Gönderen: ${msg.from?.emailAddress?.name ?? "?"} <${msg.from?.emailAddress?.address ?? "?"}>`,
    `Konu: ${msg.subject ?? "(konu yok)"}`,
    `Önem (Outlook): ${msg.importance}`,
    `Önizleme:`,
    msg.bodyPreview?.slice(0, 1500) ?? "(boş)",
  ].join("\n");

  const result = await withRetry(() => model.generateContent(userPart));
  const text = result.response.text();

  try {
    return JSON.parse(text) as Classification;
  } catch {
    // Fallback: safe default
    return {
      urgency: "normal",
      category: "Bilinmiyor",
      summary_tr: "Sınıflandırma başarısız, manuel inceleme gerekli.",
      suggested_action: "İncele",
    };
  }
}

/**
 * Generates a consolidated digest summary from multiple emails.
 * Used for the 09:00 and 18:00 digests.
 */
export async function generateDigestSummary(
  items: Array<{
    from: string;
    subject: string;
    summary: string;
    category: string;
  }>
): Promise<string> {
  if (items.length === 0) return "Bu dönemde önemli mail yok. 🎉";

  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction:
      "Sen Alp'in e-posta asistanısın. Aşağıdaki maillerin Türkçe, kısa, Telegram'da okunmaya uygun bir özetini yap. Maddeler halinde, her madde 1 satır. Önce 'important' kategoride olanlar, sonra 'normal'. Emoji kullanma. Markdown bold (*) kullanma. Sonunda toplam mail sayısını belirt.",
    generationConfig: { temperature: 0.3 },
  });

  const formatted = items
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.category}] ${i.from} — "${i.subject}": ${i.summary}`
    )
    .join("\n");

  const result = await withRetry(() => model.generateContent(formatted));
  return result.response.text();
}
