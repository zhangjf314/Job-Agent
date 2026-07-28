import type { ApplicationInsightResult, OfferComparisonResult } from "@/schemas/application";
import type { InterviewFeedbackAnalysis } from "@/types/application";
import { generateApplicationInsightFromContext } from "@/services/applications/application-insight-engine";
import { analyzeInterviewFeedback } from "@/services/applications/interview-feedback-analyzer";
import { compareOfferRecords } from "@/services/applications/offer-comparator";

export interface ApplicationCoachProvider {
  analyzeInterviewFeedback(feedbackText: string, context?: unknown): Promise<InterviewFeedbackAnalysis>;
  generateApplicationInsight(applicationContext: unknown): Promise<ApplicationInsightResult>;
  compareOffers(profileId: string, offers: unknown[]): Promise<OfferComparisonResult>;
}

export class MockApplicationCoachProvider implements ApplicationCoachProvider {
  async analyzeInterviewFeedback(feedbackText: string): Promise<InterviewFeedbackAnalysis> {
    return analyzeInterviewFeedback(feedbackText);
  }

  async generateApplicationInsight(applicationContext: unknown): Promise<ApplicationInsightResult> {
    return generateApplicationInsightFromContext(applicationContext as Parameters<typeof generateApplicationInsightFromContext>[0]);
  }

  async compareOffers(_profileId: string, offers: unknown[]): Promise<OfferComparisonResult> {
    return compareOfferRecords(offers as Parameters<typeof compareOfferRecords>[0]);
  }
}
