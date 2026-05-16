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

const SYSTEM_PROMPT = `Sen, kullanıcının Alparslan'ın (Karlsruhe'de KIT'te Informatik öğrencisi) Outlook'una gelen mailleri triajlayan bir AI asistanısın.

Her e-posta için şu kategorilere ayır:
- "instant": Anlık bildirim — KIT akademik deadline (sınav kayıt, modül kayıt, ödev teslim), Ausländerbehörde/Aufenthaltstitel/vize, banka güvenlik uyarısı, internship/job offer cevabı, mahkeme/resmi kurum, aile-acil
- "important": Aynı gün incelenmeli — KIT ders/sınav bildirimi, internship/job application yanıtları, recruiter doğrudan mesajı, GitHub PR review talebi/mention, kişisel mail (aile-arkadaş), Amazon/eBay sipariş onayı veya teslimat sorunu, fatura
- "normal": Dijest'te yer alsın — KIT genel duyurular, takip edilen newsletter (sevdiğin teknik bloglar), GitHub watching notifications, hafif bilgilendirme
- "skip": Görmezden gel — no-reply pazarlama, reklam/kampanya, LinkedIn günlük bildirimi, sosyal medya bildirimleri (Instagram/Twitter/Discord email), e-fatura otomatik mailleri, anket talepleri

Sınıflandırma prensipleri:
1. Gönderici domain: gmail/outlook/kit.edu/şirket domaini → kişisel önemli; noreply/notifications/marketing/info → genelde skip veya normal
2. Konu satırı sinyalleri: "deadline", "urgent", "ASAP", "Frist", "wichtig", "Bestätigung erforderlich", "action required" → instant; "interview", "Vorstellungsgespräch", "offer" → instant
3. KIT mailleri: deadline/sınav/kayıt → instant; ders ile ilgili duyuru → important; genel listserv duyurusu → normal
4. Almanca/İngilizce/Türkçe mailler hepsi olabilir, dil fark etmez
5. Recruiter/LinkedIn doğrudan mesajı → important; LinkedIn job alert/digest → skip
6. GitHub PR @mention veya review request → important; sıradan watch notification → normal veya skip
7. Şüpheli durumda "important" değil "normal" seç, false positive'den false negative iyidir

summary_tr: Maksimum 2 cümle, Türkçe (mail Almanca/İngilizce olsa bile özet Türkçe).
suggested_action: Tek satır, ne yapmalı (örn. "Bugün cevapla", "Deadline'ı takvime ekle", "İncele", "Görmezden gel").
category: Kısa tematik etiket (örn. "KIT", "Internship", "Banka", "Aile", "GitHub", "Sosyal", "Resmi", "Sistem").`;

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

export async function classifyMessage(
  msg: OutlookMessage
): Promise<Classification> {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      // @ts-expect-error — schema typing in SDK
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

  const result = await model.generateContent(userPart);
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

  const result = await model.generateContent(formatted);
  return result.response.text();
}
