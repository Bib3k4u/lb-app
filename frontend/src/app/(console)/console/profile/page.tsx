"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateMe } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");

  const mutation = useMutation({
    mutationFn: () => updateMe({ firstName, lastName }),
    onSuccess: async () => {
      await refresh();
      push("success", "Profile updated.");
    },
    onError: () => push("error", "Couldn't update your profile."),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Your profile</h1>
        <p className="mt-1 text-sm text-lb-ink2">
          Fitness details, workouts and nutrition are managed in the LimitBeyond mobile app.
        </p>
      </div>

      <GlassCard className="max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <TextField label="Email" value={user?.email ?? ""} disabled />
          <TextField label="Phone" value={user?.phoneE164 ?? ""} disabled />

          <div className="flex flex-wrap gap-2">
            {user?.grants.map((g, i) => (
              <Badge key={i} tone="accent">
                {g.role.replace(/_/g, " ")}
                {g.gymWide ? " · gym-wide" : ""}
              </Badge>
            ))}
          </div>

          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} className="mt-2">
            Save changes
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
