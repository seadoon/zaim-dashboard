import type { NotificationData, RfBrokerBreakdown, RfTypeBreakdown } from "./types.js";
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

function formatChange(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}¥${n.toLocaleString("ja-JP")}`;
}

function formatPercent(change: number, previous: number): string {
  if (previous === 0) return "-";
  const pct = (change / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function buildSummaryContent(data: NotificationData): string {
  const {
    totalAssets,
    zaimBankTotal,
    rfSecuritiesTotal,
    dailyChange,
    monthlyChange,
    monthlyChangePrevious,
    zaimBankDailyChange,
    rfSecuritiesDailyChange,
    updatedAt,
  } = data;

  const dailyChangeText = dailyChange !== null ? formatChange(dailyChange) : "-";
  const monthlyChangeText =
    monthlyChange !== null && monthlyChangePrevious !== null
      ? `${formatChange(monthlyChange)} (${formatPercent(monthlyChange, monthlyChangePrevious)})`
      : "-";

  const lines: string[] = [
    "**💰 資産サマリー**",
    "",
    `**総資産** ${formatAmount(totalAssets)}`,
    `**前日比** ${dailyChangeText}`,
    `**今月比** ${monthlyChangeText}`,
    "",
    SECTION_DIVIDER,
    "",
    "**内訳**",
    `銀行・現金（Zaim）: **${formatAmount(zaimBankTotal)}** (${zaimBankDailyChange !== null ? formatChange(zaimBankDailyChange) : "-"})`,
    `証券（robofolio）: **${formatAmount(rfSecuritiesTotal)}** (${rfSecuritiesDailyChange !== null ? formatChange(rfSecuritiesDailyChange) : "-"})`,
  ];

  if (data.rfByBroker.length > 0) {
    for (const b of data.rfByBroker) {
      const change = b.dailyChange !== null ? formatChange(b.dailyChange) : "-";
      lines.push(`  ${b.broker}: ${formatAmount(b.total)} (${change})`);
    }
  }

  if (data.rfByType.length > 0) {
    lines.push("");
    for (const t of data.rfByType) {
      lines.push(`  ${t.type}: ${formatAmount(t.total)} (${formatChange(t.dailyChange)})`);
    }
  }

  const dashboardUrl = process.env.DASHBOARD_URL;
  lines.push("", SECTION_DIVIDER, "", `更新日時: ${updatedAt}`);
  if (dashboardUrl) {
    lines.push(`ダッシュボード: ${dashboardUrl}`);
  }

  return lines.join("\n");
}

function buildErrorContent(message: string, timestamp: string): string {
  return [
    "**🚨 robofolio スクレイピングエラー**",
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
