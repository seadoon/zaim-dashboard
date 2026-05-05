"use client";

import { RefreshCw, Github, HelpCircle } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { IconButton } from "../ui/icon-button";

interface ActionIconsProps {
  variant: "header" | "sidebar";
}

export function ActionIcons({ variant }: ActionIconsProps) {
  const iconSize = variant === "header" ? "h-4.5 w-4.5" : "h-5 w-5";
  const githubOrg = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  const workflowUrl =
    githubOrg && githubRepo
      ? `https://github.com/${githubOrg}/${githubRepo}/actions/workflows/daily-update.yml`
      : null;

  if (variant === "sidebar") {
    return (
      <div className="border-t p-4 flex items-center gap-1 lg:hidden">
        <HelpButton iconSize={iconSize} />
        <GitHubButton iconSize={iconSize} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <ReloadButton iconSize={iconSize} workflowUrl={workflowUrl} />
      <GitHubButton iconSize={iconSize} className="hidden lg:block" />
      <HelpButton iconSize={iconSize} className="hidden lg:block" />
    </div>
  );
}

function HelpButton({ iconSize, className }: { iconSize: string; className?: string }) {
  return (
    <Dialog>
      <DialogTrigger className={className}>
        <IconButton icon={<HelpCircle className={iconSize} />} ariaLabel="ヘルプ" />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Zaim Dashboard について</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-sm text-muted-foreground space-y-4">
            <p>Zaim の家計データを自動取得・可視化するダッシュボードです。</p>
            <div>
              <h3 className="font-semibold mb-2 text-foreground">機能</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  <span className="font-medium text-foreground">収支の可視化</span>
                  <span className="block ml-5 mt-1">
                    月別・カテゴリ別に収入・支出を確認できます。
                  </span>
                </li>
                <li>
                  <span className="font-medium text-foreground">自動データ取得</span>
                  <span className="block ml-5 mt-1">
                    GitHub Actions で毎日 Zaim からデータを自動取得します。
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

function GitHubButton({ iconSize, className }: { iconSize: string; className?: string }) {
  const githubOrg = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  const repoUrl =
    githubOrg && githubRepo ? `https://github.com/${githubOrg}/${githubRepo}` : "#";

  return (
    <IconButton
      icon={<Github className={iconSize} />}
      href={repoUrl as `https://${string}`}
      ariaLabel="GitHub"
      className={className}
      isExternal
    />
  );
}

function ReloadButton({ iconSize, workflowUrl }: { iconSize: string; workflowUrl: string | null }) {
  if (!workflowUrl) return null;

  return (
    <IconButton
      icon={<RefreshCw className={iconSize} />}
      href={workflowUrl as `https://${string}`}
      ariaLabel="ワークフローを実行"
      isExternal
    />
  );
}
