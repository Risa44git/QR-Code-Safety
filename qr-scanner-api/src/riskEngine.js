function isIPAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function riskEngine(url) {
  let score = 0;
  let reasons = [];

  const hostname = getHostname(url);
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (!hostname) {
    return {
      score: 100,
      verdict: "dangerous",
      reasons: ["Invalid URL format"]
    };
  }

  // 1. IP address detection
  if (isIPAddress(hostname)) {
    score += 25;
    reasons.push("IP address used instead of domain");
  }

  // 2. subdomain check
  const subdomains = hostname.split(".");
  if (subdomains.length > 3) {
    score += 15;
    reasons.push("Too many subdomains");
  }

  // 3. URL shorteners
  const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl"];
  if (shorteners.includes(hostname)) {
    score += 15;
    reasons.push("URL shortener detected");
  }

  // 4. suspicious keywords
  const keywords = ["login", "verify", "bank", "password", "secure", "update"];

  keywords.forEach((kw) => {
    if (path.includes(kw)) {
      score += 10;
      reasons.push(`Contains suspicious keyword: ${kw}`);
    }
  });

  // clamp score
  score = Math.min(100, score);

  let verdict = "safe";
  if (score >= 51) verdict = "dangerous";
  else if (score >= 21) verdict = "suspicious";

  return { score, verdict, reasons };
}

module.exports = riskEngine;