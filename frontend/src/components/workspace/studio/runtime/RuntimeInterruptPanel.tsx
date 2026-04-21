"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResumeRuntimeSession } from "@/core/studio/hooks/use-runtime-hitl";
import type { RuntimeInterrupt, RuntimeSession } from "@/core/studio/types/runtime";

export function RuntimeInterruptPanel({
  session,
}: {
  session: RuntimeSession | null;
}) {
  const resume = useResumeRuntimeSession(session?.sessionId);
  const [reviseText, setReviseText] = useState("");
  const [customJson, setCustomJson] = useState("{}");

  if (session?.status !== "waiting_human") {
    return null;
  }

  const intr: RuntimeInterrupt | undefined = session.currentInterrupt ?? undefined;

  const onApprove = async () => {
    try {
      await resume.mutateAsync({
        actionType: "approve",
        resumeValue: { approved: true },
      });
      toast.success("已批准并恢复运行");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const onReject = async () => {
    try {
      await resume.mutateAsync({
        actionType: "reject",
        resumeValue: { approved: false },
      });
      toast.success("已拒绝");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const onRevise = async () => {
    try {
      await resume.mutateAsync({
        actionType: "revise",
        resumeValue: { text: reviseText },
        comment: reviseText,
      });
      toast.success("已提交修改意见");
      setReviseText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const onCustom = async () => {
    try {
      const parsed = JSON.parse(customJson) as Record<string, unknown>;
      await resume.mutateAsync({
        actionType: "custom_resume",
        resumeValue: parsed,
      });
      toast.success("已发送自定义恢复");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "JSON 无效或请求失败");
    }
  };

  return (
    <Card className="border-amber-500/50">
      <CardHeader className="py-3">
        <CardTitle className="text-base text-amber-700 dark:text-amber-400">
          等待人工 (HITL)
        </CardTitle>
        <CardDescription>
          {intr?.prompt ?? "需要人工确认后才能继续执行"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onApprove} disabled={resume.isPending}>
            批准
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onReject}
            disabled={resume.isPending}
          >
            拒绝
          </Button>
        </div>
        <div>
          <Label className="text-xs">修改意见 (revise)</Label>
          <Textarea
            className="mt-1 min-h-[72px]"
            value={reviseText}
            onChange={(e) => setReviseText(e.target.value)}
            placeholder="输入修改意见..."
          />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={onRevise}
            disabled={resume.isPending || !reviseText.trim()}
          >
            提交修改
          </Button>
        </div>
        <div>
          <Label className="text-xs">自定义 resume JSON</Label>
          <Textarea
            className="mt-1 font-mono text-xs"
            value={customJson}
            onChange={(e) => setCustomJson(e.target.value)}
            rows={4}
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onCustom}
            disabled={resume.isPending}
          >
            发送 JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
