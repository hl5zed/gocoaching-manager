import type {
  AiProvider,
  CompanionLocale,
  GenerateCompanionReplyInput,
} from "./types";

const MODEL_NAME = "mock-spiritual-companion-v1";

function compactMessage(message: string) {
  const trimmed = message.replace(/\s+/g, " ").trim();
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
}

function buildKoreanReply(input: GenerateCompanionReplyInput) {
  const focus = compactMessage(input.userMessage);

  return [
    "오늘의 묵상 방향",
    `지금 나눈 마음을 하나님 앞에 조용히 올려 드리며, \"${focus}\" 안에 담긴 갈망과 부담을 분별해 보세요.`,
    "",
    "묵상 질문",
    "1. 오늘 내 마음에서 가장 크게 움직이는 감정은 무엇인가요?",
    "2. 이 상황 속에서 하나님이 초대하시는 작은 순종은 무엇일까요?",
    "3. 내가 붙잡아야 할 약속의 말씀이나 진리는 무엇인가요?",
    "",
    "오늘의 작은 실천",
    "5분 동안 조용히 앉아 한 문장 기도로 오늘의 마음을 정리해 보세요.",
    "",
    "짧은 기도문",
    "주님, 제 마음을 살피시고 오늘 제가 할 수 있는 작은 순종을 보여 주세요. 아멘.",
  ].join("\n");
}

function buildEnglishReply(input: GenerateCompanionReplyInput) {
  const focus = compactMessage(input.userMessage);

  return [
    "Reflection direction",
    `Bring this honestly before God: \"${focus}\". Notice what desire, burden, or invitation may be present.`,
    "",
    "Reflection questions",
    "1. What emotion is most present in me today?",
    "2. What small act of obedience might God be inviting me into?",
    "3. What promise or truth do I need to hold onto today?",
    "",
    "Small practice for today",
    "Spend five quiet minutes turning your thoughts into one simple prayer.",
    "",
    "Short prayer",
    "Lord, search my heart and guide me toward one faithful step today. Amen.",
  ].join("\n");
}

function buildThaiReply(input: GenerateCompanionReplyInput) {
  const focus = compactMessage(input.userMessage);

  return [
    "แนวทางใคร่ครวญวันนี้",
    `นำเรื่องนี้มาไว้ต่อพระเจ้าอย่างสงบ: \"${focus}\" แล้วสังเกตว่าพระองค์กำลังเชิญคุณให้ก้าวเล็ก ๆ อย่างไร`,
    "",
    "คำถามใคร่ครวญ",
    "1. วันนี้ความรู้สึกใดชัดเจนที่สุดในใจของฉัน?",
    "2. พระเจ้ากำลังเชิญฉันให้เชื่อฟังในเรื่องเล็ก ๆ อะไร?",
    "3. ความจริงหรือพระสัญญาใดที่ฉันควรยึดไว้วันนี้?",
    "",
    "การปฏิบัติเล็ก ๆ วันนี้",
    "ใช้เวลาสงบ 5 นาที แล้วสรุปใจของคุณเป็นคำอธิษฐานหนึ่งประโยค",
    "",
    "คำอธิษฐานสั้น ๆ",
    "พระเจ้า ขอทรงสำรวจใจของข้าพระองค์ และนำข้าพระองค์ให้ก้าวอย่างสัตย์ซื่อในวันนี้ อาเมน",
  ].join("\n");
}

function buildReply(input: GenerateCompanionReplyInput) {
  const builders: Record<CompanionLocale, (input: GenerateCompanionReplyInput) => string> = {
    en: buildEnglishReply,
    ko: buildKoreanReply,
    th: buildThaiReply,
  };

  return builders[input.locale](input);
}

export const mockAiProvider: AiProvider = {
  async generateCompanionReply(input) {
    const text = buildReply(input);

    return {
      inputTokens: Math.ceil(input.userMessage.length / 4),
      model: MODEL_NAME,
      outputTokens: Math.ceil(text.length / 4),
      text,
    };
  },
  name: "mock",
};
