import { offerComparisonSchema, type OfferComparisonResult } from "@/schemas/application";

type OfferForComparison = {
  id: string;
  company: string;
  jobTitle: string;
  city?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryMonths?: number | null;
  salaryText?: string | null;
  benefits: string[];
  pros: string[];
  cons: string[];
  status: string;
};

function annualSalaryScore(offer: OfferForComparison) {
  const min = offer.salaryMin ?? 0;
  const max = offer.salaryMax ?? min;
  const months = offer.salaryMonths ?? 12;
  return ((min + max) / 2) * months;
}

export function compareOfferRecords(offers: OfferForComparison[]): OfferComparisonResult {
  const activeOffers = offers.filter((offer) => ["pending", "accepted", "negotiating"].includes(offer.status));
  if (activeOffers.length === 0) {
    return offerComparisonSchema.parse({
      recommendedOfferId: null,
      reasons: ["暂无可对比的有效 offer"],
      risks: [],
      negotiationSuggestions: [],
    });
  }

  const scored = activeOffers
    .map((offer) => ({
      offer,
      score: annualSalaryScore(offer) + offer.pros.length * 1000 - offer.cons.length * 1200 + offer.benefits.length * 500,
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0].offer;

  return offerComparisonSchema.parse({
    recommendedOfferId: best.id,
    reasons: [
      `${best.company} ${best.jobTitle} 在薪资、福利和正向因素的综合评分中更靠前`,
      best.salaryText ? `薪资信息：${best.salaryText}` : "需要进一步确认完整薪资结构",
      best.city ? `城市：${best.city}` : "城市信息未明确",
    ],
    risks: [
      ...activeOffers.flatMap((offer) => offer.cons.map((item) => `${offer.company} 风险：${item}`)),
      ...activeOffers.filter((offer) => !offer.salaryText && !offer.salaryMin).map((offer) => `${offer.company} 薪资结构不完整`),
    ],
    negotiationSuggestions: [
      "确认薪资构成、年终奖发放条件、试用期薪资和五险一金基数",
      "在回复前确认 offer deadline，并为仍在流程中的更优岗位保留沟通空间",
      "结合城市、岗位方向和成长性，而不只按月薪排序",
    ],
  });
}
