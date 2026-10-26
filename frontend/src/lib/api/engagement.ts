"use client";

import { api } from "./client";
import { FeedbackView } from "./types";

export function fetchLocationFeedback(locationId: string) {
  return api.get<FeedbackView[]>(`locations/${locationId}/feedback`);
}

export function fetchFeedback(id: string) {
  return api.get<FeedbackView>(`feedback/${id}`);
}

export function updateFeedback(
  id: string,
  input: { title: string; category: string; body: string; anonymous: boolean },
) {
  return api.patch<FeedbackView>(`feedback/${id}`, input);
}

export function deleteFeedback(id: string) {
  return api.del<void>(`feedback/${id}`);
}

export function addFeedbackResponse(id: string, body: string) {
  return api.post<FeedbackView>(`feedback/${id}/responses`, { body });
}

export function updateFeedbackResponse(id: string, responseId: string, body: string) {
  return api.patch<FeedbackView>(`feedback/${id}/responses/${responseId}`, { body });
}

export function deleteFeedbackResponse(id: string, responseId: string) {
  return api.del<void>(`feedback/${id}/responses/${responseId}`);
}

export function resolveFeedback(id: string) {
  return api.post<void>(`feedback/${id}/resolve`, {});
}

export function reopenFeedback(id: string) {
  return api.post<void>(`feedback/${id}/reopen`, {});
}
