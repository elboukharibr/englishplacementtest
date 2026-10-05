// Plan definitions and fair-use quotas. Pro is not "unlimited": generation is capped
// because every card costs real inference money (see README → AI cost control).
import type { Plan } from "@prisma/client";

export type PlanLimits = {
  documentsPerPeriod: number;
  pagesPerDocument: number;
  pagesPerPeriod: number;
  cardsPerPeriod: number;
  aiRequestsPerPeriod: number; // tutor messages, exam grading, card improvements
  maxUploadMb: number;
  maxCardsPerDeck: number;
  features: {
    examMode: boolean;
    oralExam: boolean;
    tutor: boolean;
    knowledgeMap: boolean;
    advancedAnalytics: boolean;
    studyPlan: boolean;
    ankiExport: boolean;
    advancedCardTypes: boolean;
    priorityProcessing: boolean;
  };
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    documentsPerPeriod: 2,
    pagesPerDocument: 30,
    pagesPerPeriod: 60,
    cardsPerPeriod: 100,
    aiRequestsPerPeriod: 20,
    maxUploadMb: 15,
    maxCardsPerDeck: 40,
    features: {
      examMode: false,
      oralExam: false,
      tutor: false,
      knowledgeMap: false,
      advancedAnalytics: false,
      studyPlan: false,
      ankiExport: false,
      advancedCardTypes: false,
      priorityProcessing: false,
    },
  },
  PRO: {
    documentsPerPeriod: 25,
    pagesPerDocument: 400,
    pagesPerPeriod: 2000,
    cardsPerPeriod: 2000,
    aiRequestsPerPeriod: 600,
    maxUploadMb: 50,
    maxCardsPerDeck: 200,
    features: {
      examMode: true,
      oralExam: true,
      tutor: true,
      knowledgeMap: true,
      advancedAnalytics: true,
      studyPlan: true,
      ankiExport: true,
      advancedCardTypes: true,
      priorityProcessing: true,
    },
  },
};

export const BASIC_CARD_TYPES = ["basic", "definition", "cloze"] as const;

export const PRICING = {
  monthly: { amount: 15, label: "$15", per: "month" },
  yearly: { amount: 120, label: "$120", per: "year", monthlyEquivalent: 10, savings: 60 },
} as const;

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export type Feature = keyof PlanLimits["features"];

/** Subscription statuses that grant Pro access. past_due keeps access during Stripe's retry window. */
export function statusGrantsPro(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}
