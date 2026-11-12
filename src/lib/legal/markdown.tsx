import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown renderer for trusted legal documents: headings
 * (#, ##, ###), paragraphs, bullet lists (-), **bold** and [links](url).
 * It never injects raw HTML; links must be internal paths, https or mailto.
 */

function safeHref(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return { href, internal: true };
  if (/^(https:\/\/|mailto:)/.test(href)) return { href, internal: false };
  return null;
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${index++}`;
    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{match[1]}</strong>);
    } else {
      const target = safeHref(match[3]!);
      if (!target) nodes.push(match[2]);
      else if (target.internal) nodes.push(<Link key={key} href={target.href}>{match[2]}</Link>);
      else nodes.push(<a key={key} href={target.href} target={target.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">{match[2]}</a>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalMarkdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${blocks.length}`;
    blocks.push(<p key={key}>{renderInline(paragraph.join(" "), key)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const key = `ul-${blocks.length}`;
    blocks.push(<ul key={key}>{list.map((item, i) => <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>)}</ul>);
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      const text = heading[2]!;
      const key = `h-${blocks.length}`;
      const id = slugify(text);
      blocks.push(level === 1
        ? <h1 key={key} id={id}>{text}</h1>
        : level === 2 ? <h2 key={key} id={id}>{text}</h2> : <h3 key={key} id={id}>{text}</h3>);
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]!);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return <>{blocks}</>;
}
