"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageSquare, Send, Trash2 } from "lucide-react";
import { fetchLocations } from "@/lib/api/org";
import {
  addFeedbackResponse,
  deleteFeedback,
  fetchLocationFeedback,
  reopenFeedback,
  resolveFeedback,
} from "@/lib/api/engagement";
import { FeedbackView } from "@/lib/api/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const categoryFilters = [
  { value: "ALL", label: "All" },
  { value: "FACILITY", label: "Facility" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "TRAINER", label: "Trainer" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "BILLING", label: "Billing" },
  { value: "APPLICATION", label: "App" },
  { value: "OTHER", label: "Other" },
];

export default function FeedbackPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState("");

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const activeLocationId = locationId || locationsQuery.data?.[0]?.id || "";

  const feedbackQuery = useQuery({
    queryKey: ["feedback", activeLocationId],
    queryFn: () => fetchLocationFeedback(activeLocationId),
    enabled: !!activeLocationId,
  });

  const filtered = useMemo(
    () =>
      (feedbackQuery.data ?? []).filter(
        (f) => f.state === stateFilter && (categoryFilter === "ALL" || f.category === categoryFilter),
      ),
    [feedbackQuery.data, stateFilter, categoryFilter],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["feedback", activeLocationId] });
  }

  const respondMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => addFeedbackResponse(id, body),
    onSuccess: () => {
      push("success", "Response sent.");
      setResponseDraft("");
      invalidate();
    },
    onError: () => push("error", "Couldn't send that response."),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveFeedback(id),
    onSuccess: () => {
      push("success", "Marked resolved.");
      invalidate();
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenFeedback(id),
    onSuccess: () => {
      push("success", "Reopened.");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFeedback(id),
    onSuccess: () => {
      push("success", "Removed.");
      invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Feedback</h1>
        <p className="mt-1 text-sm text-lb-ink2">Submissions from members and trainers at your locations.</p>
      </div>

      {locationsQuery.data && locationsQuery.data.length > 1 && (
        <div className="max-w-xs">
          <SearchableSelect
            options={locationsQuery.data.map((loc) => ({ value: loc.id, label: loc.name }))}
            value={activeLocationId}
            onChange={setLocationId}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "OPEN", label: "Open", count: feedbackQuery.data?.filter((f) => f.state === "OPEN").length },
            { key: "RESOLVED", label: "Resolved" },
          ]}
          active={stateFilter}
          onChange={(k) => setStateFilter(k as "OPEN" | "RESOLVED")}
        />
        <ChipGroup options={categoryFilters} value={categoryFilter} onChange={setCategoryFilter} />
      </div>

      {feedbackQuery.isLoading ? (
        <SkeletonRows rows={4} />
      ) : feedbackQuery.isError ? (
        <ErrorState message="Couldn't load feedback." onRetry={() => feedbackQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nothing here" />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              expanded={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              responseDraft={expanded === item.id ? responseDraft : ""}
              onDraftChange={setResponseDraft}
              onRespond={() => respondMutation.mutate({ id: item.id, body: responseDraft })}
              respondLoading={respondMutation.isPending}
              onResolve={() => resolveMutation.mutate(item.id)}
              onReopen={() => reopenMutation.mutate(item.id)}
              onDelete={() => confirm("Delete this feedback?") && deleteMutation.mutate(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({
  item,
  expanded,
  onToggle,
  responseDraft,
  onDraftChange,
  onRespond,
  respondLoading,
  onResolve,
  onReopen,
  onDelete,
}: {
  item: FeedbackView;
  expanded: boolean;
  onToggle: () => void;
  responseDraft: string;
  onDraftChange: (v: string) => void;
  onRespond: () => void;
  respondLoading: boolean;
  onResolve: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  return (
    <GlassCard>
      <button className="flex w-full cursor-pointer items-start justify-between text-left" onClick={onToggle}>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold">{item.title}</p>
            <Badge tone="neutral">{item.category}</Badge>
          </div>
          <p className="mt-1 text-sm text-lb-ink2">
            {item.anonymous ? "Anonymous" : item.authorName} · {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-lb-ink2 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-lb-glass-line pt-4">
          <p className="text-sm text-lb-ink2">{item.body}</p>

          {item.responses.length > 0 && (
            <div className="flex flex-col gap-2">
              {item.responses.map((r) => (
                <div key={r.id} className="rounded-[var(--radius-lb-field)] bg-lb-glass px-3 py-2.5 text-sm">
                  <p>{r.body}</p>
                  <p className="mt-1 text-xs text-lb-dim">{r.authorName ?? "Admin"}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={responseDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Write a response…"
              className="h-11 flex-1 rounded-[var(--radius-lb-field)] border border-lb-glass-line-2 bg-lb-glass px-3.5 text-sm text-lb-ink outline-none placeholder:text-lb-dim focus:border-lb-accent"
            />
            <Button size="sm" onClick={onRespond} loading={respondLoading} disabled={!responseDraft.trim()}>
              <Send className="size-3.5" />
            </Button>
          </div>

          <div className="flex gap-2">
            {item.state === "OPEN" ? (
              <Button size="sm" onClick={onResolve}>
                Mark resolved
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={onReopen}>
                Reopen
              </Button>
            )}
            <Button size="sm" variant="subtle" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
