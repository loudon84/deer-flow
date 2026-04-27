"use client";

import type { ChatStatus } from "ai";
import {
  CheckIcon,
  GraduationCapIcon,
  LightbulbIcon,
  PaperclipIcon,
  RocketIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";

import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { useI18n } from "@/core/i18n/hooks";
import { useModels } from "@/core/models/hooks";
import type { RuntimeRequestContext } from "@/core/studio/types/runtime";
import { cn } from "@/lib/utils";

import type { RuntimeSessionStatus } from "./types";

// ─── 类型定义 ───

type InputMode = "flash" | "thinking" | "pro" | "ultra";

function getResolvedMode(
  mode: InputMode | undefined,
  supportsThinking: boolean,
): InputMode {
  if (!supportsThinking && mode !== "flash") {
    return "flash";
  }
  if (mode) {
    return mode;
  }
  return supportsThinking ? "pro" : "flash";
}

// ─── Props ───

export interface ChatInputBoxProps
  extends Omit<ComponentProps<typeof PromptInput>, "onSubmit"> {
  sessionId: string | undefined;
  sessionStatus: RuntimeSessionStatus;
  requestContext: RuntimeRequestContext;
  onContextChange: (context: RuntimeRequestContext) => void;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onStop: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  initialValue?: string;
}

// ─── 组件 ───

export function ChatInputBox({
  sessionId,
  sessionStatus,
  requestContext,
  onContextChange,
  onSubmit,
  onStop,
  disabled,
  autoFocus,
  initialValue,
  className,
  ...props
}: ChatInputBoxProps) {
  const { t } = useI18n();
  const { models } = useModels();
  const { textInput } = usePromptInputController();
  const promptRootRef = useRef<HTMLDivElement | null>(null);

  // 状态
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 计算状态
  const status: ChatStatus =
    sessionStatus === "streaming" || sessionStatus === "waiting_human"
      ? "streaming"
      : sessionStatus === "failed"
        ? "error"
        : "ready";

  const isStreaming = status === "streaming";
  const isDisabled = disabled || isSubmitting || !sessionId;

  // 模型选择
  const selectedModel = useMemo(() => {
    if (models.length === 0) return undefined;
    return (
      models.find((m) => m.name === requestContext.modelName) ?? models[0]
    );
  }, [requestContext.modelName, models]);

  const resolvedModelName = selectedModel?.name;

  const supportThinking = useMemo(
    () => selectedModel?.supports_thinking ?? false,
    [selectedModel],
  );

  const supportReasoningEffort = useMemo(
    () => selectedModel?.supports_reasoning_effort ?? false,
    [selectedModel],
  );

  // 自动选择模型
  useEffect(() => {
    if (models.length === 0) return;
    const currentModel = models.find(
      (m) => m.name === requestContext.modelName,
    );
    const fallbackModel = currentModel ?? models[0]!;
    const supportsThinking = fallbackModel.supports_thinking ?? false;
    const nextModelName = fallbackModel.name;

    // 从 requestContext 推断当前 mode
    const currentMode = inferMode(requestContext);
    const nextMode = getResolvedMode(currentMode, supportsThinking);

    if (
      requestContext.modelName === nextModelName &&
      inferMode(requestContext) === nextMode
    ) {
      return;
    }

    onContextChange({
      ...requestContext,
      modelName: nextModelName,
      ...modeToContextPatch(nextMode),
    });
  }, [requestContext, models, onContextChange]);

  // 模式推断
  const currentMode: InputMode = inferMode(requestContext);

  // ─── 事件处理 ───

  const handleModelSelect = useCallback(
    (modelName: string) => {
      const model = models.find((m) => m.name === modelName);
      if (!model) return;

      const supportsThinking = model.supports_thinking ?? false;
      const nextMode = getResolvedMode(currentMode, supportsThinking);

      onContextChange({
        ...requestContext,
        modelName,
        ...modeToContextPatch(nextMode),
      });
      setModelDialogOpen(false);
    },
    [onContextChange, requestContext, models, currentMode],
  );

  const handleModeSelect = useCallback(
    (mode: InputMode) => {
      onContextChange({
        ...requestContext,
        ...modeToContextPatch(mode),
      });
    },
    [onContextChange, requestContext],
  );

  const handleReasoningEffortSelect = useCallback(
    (effort: "low" | "medium" | "high") => {
      onContextChange({
        ...requestContext,
        reasoningEffort: effort,
      });
    },
    [onContextChange, requestContext],
  );

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (status === "streaming") {
        onStop();
        return;
      }
      if (!message.text?.trim()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [status, onStop, onSubmit],
  );

  // ─── 渲染 ───

  return (
    <div ref={promptRootRef} className="relative">
      <PromptInput
        className={cn(
          "bg-background/85 rounded-2xl backdrop-blur-sm transition-all duration-300 ease-out *:data-[slot='input-group']:rounded-2xl",
          className,
        )}
        disabled={isDisabled}
        globalDrop
        multiple
        onSubmit={handleSubmit}
        {...props}
      >
        {/* 文件附件列表 */}
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>

        {/* 输入区域 */}
        <PromptInputBody className="absolute top-0 right-0 left-0 z-3">
          <PromptInputTextarea
            className="size-full"
            disabled={isDisabled}
            placeholder={t.inputBox.placeholder}
            autoFocus={autoFocus}
            defaultValue={initialValue}
          />
        </PromptInputBody>

        {/* 底部工具栏 */}
        <PromptInputFooter className="flex">
          <PromptInputTools>
            {/* 添加附件按钮 */}
            <AddAttachmentsButton className="px-2!" />

            {/* 模式选择 */}
            <PromptInputActionMenu>
              <ModeTrigger mode={currentMode} t={t} />
              <PromptInputActionMenuContent className="w-80">
                <ModeMenuContent
                  mode={currentMode}
                  supportThinking={supportThinking}
                  onSelect={handleModeSelect}
                  t={t}
                />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>

            {/* 推理强度选择 */}
            {supportReasoningEffort && currentMode !== "flash" && (
              <PromptInputActionMenu>
                <ReasoningEffortTrigger
                  effort={requestContext.reasoningEffort}
                  t={t}
                />
                <PromptInputActionMenuContent className="w-70">
                  <ReasoningEffortMenuContent
                    effort={requestContext.reasoningEffort}
                    onSelect={handleReasoningEffortSelect}
                    t={t}
                  />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            )}
          </PromptInputTools>

          <PromptInputTools>
            {/* 模型选择 */}
            <ModelSelector
              open={modelDialogOpen}
              onOpenChange={setModelDialogOpen}
            >
              <ModelSelectorTrigger asChild>
                <PromptInputButton>
                  <div className="flex min-w-0 flex-col items-start text-left">
                    <ModelSelectorName className="text-xs font-normal">
                      {selectedModel?.display_name}
                    </ModelSelectorName>
                  </div>
                </PromptInputButton>
              </ModelSelectorTrigger>
              <ModelSelectorContent>
                <ModelSelectorInput placeholder={t.inputBox.searchModels} />
                <ModelSelectorList>
                  {models.map((m) => (
                    <ModelSelectorItem
                      key={m.name}
                      value={m.name}
                      onSelect={() => handleModelSelect(m.name)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <ModelSelectorName>{m.display_name}</ModelSelectorName>
                        <span className="text-muted-foreground truncate text-[10px]">
                          {m.model}
                        </span>
                      </div>
                      {m.name === requestContext.modelName ? (
                        <CheckIcon className="ml-auto size-4" />
                      ) : (
                        <div className="ml-auto size-4" />
                      )}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelector>

            {/* 发送/停止按钮 */}
            <PromptInputSubmit
              className="rounded-full"
              disabled={isDisabled}
              variant="outline"
              status={status}
            />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

// ─── 辅助组件 ───

function AddAttachmentsButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      className={cn("px-2!", className)}
      onClick={() => attachments.openFileDialog()}
    >
      <PaperclipIcon className="size-3" />
    </PromptInputButton>
  );
}

function ModeTrigger({ mode, t }: { mode: InputMode; t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <PromptInputActionMenuTrigger className="gap-1! px-2!">
      <div>
        {mode === "flash" && <ZapIcon className="size-3" />}
        {mode === "thinking" && <LightbulbIcon className="size-3" />}
        {mode === "pro" && <GraduationCapIcon className="size-3" />}
        {mode === "ultra" && (
          <RocketIcon className="size-3 text-[#dabb5e]" />
        )}
      </div>
      <div
        className={cn(
          "text-xs font-normal",
          mode === "ultra" ? "golden-text" : "",
        )}
      >
        {(mode === "flash" && t.inputBox.flashMode) ||
          (mode === "thinking" && t.inputBox.reasoningMode) ||
          (mode === "pro" && t.inputBox.proMode) ||
          (mode === "ultra" && t.inputBox.ultraMode)}
      </div>
    </PromptInputActionMenuTrigger>
  );
}

function ModeMenuContent({
  mode,
  supportThinking,
  onSelect,
  t,
}: {
  mode: InputMode;
  supportThinking: boolean;
  onSelect: (mode: InputMode) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <>
      <PromptInputActionMenuItem
        className={cn(
          mode === "flash"
            ? "text-accent-foreground"
            : "text-muted-foreground/65",
        )}
        onSelect={() => onSelect("flash")}
      >
        <ModeItemContent
          icon={ZapIcon}
          label={t.inputBox.flashMode}
          description={t.inputBox.flashModeDescription}
          selected={mode === "flash"}
        />
      </PromptInputActionMenuItem>
      {supportThinking && (
        <PromptInputActionMenuItem
          className={cn(
            mode === "thinking"
              ? "text-accent-foreground"
              : "text-muted-foreground/65",
          )}
          onSelect={() => onSelect("thinking")}
        >
          <ModeItemContent
            icon={LightbulbIcon}
            label={t.inputBox.reasoningMode}
            description={t.inputBox.reasoningModeDescription}
            selected={mode === "thinking"}
          />
        </PromptInputActionMenuItem>
      )}
      <PromptInputActionMenuItem
        className={cn(
          mode === "pro"
            ? "text-accent-foreground"
            : "text-muted-foreground/65",
        )}
        onSelect={() => onSelect("pro")}
      >
        <ModeItemContent
          icon={GraduationCapIcon}
          label={t.inputBox.proMode}
          description={t.inputBox.proModeDescription}
          selected={mode === "pro"}
        />
      </PromptInputActionMenuItem>
      <PromptInputActionMenuItem
        className={cn(
          mode === "ultra"
            ? "text-accent-foreground"
            : "text-muted-foreground/65",
        )}
        onSelect={() => onSelect("ultra")}
      >
        <ModeItemContent
          icon={RocketIcon}
          label={t.inputBox.ultraMode}
          description={t.inputBox.ultraModeDescription}
          selected={mode === "ultra"}
          isUltra
        />
      </PromptInputActionMenuItem>
    </>
  );
}

function ModeItemContent({
  icon: Icon,
  label,
  description,
  selected,
  isUltra,
}: {
  icon: typeof ZapIcon;
  label: string;
  description: string;
  selected: boolean;
  isUltra?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 font-bold">
        <Icon
          className={cn(
            "mr-2 size-4",
            selected && !isUltra && "text-accent-foreground",
            isUltra && "text-[#dabb5e]",
          )}
        />
        <div className={cn(isUltra && "golden-text")}>{label}</div>
      </div>
      <div className="pl-7 text-xs">{description}</div>
      {selected ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </div>
  );
}

function ReasoningEffortTrigger({
  effort,
  t,
}: {
  effort: RuntimeRequestContext["reasoningEffort"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <PromptInputActionMenuTrigger className="gap-1! px-2!">
      <div className="text-xs font-normal">
        {t.inputBox.reasoningEffort}:
        {effort === "low" && " " + t.inputBox.reasoningEffortLow}
        {effort === "medium" && " " + t.inputBox.reasoningEffortMedium}
        {effort === "high" && " " + t.inputBox.reasoningEffortHigh}
        {!effort && " " + t.inputBox.reasoningEffortMedium}
      </div>
    </PromptInputActionMenuTrigger>
  );
}

function ReasoningEffortMenuContent({
  effort,
  onSelect,
  t,
}: {
  effort: RuntimeRequestContext["reasoningEffort"];
  onSelect: (effort: "low" | "medium" | "high") => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const items: Array<{
    key: "low" | "medium" | "high";
    label: string;
    description: string;
  }> = [
    {
      key: "low",
      label: t.inputBox.reasoningEffortLow,
      description: t.inputBox.reasoningEffortLowDescription,
    },
    {
      key: "medium",
      label: t.inputBox.reasoningEffortMedium,
      description: t.inputBox.reasoningEffortMediumDescription,
    },
    {
      key: "high",
      label: t.inputBox.reasoningEffortHigh,
      description: t.inputBox.reasoningEffortHighDescription,
    },
  ];

  return (
    <>
      {items.map((item) => (
        <PromptInputActionMenuItem
          key={item.key}
          className={cn(
            effort === item.key
              ? "text-accent-foreground"
              : "text-muted-foreground/65",
          )}
          onSelect={() => onSelect(item.key)}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 font-bold">
              {item.label}
            </div>
            <div className="pl-2 text-xs">{item.description}</div>
          </div>
          {effort === item.key ? (
            <CheckIcon className="ml-auto size-4" />
          ) : (
            <div className="ml-auto size-4" />
          )}
        </PromptInputActionMenuItem>
      ))}
    </>
  );
}

// ─── 辅助函数 ───

function inferMode(ctx: RuntimeRequestContext): InputMode {
  if (ctx.subagentEnabled) return "ultra";
  if (ctx.planMode && ctx.mode === "pro") return "pro";
  if (ctx.thinkingEnabled && ctx.mode === "basic") return "thinking";
  if (!ctx.thinkingEnabled) return "flash";
  return "pro";
}

function modeToContextPatch(mode: InputMode): Partial<RuntimeRequestContext> {
  return {
    mode: mode === "flash" || mode === "thinking" ? "basic" : "pro",
    thinkingEnabled: mode !== "flash",
    planMode: mode === "pro" || mode === "ultra",
    subagentEnabled: mode === "ultra",
    reasoningEffort:
      mode === "ultra"
        ? "high"
        : mode === "pro"
          ? "medium"
          : mode === "thinking"
            ? "low"
            : "low", // flash 默认使用 low
  };
}
