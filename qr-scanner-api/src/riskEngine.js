function getParsed(url) {
  try { return new URL(url); }
  catch { return null; }
}

function isIPAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

// Real Shannon entropy — measures character diversity in a string.
// High entropy (>3.5) indicates a randomly generated domain (DGA malware pattern).
function shannonEntropy(str) {
  if (!str || str.length < 4) return 0;
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  return -Object.values(freq).reduce((sum, count) => {
    const p = count / str.length;
    return sum + p * Math.log2(p);
  }, 0);
}

// Levenshtein distance — counts minimum single-character edits between two strings.
// Used to catch typosquatting like "paypa1.com" (1 char from "paypal").
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const BRANDS = [
  'paypal', 'google', 'amazon', 'apple', 'microsoft', 'facebook',
  'instagram', 'netflix', 'youtube', 'twitter', 'chase', 'citibank',
  'bankofamerica', 'wellsfargo', 'coinbase', 'binance', 'ebay', 'dropbox',
];

const SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'short.io', 'rb.gy', 'cutt.ly', 'is.gd', 'buff.ly', 'tiny.cc', 'bl.ink',
];

const SUSPICIOUS_KEYWORDS = [
  'login', 'verify', 'bank', 'password', 'secure', 'update',
  'signin', 'account', 'confirm', 'wallet', 'crypto', 'invoice',
  'payment', 'urgent', 'suspended', 'validate', 'recover',
];

const REDIRECT_PARAMS = [
  'redirect', 'url', 'next', 'goto', 'return',
  'redir', 'returnurl', 'destination', 'continue', 'forward',
];

async function traceRedirects(url) {
  const hops = [];
  let current = url;

  for (let i = 0; i < 10; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QRSafetyBot/1.0)' },
      });
      clearTimeout(timeout);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        let next;
        try { next = new URL(location, current).href; }
        catch { break; }
        if (next === current || hops.includes(next)) break;
        hops.push(current);
        current = next;
      } else {
        break;
      }
    } catch {
      clearTimeout(timeout);
      break;
    }
  }

  return { finalUrl: current, hops };
}

async function checkSafeBrowsing(url) {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'qr-safety-tool', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
        signal: controller.signal,
      }
    );
    const data = await response.json();
    const hit = !!(data.matches && data.matches.length > 0);
    console.log('[SafeBrowsing]', hit ? 'FLAGGED' : 'clean', url);
    return hit;
  } catch (err) {
    console.log('[SafeBrowsing] skipped:', err.message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function riskEngine(url) {
  let score = 0;
  const reasons = [];

  // ── 0. Redirect tracing ────────────────────────────────────────────────────
  const { finalUrl, hops } = await traceRedirects(url);
  const analysisUrl = finalUrl;

  if (hops.length > 0) {
    reasons.push(`Redirects through ${hops.length} hop(s) to: ${finalUrl}`);
  }
  if (hops.length >= 3) {
    score += 15;
    reasons.push('Long redirect chain — common evasion technique');
  }

  const parsed = getParsed(analysisUrl);
  if (!parsed) {
    return { score: 100, verdict: 'dangerous', reasons: ['Invalid URL format'] };
  }

  const hostname = parsed.hostname.toLowerCase();
  const parts = hostname.split('.');
  const registeredDomain = parts.slice(-2).join('.');
  const domainLabel = parts.slice(-2, -1)[0] || '';
  const fullPath = (parsed.pathname + parsed.search).toLowerCase();

  // ── 1. IP address ──────────────────────────────────────────────────────────
  if (isIPAddress(hostname)) {
    score += 25;
    reasons.push('IP address used instead of a domain name');
  }

  // ── 2. @ trick — spoofs legitimate domain in the URL ──────────────────────
  // e.g. https://google.com@evil.com  →  real domain is evil.com
  if (parsed.username || parsed.password) {
    score += 35;
    reasons.push('URL uses @ trick to disguise the real destination (spoofing)');
  }

  // ── 3. No HTTPS ────────────────────────────────────────────────────────────
  if (parsed.protocol === 'http:') {
    score += 10;
    reasons.push('Connection is unencrypted (HTTP not HTTPS)');
  }

  // ── 4. Excessive subdomains ────────────────────────────────────────────────
  if (parts.length > 3) {
    score += 15;
    reasons.push('Excessive subdomains — common pattern in phishing URLs');
  }

  // ── 5. URL shortener ───────────────────────────────────────────────────────
  if (SHORTENERS.includes(registeredDomain) || SHORTENERS.includes(hostname)) {
    score += 25;
    reasons.push('URL shortener detected — real destination is hidden');
  }

  // ── 6. Suspicious keywords (capped at 3 hits to avoid over-scoring) ───────
  let keywordHits = 0;
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (keywordHits >= 3) break;
    if (fullPath.includes(kw)) {
      score += 10;
      keywordHits++;
      reasons.push(`Suspicious keyword in URL: "${kw}"`);
    }
  }

  // ── 7. URL length ──────────────────────────────────────────────────────────
  if (analysisUrl.length > 500) {
    score += 20;
    reasons.push('Extremely long URL — likely obfuscating destination');
  } else if (analysisUrl.length > 200) {
    score += 10;
    reasons.push('Unusually long URL for a QR code');
  }

  // ── 8. Open redirect parameters ────────────────────────────────────────────
  for (const param of REDIRECT_PARAMS) {
    if (parsed.searchParams.has(param)) {
      score += 20;
      reasons.push('URL contains redirect parameter — may forward to a malicious site');
      break;
    }
  }

  // ── 9. Base64 / encoded payload ────────────────────────────────────────────
  if (/[A-Za-z0-9+/]{30,}={0,2}/.test(analysisUrl)) {
    score += 10;
    reasons.push('URL contains encoded data — possible obfuscated payload');
  }

  // ── 10. High-entropy domain (DGA pattern) ──────────────────────────────────
  // Malware uses randomly generated domains like xk2j9pqmzrt.xyz
  // Strip TLD and check entropy of what remains
  if (domainLabel.length >= 8 && shannonEntropy(domainLabel) > 3.5) {
    score += 15;
    reasons.push('Domain name appears randomly generated (DGA pattern)');
  }

  // ── 11. Brand impersonation in domain ──────────────────────────────────────
  // Catches paypal-login.com, secure-amazon.net, google.com.evil.com etc.
  for (const brand of BRANDS) {
    const isLegit = hostname === `${brand}.com`
      || hostname === `www.${brand}.com`
      || hostname.endsWith(`.${brand}.com`);

    if (!isLegit && hostname.includes(brand)) {
      score += 25;
      reasons.push(`Brand name "${brand}" found in a suspicious domain context`);
      break;
    }
  }

  // ── 12. Typosquatting — homoglyph + Levenshtein ────────────────────────────
  // Normalize common character swaps (0→o, 1→l, rn→m) then compare to brands
  const normalized = domainLabel
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');

  for (const brand of BRANDS) {
    const alreadyFlagged = reasons.some(r => r.includes(`"${brand}"`));
    if (alreadyFlagged) continue;

    if (domainLabel !== brand && normalized === brand) {
      score += 35;
      reasons.push(`Homoglyph attack — domain impersonates "${brand}.com" using look-alike characters`);
      break;
    }

    if (normalized !== brand && levenshtein(normalized, brand) <= 1) {
      score += 30;
      reasons.push(`Possible typosquatting — domain closely resembles "${brand}.com"`);
      break;
    }
  }

  // ── 13. Google Safe Browsing — known malicious URL database ───────────────
  const flagged = await checkSafeBrowsing(analysisUrl);
  if (flagged) {
    score += 50;
    reasons.push('Flagged by Google Safe Browsing as a known malicious URL');
  }

  score = Math.min(100, score);

  let verdict = 'safe';
  if (score >= 61) verdict = 'dangerous';
  else if (score >= 36) verdict = 'suspicious';
  else if (score >= 21) verdict = 'low-risk';

  return { score, verdict, reasons, resolvedUrl: finalUrl !== url ? finalUrl : null };
}

module.exports = riskEngine;
