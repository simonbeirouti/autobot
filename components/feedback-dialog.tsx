"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/query/dashboard";
import type {
  CreateFeedbackSubmissionRequest,
  FeedbackSubmission,
  FeedbackSubmissionType,
} from "@/lib/feedback/types";

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

const TAB_COPY: Record<
  FeedbackSubmissionType,
  {
    description: string;
    scoreLabel: string;
    submitLabel: string;
    title: string;
  }
> = {
  feedback: {
    title: "Product feedback",
    description: "Share what is working, what is not, and how the experience feels overall.",
    scoreLabel: "Feedback score",
    submitLabel: "Submit feedback",
  },
  feature_request: {
    title: "Feature request",
    description: "Describe the capability you want and how urgent it is for your workflow.",
    scoreLabel: "Urgency score",
    submitLabel: "Submit request",
  },
};

async function submitFeedback(payload: CreateFeedbackSubmissionRequest) {
  return fetchJson<FeedbackSubmission>("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function createInitialState() {
  return {
    description: "",
    score: 0,
    title: "",
    type: "feedback" as FeedbackSubmissionType,
  };
}

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(createInitialState);
  const [error, setError] = useState<string | null>(null);

  const copy = TAB_COPY[form.type];
  const titleIsValid = form.title.trim().length > 0;
  const descriptionIsValid = form.description.trim().length > 0;
  const scoreIsValid = form.score >= 1 && form.score <= 10;
  const canSubmit = titleIsValid && descriptionIsValid && scoreIsValid;

  const feedbackMutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      setError(null);
      setForm(createInitialState());
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to submit feedback right now.",
      );
    },
  });

  const helperText = useMemo(() => {
    if (!scoreIsValid) {
      return `Select a score from 1 to 10 for the ${form.type === "feedback" ? "review" : "urgency"}.`;
    }

    return form.type === "feedback"
      ? "1 is very poor and 10 is excellent."
      : "1 is not urgent and 10 is critical.";
  }, [form.type, scoreIsValid]);

  function handleOpenChange(nextOpen: boolean) {
    if (!feedbackMutation.isPending && !nextOpen) {
      setError(null);
    }

    onOpenChange(nextOpen);
  }

  function handleSubmit() {
    if (!canSubmit || feedbackMutation.isPending) {
      setError("Complete the score, title, and description before submitting.");
      return;
    }

    setError(null);
    feedbackMutation.mutate({
      type: form.type,
      score: form.score,
      title: form.title.trim(),
      description: form.description.trim(),
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!feedbackMutation.isPending}>
        <DialogHeader>
          <DialogTitle>Share feedback</DialogTitle>
          <DialogDescription>
            Help us improve AutoBot by sharing product feedback or requesting a feature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Tabs
            className="gap-3"
            onValueChange={(value) => {
              setError(null);
              setForm((current) => ({
                ...current,
                type: value as FeedbackSubmissionType,
              }));
            }}
            value={form.type}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="feature_request">Feature request</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1">
            <p className="text-sm font-medium">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{copy.description}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium" htmlFor="feedback-score-group">
                {copy.scoreLabel}
              </label>
              <span className="text-xs text-muted-foreground">
                {form.score > 0 ? `Selected: ${form.score}` : "Select one"}
              </span>
            </div>
            <ButtonGroup
              className="grid w-full grid-cols-5 gap-0 sm:grid-cols-10"
              id="feedback-score-group"
            >
              {SCORE_OPTIONS.map((score) => (
                <Button
                  key={score}
                  onClick={() => {
                    setError(null);
                    setForm((current) => ({ ...current, score }));
                  }}
                  type="button"
                  variant={form.score === score ? "secondary" : "outline"}
                >
                  {score}
                </Button>
              ))}
            </ButtonGroup>
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="feedback-title">
              Title
            </label>
            <Input
              id="feedback-title"
              maxLength={120}
              onChange={(event) => {
                setError(null);
                setForm((current) => ({ ...current, title: event.target.value }));
              }}
              placeholder={
                form.type === "feedback"
                  ? "Summarize the experience"
                  : "Name the feature you need"
              }
              value={form.title}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="feedback-description">
              Description
            </label>
            <Textarea
              className="min-h-32"
              id="feedback-description"
              maxLength={2000}
              onChange={(event) => {
                setError(null);
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
              placeholder={
                form.type === "feedback"
                  ? "What happened, and what would make it better?"
                  : "Describe the use case, impact, and ideal outcome."
              }
              value={form.description}
            />
          </div>

          {error ? (
            <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button
            className="w-full"
            disabled={feedbackMutation.isPending}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="w-full"
            disabled={!canSubmit || feedbackMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {feedbackMutation.isPending ? "Submitting..." : copy.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
