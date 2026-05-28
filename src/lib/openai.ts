type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

// OpenAI Responses API의 본문 텍스트를 추출한다.
// REST 응답에는 SDK 편의 필드(output_text)가 없고 output[].content[].text에 들어있다.
export function extractOutputText(data: ResponsesPayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("").trim();
}
