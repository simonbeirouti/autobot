export const FEEDBACK_SUBMISSION_TYPES = ["feedback", "feature_request"] as const;

export type FeedbackSubmissionType = (typeof FEEDBACK_SUBMISSION_TYPES)[number];

export type FeedbackSubmission = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: FeedbackSubmissionType;
  score: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateFeedbackSubmissionRequest = {
  type: FeedbackSubmissionType;
  score: number;
  title: string;
  description: string;
};
