#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const TARGET_URL = "https://www.financial-ombudsman.org.uk/decisions-case-studies/ombudsman-decisions";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_OUTPUT_ROOT = path.join(ROOT_DIR, "tmp", "fos-daily");
const DEFAULT_BATCH_SIZE = 300;
const DEFAULT_DOWNLOAD_DELAY_MS = 500;
const DEFAULT_MAX_PAGES = 50;

const PRECEDENT_RULES = [
  { label: "DISP", patterns: [/\bdisp\s*\d/i, /\bdisp\b/i] },
  { label: "PRIN", patterns: [/\bprin\s*\d/i, /\bprin\b/i, /\bfca principles?\b/i] },
  { label: "ICOBS", patterns: [/\bicobs\b/i] },
  { label: "COBS", patterns: [/\bcobs\b/i] },
  { label: "MCOB", patterns: [/\bmcob\b/i] },
  { label: "CONC", patterns: [/\bconc\b/i] },
  { label: "SYSC", patterns: [/\bsysc\b/i] },
  { label: "FSMA", patterns: [/\bfsma\b/i, /\bfinancial services and markets act\b/i] },
  { label: "Consumer Credit Act 1974", patterns: [/\bconsumer credit act\b/i, /\bcca\b/i] },
  { label: "Section 75 CCA", patterns: [/\bsection\s*75\b/i] },
  { label: "Section 140A CCA", patterns: [/\bsection\s*140a\b/i] },
  { label: "Insurance Act 2015", patterns: [/\binsurance act(?:\s*2015)?\b/i] },
  { label: "Distance Marketing Regulations", patterns: [/\bdistance marketing regulations?\b/i] },
  { label: "Payment Services Regulations", patterns: [/\bpayment services regulations?\b/i, /\bpsr\b/i] },
];

const ROOT_CAUSE_RULES = [
  {
    label: "Communication failure",
    patterns: [/\b(poor|unclear|misleading)\s+communication\b/i, /\bfailed to explain\b/i, /\bnot (told|informed|made aware)\b/i],
  },
  {
    label: "Delay in claim handling",
    patterns: [/\b(delay|delayed|late|took too long|unreasonable delay)\b/i, /\bclaim (was )?(delayed|handled late)\b/i],
  },
  {
    label: "Policy wording ambiguity",
    patterns: [/\b(policy wording|ambiguous|unclear term|small print|exclusion clause)\b/i, /\bpolicy (didn['’]t|did not) make clear\b/i],
  },
  {
    label: "Affordability assessment failure",
    patterns: [/\b(affordability|unaffordable|creditworthiness|irresponsible lending)\b/i, /\b(insufficient|inadequate) (checks|assessment)\b/i],
  },
  {
    label: "Administrative error",
    patterns: [/\b(administrative|clerical|processing|data entry|system)\s+error\b/i, /\bincorrectly (recorded|processed|applied)\b/i],
  },
  {
    label: "Fraud or scam concern",
    patterns: [/\b(fraud|scam|authorised push payment|app fraud)\b/i, /\bimpersonation\b/i],
  },
  {
    label: "Non-disclosure or misrepresentation",
    patterns: [/\b(non[- ]?disclosure|misrepresentation|failed to disclose)\b/i, /\bmaterial information\b/i],
  },
];

const VULNERABILITY_RULES = [
  { label: "Bereavement", patterns: [/\b(bereave|bereavement|late husband|late wife|widow|widower)\b/i] },
  { label: "Mental health", patterns: [/\b(mental health|depression|anxiety|stress|panic attacks?)\b/i] },
  { label: "Physical health", patterns: [/\b(illness|disability|long[- ]term condition|hospital|medical condition)\b/i] },
  { label: "Financial hardship", patterns: [/\b(financial hardship|hardship|arrears|debt|struggling financially)\b/i, /\bunable to (pay|afford)\b/i] },
  { label: "Domestic abuse", patterns: [/\b(domestic abuse|coercive control|financial abuse)\b/i] },
  { label: "Unemployment", patterns: [/\b(unemploy(?:ed|ment)?|redundan(?:t|cy)|lost (his|her|their) job)\b/i] },
  { label: "Language barrier", patterns: [/\b(language barrier|english is not (my|their) first language|interpreter)\b/i] },
];

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const eqIndex = token.indexOf("=");
    if (eqIndex !== -1) {
      args[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`
Usage:
  node scripts/fos/daily-ingestion.mjs [options]

Options:
  --window-days <n>     Overlap window ending today UTC (default: ${DEFAULT_WINDOW_DAYS})
  --start-date <yyyy-mm-dd>
  --end-date <yyyy-mm-dd>
  --limit <n>           Parse at most n discovered decisions
  --max-pages <n>       Discovery pagination cap (default: ${DEFAULT_MAX_PAGES})
  --batch-size <n>      Import batch size (default: ${DEFAULT_BATCH_SIZE})
  --download-delay <ms> Delay between PDF downloads (default: ${DEFAULT_DOWNLOAD_DELAY_MS})
  --output-root <path>  Scratch directory root (default: tmp/fos-daily/<timestamp>)
  --skip-import         Scrape and parse only
  --allow-empty         Exit successfully when no decisions are found
  --headless <bool>     Playwright headless mode (default: true)
  --help
`);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function formatDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(dateString, deltaDays) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return formatDateUtc(date);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\u0000/g, "").trim();
  return cleaned || null;
}

function trimText(value, maxLength) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3))}...`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(value) {
  const parsed = safeDate(value);
  return parsed ? formatDateUtc(parsed) : null;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function buildSearchUrl({ startDate, endDate, start = 0 }) {
  const url = new URL(`${TARGET_URL}/search`);
  url.searchParams.set("DateFrom", startDate);
  url.searchParams.set("DateTo", endDate);
  url.searchParams.set("Sort", "date");
  if (start > 0) {
    url.searchParams.set("Start", String(start));
  }
  return url.toString();
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function normalizeOutcome(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("part") && text.includes("upheld")) return "partially_upheld";
  if (text.includes("not") && text.includes("upheld")) return "not_upheld";
  if (text.includes("upheld")) return "upheld";
  if (text.includes("not") && text.includes("settled")) return "not_settled";
  if (text.includes("settled")) return "settled";
  return "unknown";
}

function extractMetadataFromText(text) {
  const clean = normalizeWhitespace(text);
  const refMatch = clean.match(/\b(DRN|DRS|DR)\s*-?\s*\d+\b/i);
  const dateMatch = clean.match(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/);
  const outcomeMatch = clean.match(/\b(partially upheld|not upheld|upheld|not settled|settled)\b/i);

  return {
    decision_reference: refMatch ? normalizeWhitespace(refMatch[0]).replace(/\s+/g, "") : null,
    decision_date_raw: dateMatch ? dateMatch[0] : null,
    outcome_raw: outcomeMatch ? outcomeMatch[0] : null,
  };
}

function extractDecisionReference(record, text) {
  const fromUrl = record.pdf_url || record.source_url;
  if (fromUrl) {
    try {
      const fileName = path.basename(new URL(fromUrl).pathname, ".pdf");
      if (fileName) return fileName;
    } catch {
      // fall through
    }
  }

  const meta = extractMetadataFromText(text);
  return meta.decision_reference;
}

function extractOmbudsmanName(text) {
  const explicitMatch = String(text || "").match(/ombudsman\s*[:\-]\s*([A-Za-z .'-]{2,80})/i);
  if (explicitMatch) return cleanText(explicitMatch[1]);

  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/^ombudsman$/i.test(lines[i + 1])) {
      return cleanText(lines[i]);
    }
  }

  return null;
}

function splitSections(text) {
  const normalized = String(text || "").replace(/\r/g, "");
  const definitions = [
    { key: "complaint", patterns: ["the complaint", "complaint", "background", "what happened"] },
    { key: "firm_response", patterns: ["the business's response", "the firm's response", "the business said", "the firm said", "what the business says", "what the firm says"] },
    { key: "ombudsman_reasoning", patterns: ["what i've decided and why", "what i have decided and why", "what i've decided", "what i have decided", "my findings", "my assessment", "what i think"] },
    { key: "final_decision", patterns: ["my final decision", "final decision", "my decision"] },
  ];

  const matches = [];
  for (const definition of definitions) {
    for (const pattern of definition.patterns) {
      const regex = new RegExp(`(^|\\n)\\s*(${pattern})\\s*(\\n|:|\\r)`, "ig");
      let match;
      while ((match = regex.exec(normalized))) {
        matches.push({ key: definition.key, index: match.index });
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);
  const sections = {};

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (sections[current.key]) continue;
    const next = matches[i + 1];
    const rawSlice = normalized.slice(current.index, next ? next.index : normalized.length).trim();
    let cleaned = rawSlice;
    const newlineIndex = cleaned.indexOf("\n");
    if (newlineIndex > -1 && newlineIndex < 140) {
      cleaned = cleaned.slice(newlineIndex + 1).trim();
    }
    sections[current.key] = cleaned;
  }

  return sections;
}

function normalizeStringList(values) {
  const output = [];
  const seen = new Set();
  for (const value of values || []) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function detectTags(text, rules, maxTags = 12) {
  if (!cleanText(text)) return [];
  const detected = [];
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      detected.push(rule.label);
    }
  }
  return normalizeStringList(detected).slice(0, maxTags);
}

function synthesizeDecisionLogic(record, sections) {
  const candidate = cleanText(
    sections.final_decision ||
      sections.ombudsman_reasoning ||
      record.snippet ||
      record.raw_text
  );

  if (!candidate) return null;

  const normalized = candidate.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.?!]+[.?!]?/g) || [normalized];
  return trimText(sentences.slice(0, 2).join(" "), 420);
}

async function dismissCookieBanners(page) {
  const candidates = [
    { role: "button", name: /accept all|accept cookies|agree/i },
    { role: "button", name: /accept/i },
  ];

  for (const candidate of candidates) {
    try {
      const locator = page.getByRole(candidate.role, { name: candidate.name });
      if (await locator.count()) {
        await locator.first().click({ timeout: 2_000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // ignore banner failures
    }
  }
}

async function applyFilters(page, options) {
  const selectorsByField = {
    startDate: [
      'input[type="date"][name*="from" i]',
      'input[type="date"][name*="start" i]',
      "#Form_SearchDecisions_DateFrom",
      'input[placeholder*="From" i]',
      'input[placeholder*="Start" i]',
      'input[name*="from" i]',
    ],
    endDate: [
      'input[type="date"][name*="to" i]',
      'input[type="date"][name*="end" i]',
      "#Form_SearchDecisions_DateTo",
      'input[placeholder*="To" i]',
      'input[placeholder*="End" i]',
      'input[name*="to" i]',
    ],
  };

  for (const [field, selectors] of Object.entries(selectorsByField)) {
    const value = options[field];
    if (!value) continue;
    for (const selector of selectors) {
      const locator = page.locator(selector);
      if (await locator.count()) {
        await locator.first().fill(value);
        break;
      }
    }
  }

  const submitSelectors = [
    "#Form_SearchDecisions_action_doSearchDecisions",
    'input[type="submit"][value*="Search decisions" i]',
    'button[type="submit"]',
    'input[type="submit"][value*="Search" i]',
    'button:has-text("Apply")',
    'button:has-text("Search")',
  ];

  for (const selector of submitSelectors) {
    const locator = page.locator(selector);
    if (!(await locator.count())) continue;
    try {
      await locator.first().click({ timeout: 2_000 });
      await page.waitForTimeout(1_000);
      return;
    } catch {
      // keep trying fallbacks
    }
  }
}

async function extractResultsFromDom(page) {
  return page.evaluate(() => {
    const outcomeRe = /\b(partially upheld|not upheld|upheld|not settled|settled)\b/i;
    const refRe = /\b(DRN|DRS|DR)\s*[-]?\s*(\d+)\b/i;
    const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"]'));

    const normalizeSpace = (value) => (value || "").replace(/\s+/g, " ").trim();

    return pdfLinks.map((link) => {
      const container = link.closest("li") || link.closest("article") || link.closest("div");
      const rawText = container?.textContent?.trim() || link.textContent?.trim() || "";
      const text = normalizeSpace(rawText);
      const headingText = normalizeSpace(container?.querySelector("h3")?.textContent || "");
      const refMatch = headingText.match(refRe) || text.match(refRe);
      const decisionReference = refMatch ? `${refMatch[1].toUpperCase()}-${refMatch[2]}` : null;
      const dateText = normalizeSpace(
        container?.querySelector(".search-result__info-main em, em, time")?.textContent || "",
      );

      const mainInfo = container?.querySelector(".search-result__info-main");
      let businessName = null;
      let outcomeRaw = null;
      if (mainInfo) {
        const tokens = Array.from(mainInfo.childNodes)
          .map((node) => normalizeSpace(node.textContent))
          .filter(Boolean)
          .filter((token) => token !== dateText);

        for (const token of tokens) {
          if (!outcomeRaw && outcomeRe.test(token)) {
            outcomeRaw = token;
          } else if (!businessName && token && !outcomeRe.test(token)) {
            businessName = token;
          }
        }
      }

      const productSector =
        normalizeSpace(container?.querySelector(".tag-type, .search-result__tag")?.textContent || "") || null;
      const descText = normalizeSpace(container?.querySelector(".search-result__desc")?.textContent || "");

      return {
        decision_reference: decisionReference,
        decision_date_raw: dateText || null,
        business_name: businessName,
        outcome_raw: outcomeRaw,
        product_sector: productSector,
        snippet: descText || null,
        source_url: link.href,
        pdf_url: link.href,
        link_text: link.textContent?.trim() || null,
        raw_text: text,
      };
    });
  });
}

async function tryPaginate(page, pageWaitMs) {
  const nextLink = page.locator('a:has-text("Next")');
  if (await nextLink.count()) {
    const href = await nextLink.first().getAttribute("href");
    if (href) {
      const target = href.startsWith("http") ? href : new URL(href, page.url()).toString();
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
      try {
        await page.waitForSelector('a[href*=".pdf"]', { timeout: 15_000 });
      } catch {
        // fall through
      }
      await page.waitForTimeout(pageWaitMs);
      return true;
    }
  }

  const buttonSelectors = [
    'button:has-text("Load more")',
    'button:has-text("Show more")',
    'button:has-text("More")',
    'a:has-text("Next")',
    'button[aria-label*="next" i]',
  ];

  for (const selector of buttonSelectors) {
    const locator = page.locator(selector);
    if (!(await locator.count())) continue;
    try {
      await locator.first().click({ timeout: 2_000 });
      await page.waitForTimeout(pageWaitMs);
      return true;
    } catch {
      // try the next selector
    }
  }

  return false;
}

async function discoverDecisions(options) {
  log(`Discovering FOS decisions from ${options.startDate} to ${options.endDate}`);
  const browser = await chromium.launch({ headless: options.headless });
  const page = await browser.newPage({ userAgent: USER_AGENT });
  const results = [];

  try {
    await page.goto(buildSearchUrl(options), { waitUntil: "domcontentloaded", timeout: 60_000 });

    try {
      await page.waitForSelector('a[href*=".pdf"]', { timeout: 15_000 });
    } catch {
      // allow an empty result pass-through
    }

    let pageCount = 0;
    let previousCount = 0;
    let stallCount = 0;

    while (true) {
      await page.waitForTimeout(1_000);
      const batch = await extractResultsFromDom(page);
      results.push(...batch);

      const unique = dedupeByKey(results, (item) => item.pdf_url || item.source_url || item.decision_reference);
      results.length = 0;
      results.push(...unique);

      const currentCount = results.length;
      const added = currentCount - previousCount;
      const pageLabel = pageCount + 1;
      if (added > 0) {
        log(`Discovery page ${pageLabel}: +${added} (total ${currentCount})`);
      }

      if (currentCount === previousCount) {
        stallCount += 1;
      } else {
        stallCount = 0;
      }

      if (options.limit && currentCount >= options.limit) break;
      if (stallCount >= 2) break;
      if (pageCount >= options.maxPages - 1) break;

      const advanced = await tryPaginate(page, options.pageWaitMs);
      if (!advanced) break;

      pageCount += 1;
      previousCount = currentCount;
    }
  } finally {
    await browser.close();
  }

  return results.map((item) => {
    const meta = extractMetadataFromText(item.raw_text);
    return {
      decision_reference: item.decision_reference || meta.decision_reference,
      decision_date_raw: item.decision_date_raw || meta.decision_date_raw,
      decision_date: toIsoDate(item.decision_date_raw || meta.decision_date_raw),
      business_name: cleanText(item.business_name),
      product_sector: cleanText(item.product_sector),
      outcome_raw: cleanText(item.outcome_raw || meta.outcome_raw),
      outcome: normalizeOutcome(item.outcome_raw || meta.outcome_raw),
      source_url: item.source_url,
      pdf_url: item.pdf_url,
      link_text: cleanText(item.link_text),
      raw_text: cleanText(item.raw_text),
      snippet: cleanText(item.snippet),
      scraped_at: new Date().toISOString(),
    };
  });
}

async function fetchWithRetry(url, options = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const timeoutMs = options.timeoutMs ?? 30_000;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt > retries) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error(`Unable to fetch ${url}`);
}

function resolvePdfFilename(record) {
  const reference = cleanText(record.decision_reference);
  const base = slugify(reference || record.business_name || "decision") || "decision";
  const suffix = createHash("md5")
    .update(record.pdf_url || record.source_url || base)
    .digest("hex")
    .slice(0, 8);
  return `${base}-${suffix}.pdf`;
}

async function extractTextFromPdf(filePath) {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const buffer = await readFile(filePath);
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

function buildParsedRecord(record, fullText, pdfPath, pdfHash) {
  const sections = splitSections(fullText);
  const reference = extractDecisionReference(record, fullText);
  const decisionDateRaw = record.decision_date_raw || extractMetadataFromText(fullText).decision_date_raw;
  const combinedText = [
    record.raw_text,
    record.snippet,
    fullText,
    sections.complaint,
    sections.firm_response,
    sections.ombudsman_reasoning,
    sections.final_decision,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    decision_reference: reference,
    decision_date: toIsoDate(decisionDateRaw),
    decision_date_raw: decisionDateRaw,
    business_name: cleanText(record.business_name),
    product_sector: cleanText(record.product_sector),
    outcome: normalizeOutcome(record.outcome_raw || record.outcome),
    outcome_raw: cleanText(record.outcome_raw),
    source_url: record.source_url,
    pdf_url: record.pdf_url,
    pdf_path: pdfPath.startsWith(`${ROOT_DIR}${path.sep}`) ? path.relative(ROOT_DIR, pdfPath) : pdfPath,
    pdf_sha256: pdfHash,
    full_text: fullText,
    sections,
    snippet: cleanText(record.snippet),
    raw_text: cleanText(record.raw_text),
    link_text: cleanText(record.link_text),
    ombudsman_name: extractOmbudsmanName(fullText),
    decision_logic: synthesizeDecisionLogic(record, sections),
    precedents: detectTags(combinedText, PRECEDENT_RULES),
    root_cause_tags: detectTags(combinedText, ROOT_CAUSE_RULES),
    vulnerability_flags: detectTags(combinedText, VULNERABILITY_RULES),
    parsed_at: new Date().toISOString(),
  };
}

async function scrapeAndParse(options) {
  const discoveries = await discoverDecisions(options);
  const limitedDiscoveries = options.limit ? discoveries.slice(0, options.limit) : discoveries;

  await ensureDir(options.outputRoot);
  await ensureDir(options.pdfDir);
  await ensureDir(options.parsedDir);

  await writeFile(
    path.join(options.outputRoot, "discoveries.json"),
    `${JSON.stringify(limitedDiscoveries, null, 2)}\n`,
    "utf8",
  );

  if (limitedDiscoveries.length === 0) {
    return {
      discovered: 0,
      parsed: 0,
      failed: 0,
      failures: [],
    };
  }

  const failures = [];
  let parsed = 0;

  for (const record of limitedDiscoveries) {
    try {
      const pdfFileName = resolvePdfFilename(record);
      const pdfPath = path.join(options.pdfDir, pdfFileName);

      let pdfBuffer;
      if (await pathExists(pdfPath)) {
        pdfBuffer = await readFile(pdfPath);
      } else {
        const response = await fetchWithRetry(record.pdf_url, { retries: 3, baseDelayMs: 1_000 });
        pdfBuffer = Buffer.from(await response.arrayBuffer());
        await writeFile(pdfPath, pdfBuffer);
        if (options.downloadDelayMs > 0) {
          await sleep(options.downloadDelayMs);
        }
      }

      const fullText = await extractTextFromPdf(pdfPath);
      const parsedRecord = buildParsedRecord(record, fullText, pdfPath, hashBuffer(pdfBuffer));
      const outputName = slugify(parsedRecord.decision_reference || path.basename(pdfPath, ".pdf")) || `decision-${parsed + 1}`;
      await writeFile(
        path.join(options.parsedDir, `${outputName}.json`),
        `${JSON.stringify(parsedRecord, null, 2)}\n`,
        "utf8",
      );

      parsed += 1;
      if (parsed % 10 === 0 || parsed === limitedDiscoveries.length) {
        log(`Parsed ${parsed}/${limitedDiscoveries.length}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        decision_reference: record.decision_reference || null,
        pdf_url: record.pdf_url,
        error: message,
      });
      log(`Parse failed for ${record.pdf_url}: ${message}`);
    }
  }

  return {
    discovered: limitedDiscoveries.length,
    parsed,
    failed: failures.length,
    failures,
  };
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      DB_SSL_MODE: process.env.DB_SSL_MODE || "require",
    },
  });

  if (result.status !== 0) {
    throw new Error(`${path.basename(scriptPath)} exited with status ${result.status}`);
  }
}

async function writeGithubSummary(summary) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = [
    "## FOS Daily Ingestion",
    "",
    `- Window: \`${summary.startDate}\` -> \`${summary.endDate}\``,
    `- Discovered: \`${summary.discovered}\``,
    `- Parsed: \`${summary.parsed}\``,
    `- Failed: \`${summary.failed}\``,
    `- Imported: \`${summary.imported ? "yes" : "no"}\``,
    `- Output: \`${summary.outputRoot}\``,
    "",
  ];

  await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const endDate = args["end-date"] || formatDateUtc(new Date());
  const windowDays = Math.max(1, toInt(args["window-days"], DEFAULT_WINDOW_DAYS));
  const startDate = args["start-date"] || addDaysUtc(endDate, -(windowDays - 1));
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputRoot = path.resolve(args["output-root"] || path.join(DEFAULT_OUTPUT_ROOT, runStamp));
  const pdfDir = path.join(outputRoot, "pdfs");
  const parsedDir = path.join(outputRoot, "parsed");
  const batchSize = Math.max(1, toInt(args["batch-size"], DEFAULT_BATCH_SIZE));
  const skipImport = Boolean(args["skip-import"]);
  const allowEmpty = Boolean(args["allow-empty"]);

  const scrapeOptions = {
    startDate,
    endDate,
    outputRoot,
    pdfDir,
    parsedDir,
    limit: args.limit ? Math.max(1, toInt(args.limit, 0)) : null,
    maxPages: Math.max(1, toInt(args["max-pages"], DEFAULT_MAX_PAGES)),
    downloadDelayMs: Math.max(0, toInt(args["download-delay"], DEFAULT_DOWNLOAD_DELAY_MS)),
    headless: toBool(args.headless, true),
    pageWaitMs: 1_000,
  };

  log(`Starting daily FOS ingestion for ${startDate} -> ${endDate}`);
  const scrapeSummary = await scrapeAndParse(scrapeOptions);

  if (scrapeSummary.discovered === 0 && !allowEmpty) {
    throw new Error(`No FOS decisions discovered for ${startDate} -> ${endDate}`);
  }

  let imported = false;
  if (!skipImport && scrapeSummary.parsed > 0) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when --skip-import is not set.");
    }

    const importStatePath = path.join(outputRoot, "import-state.json");
    runNodeScript(path.join(ROOT_DIR, "scripts", "import-fos-parsed.mjs"), [
      "--source-dir",
      parsedDir,
      "--state-file",
      importStatePath,
      "--batch-size",
      String(batchSize),
      "--no-resume",
      "--include-full-text",
    ]);
    imported = true;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    startDate,
    endDate,
    discovered: scrapeSummary.discovered,
    parsed: scrapeSummary.parsed,
    failed: scrapeSummary.failed,
    imported,
    outputRoot,
    failures: scrapeSummary.failures,
  };

  await writeFile(path.join(outputRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeGithubSummary(summary);

  const parsedFiles = await readdir(parsedDir).catch(() => []);
  log(
    `Daily FOS ingestion finished. discovered=${summary.discovered} parsed=${summary.parsed} failed=${summary.failed} imported=${imported} files=${parsedFiles.length}`,
  );
}

main().catch((error) => {
  console.error(`FOS daily ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
