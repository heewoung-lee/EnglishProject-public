type PromotionScoreSummaryInput = {
  score: number;
  passScore: number;
};

export function formatPromotionScoreSummary({
  score,
  passScore,
}: PromotionScoreSummaryInput): string {
  return `점수 ${score}점 (합격 기준 ${passScore}점)`;
}
