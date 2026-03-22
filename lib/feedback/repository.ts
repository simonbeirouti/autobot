import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateFeedbackSubmissionRequest,
  FeedbackSubmission,
  FeedbackSubmissionType,
} from "@/lib/feedback/types";

type FeedbackSubmissionRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  type: FeedbackSubmissionType;
  score: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

function mapFeedbackSubmission(row: FeedbackSubmissionRow): FeedbackSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    type: row.type,
    score: row.score,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFeedbackSubmission(
  supabase: SupabaseClient,
  params: CreateFeedbackSubmissionRequest & {
    userId: string;
    userEmail?: string | null;
    userName?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("feedback_submissions")
    .insert({
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      user_name: params.userName ?? null,
      type: params.type,
      score: params.score,
      title: params.title.trim(),
      description: params.description.trim(),
    })
    .select(
      "id, user_id, user_email, user_name, type, score, title, description, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapFeedbackSubmission(data as FeedbackSubmissionRow);
}
