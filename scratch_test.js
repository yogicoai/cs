function normalizeText(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s/]+/gu, " ").replace(/\s+/g, " ").trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

const weakIntentTokens = new Set([
  "싶어요", "알고", "문의", "질문", "가능", "가능한가요", "되나요", "할까요", "해주세요", "어떻게",
]);

function tokenize(value) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 2 && !weakIntentTokens.has(token)),
    ),
  );
}

function hasTokenMatch(text, token) {
  const textTokens = tokenize(text);
  return textTokens.some((textToken) => {
    if (textToken === token) return true;
    if (token.length >= 3 && textToken.length >= 2 && token.includes(textToken)) return true;
    return textToken.length >= 3 && token.length >= 2 && textToken.includes(token);
  });
}

function scoreClaim(query, claim) {
  const queryTokens = tokenize(query);
  const text = normalizeText(`${claim.situation} ${claim.keywords.join(" ")}`);
  let score = 0;

  for (const token of queryTokens) {
    if (hasTokenMatch(text, token)) {
      score += 5;
    }
  }

  if (text.includes(normalizeText(query))) {
    score += 8;
  }
  if (compactText(text).includes(compactText(query))) {
    score += 12;
  }

  return score;
}

const query = "비즈 보충";
const claim = {
  situation: "비즈 보충",
  keywords: []
};

console.log("Tokens:", tokenize(query));
console.log("Score:", scoreClaim(query, claim));
