import type { Page } from "playwright";

export type Hook = (page: Page) => Promise<void>;
