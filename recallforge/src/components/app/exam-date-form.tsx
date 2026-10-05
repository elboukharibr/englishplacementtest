"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { api, ApiError } from "@/lib/client";

export function ExamDateForm({ current }: { current: string }) {
  const router = useRouter();
  const [v, setV] = useState(current);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/settings", { method: "PATCH", body: { examDate: v || null } });
          toast.success(v ? "Exam date saved — plan updated." : "Exam date removed.");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Couldn't save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="exam-date" className="text-sm text-muted">
        Exam date
      </label>
      <Input id="exam-date" type="date" value={v} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setV(e.target.value)} className="w-auto" />
      <Button type="submit" variant="secondary" loading={busy}>
        {current ? "Update" : "Build my study plan"}
      </Button>
    </form>
  );
}
