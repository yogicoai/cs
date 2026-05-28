"use client";

import { ExternalLink } from "lucide-react";

type RichAnswerProps = {
  text: string;
};

type AnswerPart =
  | { type: "text"; text: string }
  | { type: "link"; label: string; url: string }
  | { type: "youtube"; label: string; url: string; embedUrl: string };

const urlPattern = /(https?:\/\/[^\s]+)/g;

function cleanUrl(url: string) {
  return url.replace(/[),.。]+$/g, "");
}

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
  } catch {
    return "";
  }

  return "";
}

function labelForUrl(line: string, url: string) {
  const labelMatch = line.match(/[*\-\s]*([^:：\n]+?)(?:\s*[:：]\s*)https?:\/\//);
  const rawLabel = labelMatch?.[1]?.replace(/보러가기|바로가기/g, "").trim();

  if (rawLabel) {
    return `${rawLabel} 보러가기`;
  }

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "영상 보기";
  }

  if (url.includes("naver.com")) {
    return "리필비즈 보러가기";
  }

  return "자세히 보기";
}

function isSupportChannelLink(line: string, url: string, label: string) {
  const target = `${line} ${url} ${label}`.toLowerCase();

  const isTalkLabel = /카카오\s*플친|카카오플친|카카오\s*상담|네이버\s*톡톡|네이버톡톡|톡톡/.test(target);

  return (
    isTalkLabel ||
    target.includes("pf.kakao.com") ||
    target.includes("talk.naver.com") ||
    target.includes("talktalk")
  );
}

function parseAnswer(text: string): AnswerPart[] {
  const parts: AnswerPart[] = [];

  for (const line of text.split("\n")) {
    const matches = Array.from(line.matchAll(urlPattern));

    if (matches.length === 0) {
      if (line.trim()) {
        parts.push({ type: "text", text: line });
      }
      continue;
    }

    const textBeforeUrl = line.slice(0, matches[0].index).replace(/[*\-\s]*[^:：\n]+?[:：]\s*$/g, "").trim();

    if (textBeforeUrl) {
      parts.push({ type: "text", text: textBeforeUrl });
    }

    for (const match of matches) {
      const url = cleanUrl(match[0]);
      const embedUrl = youtubeEmbedUrl(url);
      const label = labelForUrl(line, url);

      if (isSupportChannelLink(line, url, label)) {
        continue;
      }

      if (embedUrl) {
        parts.push({ type: "youtube", label, url, embedUrl });
      } else {
        parts.push({ type: "link", label, url });
      }
    }
  }

  return parts;
}

export function RichAnswer({ text }: RichAnswerProps) {
  const parts = parseAnswer(text);

  return (
    <div className="rich-answer">
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <p key={`${part.type}-${index}`}>{part.text}</p>;
        }

        if (part.type === "youtube") {
          return (
            <div className="video-answer" key={`${part.type}-${index}`}>
              <iframe
                src={part.embedUrl}
                title={part.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <a href={part.url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                {part.label}
              </a>
            </div>
          );
        }

        return (
          <a className="answer-cta" href={part.url} target="_blank" rel="noreferrer" key={`${part.type}-${index}`}>
            <ExternalLink size={16} />
            {part.label}
          </a>
        );
      })}
    </div>
  );
}
