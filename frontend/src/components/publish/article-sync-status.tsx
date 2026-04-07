"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadArticleSyncJS,
  isArticleSyncLoaded,
} from "@/lib/article-sync";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ArticleSyncStatusProps {
  onLoaded?: (loaded: boolean) => void;
  className?: string;
}

export function ArticleSyncStatus({
  onLoaded,
  className,
}: ArticleSyncStatusProps) {
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // 检查加载状态
  const checkLoaded = async () => {
    setLoading(true);
    try {
      const isLoaded = isArticleSyncLoaded();
      setLoaded(isLoaded);
      onLoaded?.(isLoaded);

      if (!isLoaded) {
        // 尝试加载
        const success = await loadArticleSyncJS();
        setLoaded(success);
        onLoaded?.(success);

        if (success) {
          toast.success("Article Sync JS 加载成功");
        } else {
          toast.error("Article Sync JS 加载失败");
        }
      }
    } catch (error) {
      console.error("检查失败:", error);
      setLoaded(false);
      onLoaded?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLoaded();
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Article Sync JS</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkLoaded}
          disabled={loading}
        >
          {loading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 状态卡片 */}
      <div
        className={cn(
          "rounded-lg border p-4",
          loaded === true && "border-green-500 bg-green-50",
          loaded === false && "border-red-500 bg-red-50",
          loaded === null && "border-gray-300 bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          {loaded === null && (
            <>
              <Loader2Icon className="h-5 w-5 animate-spin text-gray-500" />
              <div>
                <div className="font-medium">加载中...</div>
                <div className="text-muted-foreground text-sm">
                  正在加载 Article Sync JS 库
                </div>
              </div>
            </>
          )}

          {loaded === true && (
            <>
              <CheckCircle2Icon className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">库已加载</div>
                <div className="text-green-700 text-sm">
                  可以使用 Article Sync 发布文章
                </div>
              </div>
              <div className="ml-auto">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://github.com/wechatsync/article-syncjs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看文档
                  </a>
                </Button>
              </div>
            </>
          )}

          {loaded === false && (
            <>
              <XCircleIcon className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-medium text-red-900">加载失败</div>
                <div className="text-red-700 text-sm">
                  请检查网络连接或使用其他发布方式
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={checkLoaded}
              >
                重试
              </Button>
            </>
          )}
        </div>
      </div>
      
    </div>
  );
}
