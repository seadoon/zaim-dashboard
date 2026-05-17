import type { NotificationData } from "./types.js";
import { log, info, error } from "./logger.js";

const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";
const DISCORD_MAX_CONTENT_LENGTH = 2000;
const SECTION_DIVIDER = "────────────────";

type DiscordWebhookPayload = {
  content: string;
  avatar_url?: string;
};

function getWebhookUrl(): string | undefined {
  return process.env.DISCORD_WEBHOOK_URL;
}

function getAvatarUrl(): string | undefined {
  return process.env.DISCORD_AVATAR_URL;
}

export async function sendDiscordNotification(data: NotificationData): Promise<void> {
  const webhookUrl = getWebhookUrl();
  const avatarUrl = getAvatarUrl();

  if (!webhookUrl) {
    log("DISCORD_WEBHOOK_URL is not set, skipping Discord notification");
    return;
  }

  if (!webhookUrl.startsWith(DISCORD_WEBHOOK_PREFIX)) {
    error(`DISCORD_WEBHOOK_URL is invalid, expected prefix: ${DISCORD_WEBHOOK_PREFIX}`);
    return;
  }

  const content = buildSummaryContent(data);
  const payloads = buildPayloads(content, avatarUrl);

  await postPayloads(webhookUrl, payloads);
  info("Discord notification sent successfully!");
}

export async function sendDiscordErrorNotification(err: Error): Promise<void> {
  const webhookUrl = getWebhookUrl();
  const avatarUrl = getAvatarUrl();

  if (!webhookUrl) {
    error("DISCORD_WEBHOOK_URL is not set, cannot send error notification");
    return;
  }

  if (!webhookUrl.startsWith(DISCORD_WEBHOOK_PREFIX)) {
    error(`DISCORD_WEBHOOK_URL is invalid, expected prefix: ${DISCORD_WEBHOOK_PREFIX}`);
    return;
  }

  const now = new Date();
  const timestamp = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const content = buildErrorContent(err.message, timestamp);
  const payloads = buildPayloads(content, avatarUrl);

  await postPayloads(webhookUrl, payloads);
  info("Discord error notification sent successfully!");
}

function buildPayloads(content: string, avatarUrl: string | undefined): DiscordWebhookPayload[] {
  const chunks = splitContentByLine(content, DISCORD_MAX_CONTENT_LENGTH);
  return chunks.map((chunk) => ({
    content: chunk,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }));
}

async function postPayloads(webhookUrl: string, payloads: DiscordWebhookPayload[]): Promise<void> {
  for (const payload of payloads) {
    await postWebhook(webhookUrl, payload);
  }
}

async function postWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "<no body>");
    throw new Error(
      `Discord Webhook request failed with status ${response.status} ${response.statusText}: ${bodyText}`,
    );
  }
}

function formatAmount(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDailyChange(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}¥${n.toLocaleString("ja-JP")}`;
}

function buildSummaryContent(data: NotificationData): string {
  const {
    combinedTotal,
    zaimBankTotal,
    mfSecuritiesTotal,
    zaimBankItems,
    mfAssetBreakdown,
    mfDailyChange,
    monthlyChange,
    monthlyChangePercent,
    updatedAt,
  } = data;

  const dailyChangeText = mfDailyChange !== null ? formatDailyChange(mfDailyChange) : "-";

  const lines: string[] = [
    "**💰 資産更新レポート**",
    "",
    "**総資産**",
    formatAmount(combinedTotal),
    "",
    `**前日比** ${dailyChangeText}`,
    `**今月比** ${monthlyChange} (${monthlyChangePercent})`,
  ];

  if (mfAssetBreakdown.length > 0) {
    lines.push("", SECTION_DIVIDER, "", "**資産内訳（MoneyForward）**");
    for (const item of mfAssetBreakdown) {
      lines.push(`${item.category}: **${formatAmount(item.amount)}**`);
    }
  }

  lines.push("", SECTION_DIVIDER, "", `**銀行・現金（Zaim）** ${formatAmount(zaimBankTotal)}`);

  if (zaimBankItems.length > 0) {
    for (const item of zaimBankItems) {
      lines.push(`• ${item.name}: ${formatAmount(item.balance)}`);
    }
  } else {
    lines.push("• データなし（Zaimクローラー未実行）");
  }

  if (mfSecuritiesTotal > 0 && mfAssetBreakdown.length === 0) {
    lines.push("", `**証券（MoneyForward）** ${formatAmount(mfSecuritiesTotal)}`);
  }

  if (data.accountIssues && data.accountIssues.length > 0) {
    lines.push("", SECTION_DIVIDER, "", "**証券アカウント状態**");
    for (const issue of data.accountIssues) {
      const statusLabel = issue.status === "updating" ? "更新中" : "エラー";
      if (issue.errorMessage) {
        lines.push(`• ${issue.name} (${statusLabel}: ${issue.errorMessage})`);
      } else {
        lines.push(`• ${issue.name} (${statusLabel})`);
      }
    }
  }

  const dashboardUrl = process.env.DASHBOARD_URL;
  if (dashboardUrl) {
    lines.push("", SECTION_DIVIDER, "", `更新日時: ${updatedAt}`, `ダッシュボード: ${dashboardUrl}`);
  } else {
    lines.push("", SECTION_DIVIDER, "", `更新日時: ${updatedAt}`);
  }

  return lines.join("\n");
}

function buildErrorContent(message: string, timestamp: string): string {
  return [
    "**🚨 Money Forward スクレイピングエラー**",
    "",
    "```text",
    message || "Unknown error",
    "```",
    "",
    `発生日時: ${timestamp}`,
  ].join("\n");
}

function splitContentByLine(content: string, chunkSize: number): string[] {
  if (content.length <= chunkSize) return [content];

  const chunks: string[] = [];
  const lines = content.split("\n");
  let current = "";

  for (const line of lines) {
    if (line.length > chunkSize) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += chunkSize) {
        chunks.push(line.slice(i, i + chunkSize));
      }
      continue;
    }

    if (!current) {
      current = line;
      continue;
    }

    const candidate = `${current}\n${line}`;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      chunks.push(current);
      current = line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
