function parseWifi(raw) {
  const ssid     = (raw.match(/S:([^;]*)/i)  || [])[1] || 'Unknown';
  const security = (raw.match(/T:([^;]*)/i)  || [])[1] || '';
  const password = (raw.match(/P:([^;]*)/i)  || [])[1] || '';
  return { ssid, security, password };
}

function analyzeContent(raw) {
  const lower = raw.toLowerCase().trim();

  // URLs — let riskEngine handle
  if (lower.startsWith('http://') || lower.startsWith('https://')) return null;

  // ── WiFi ──────────────────────────────────────────────────────────────────
  if (lower.startsWith('wifi:')) {
    const { ssid, security, password } = parseWifi(raw);
    const isOpen = !security || security.toLowerCase() === 'nopass' || !password;
    return {
      contentType: 'wifi',
      isUrl: false,
      score: isOpen ? 30 : 0,
      verdict: isOpen ? 'low-risk' : 'safe',
      reasons: isOpen
        ? [`WiFi network: "${ssid}"`, 'Open network — no password, your traffic could be intercepted (evil twin attack risk)']
        : [`WiFi network: "${ssid}"`, `Security: ${security.toUpperCase()}`],
    };
  }

  // ── Phone number ───────────────────────────────────────────────────────────
  if (lower.startsWith('tel:')) {
    const number = raw.slice(4);
    return {
      contentType: 'tel',
      isUrl: false,
      score: 10,
      verdict: 'safe',
      reasons: [`Phone number: ${number}`, 'Verify this is a legitimate number — premium rate numbers can incur charges'],
    };
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (lower.startsWith('smsto:') || lower.startsWith('sms:')) {
    const after = raw.includes(':') ? raw.split(':').slice(1).join(':') : '';
    const number = after.split(':')[0];
    return {
      contentType: 'sms',
      isUrl: false,
      score: 15,
      verdict: 'safe',
      reasons: [
        `Pre-composed SMS to: ${number || 'unknown number'}`,
        'Premium rate SMS numbers can incur charges — verify the recipient',
      ],
    };
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  if (lower.startsWith('mailto:')) {
    const email = raw.slice(7).split('?')[0];
    return {
      contentType: 'email',
      isUrl: false,
      score: 0,
      verdict: 'safe',
      reasons: [`Email address: ${email}`],
    };
  }

  // ── Location ───────────────────────────────────────────────────────────────
  if (lower.startsWith('geo:')) {
    return {
      contentType: 'location',
      isUrl: false,
      score: 0,
      verdict: 'safe',
      reasons: ['Geographic coordinates — opens in maps app'],
    };
  }

  // ── Contact card ───────────────────────────────────────────────────────────
  if (lower.startsWith('begin:vcard')) {
    const name = (raw.match(/FN:([^\n\r]*)/i) || [])[1]?.trim() || 'Unknown';
    return {
      contentType: 'contact',
      isUrl: false,
      score: 0,
      verdict: 'safe',
      reasons: [`Contact card: ${name}`],
    };
  }

  // ── Calendar event ─────────────────────────────────────────────────────────
  if (lower.startsWith('begin:vcalendar')) {
    return {
      contentType: 'calendar',
      isUrl: false,
      score: 0,
      verdict: 'safe',
      reasons: ['Calendar event data'],
    };
  }

  // ── Cryptocurrency payment ─────────────────────────────────────────────────
  if (lower.startsWith('bitcoin:') || lower.startsWith('ethereum:') || lower.startsWith('litecoin:')) {
    const type = lower.split(':')[0];
    return {
      contentType: 'crypto',
      isUrl: false,
      score: 20,
      verdict: 'low-risk',
      reasons: [
        `Cryptocurrency payment request (${type})`,
        'Verify the wallet address independently before sending any funds',
      ],
    };
  }

  // ── Plain text / ticket ID / proprietary code ──────────────────────────────
  const preview = raw.length > 80 ? raw.slice(0, 77) + '...' : raw;
  return {
    contentType: 'text',
    isUrl: false,
    score: 0,
    verdict: 'safe',
    reasons: [
      `Text data: "${preview}"`,
      'This QR code contains a text string or proprietary code (e.g. ticket ID, membership pass) — no URL to analyze',
    ],
  };
}

module.exports = analyzeContent;
