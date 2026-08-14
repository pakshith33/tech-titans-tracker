const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  assertScorecardUrl,
  parseScorecardHtml,
} = require("./parseScorecard");

initializeApp();

const REGION = "asia-south1";
const FETCH_TIMEOUT_MS = 25000;
const MAX_HTML_BYTES = 2_500_000;

function wantDebug(data) {
  return !!(data && (data.debug === true || data.debug === "true"));
}

function htmlSnippet(html) {
  if (!html) return null;
  const compact = String(html).replace(/\s+/g, " ").trim();
  return compact.slice(0, 240);
}

function summarizeParse(result) {
  return {
    matchId: result && result.matchId ? result.matchId : null,
    matchName: result && result.matchName ? result.matchName : null,
    date: result && result.date ? result.date : null,
    teamCount: result && result.teams ? result.teams.length : 0,
    teams: (result && result.teams ? result.teams : []).map((t) => ({
      name: t.name,
      playerCount: t.players ? t.players.length : 0,
    })),
  };
}

function fail(code, message, debugInfo) {
  logger.error("parseCricHeroesScorecard failed", { code, message, debugInfo });
  throw new HttpsError(code, message, {
    // Callable clients can read this as error.details
    debug: debugInfo,
  });
}

async function assertIsAdmin(email) {
  if (!email || typeof email !== "string") {
    fail("permission-denied", "Signed-in user has no email.", {
      stage: "auth",
      reason: "missing_email",
    });
  }
  const snap = await getFirestore().doc(`admins/${email}`).get();
  if (!snap.exists) {
    fail(
      "permission-denied",
      "Only team admins can import CricHeroes scorecards.",
      {
        stage: "auth",
        reason: "not_in_admins_collection",
        email,
      }
    );
  }
}

async function fetchScorecardHtml(url, debugInfo) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TechTitansTracker/1.0; +https://pakshith33.github.io/tech-titans-tracker)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });

    debugInfo.httpStatus = res.status;
    debugInfo.finalUrl = res.url || url;
    debugInfo.contentType = res.headers.get("content-type");

    const buf = Buffer.from(await res.arrayBuffer());
    debugInfo.htmlBytes = buf.length;
    debugInfo.fetchMs = Date.now() - started;

    if (!res.ok) {
      const bodyPreview = htmlSnippet(buf.toString("utf8"));
      fail(
        "unavailable",
        `CricHeroes returned HTTP ${res.status}. Likely blocked or unavailable from Cloud Functions.`,
        {
          ...debugInfo,
          stage: "fetch",
          reason: "http_not_ok",
          bodyPreview,
          hint: "Copy this whole error (including details.debug) and Cloud Logging lines for the agent.",
        }
      );
    }

    if (buf.length > MAX_HTML_BYTES) {
      fail("resource-exhausted", "Scorecard HTML is unexpectedly large.", {
        ...debugInfo,
        stage: "fetch",
        reason: "html_too_large",
      });
    }

    if (buf.length < 500) {
      fail(
        "unavailable",
        "CricHeroes returned a very small body (possible block/challenge page).",
        {
          ...debugInfo,
          stage: "fetch",
          reason: "html_too_small",
          bodyPreview: htmlSnippet(buf.toString("utf8")),
        }
      );
    }

    return buf.toString("utf8");
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err && err.name === "AbortError") {
      fail("deadline-exceeded", "Timed out fetching the CricHeroes scorecard.", {
        ...debugInfo,
        stage: "fetch",
        reason: "timeout",
        fetchMs: Date.now() - started,
      });
    }
    fail(
      "unavailable",
      `Failed to fetch CricHeroes scorecard: ${err.message || String(err)}`,
      {
        ...debugInfo,
        stage: "fetch",
        reason: "network_error",
        errorName: err && err.name,
        errorMessage: err && err.message,
        fetchMs: Date.now() - started,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Callable: parseCricHeroesScorecard
 * data: { url: string, debug?: boolean }
 *
 * On failure, error.details.debug has stage/reason for agent troubleshooting.
 * On success with debug:true, response includes a `debug` object (no full HTML).
 *
 * Deploying this function does NOT modify Firestore `admins` docs or other data.
 */
exports.parseCricHeroesScorecard = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public", // callable HTTPS layer; Auth still enforced below
  },
  async (request) => {
    const debugRequested = wantDebug(request.data);
    const debugInfo = {
      stage: "start",
      region: REGION,
      debugRequested,
      at: new Date().toISOString(),
    };

    if (!request.auth) {
      fail("unauthenticated", "Sign in to import a CricHeroes scorecard.", {
        ...debugInfo,
        stage: "auth",
        reason: "missing_auth",
      });
    }

    debugInfo.uid = request.auth.uid;
    debugInfo.email = request.auth.token.email || null;
    await assertIsAdmin(request.auth.token.email);
    debugInfo.stage = "auth_ok";

    let parsedUrl;
    try {
      parsedUrl = assertScorecardUrl(request.data && request.data.url);
    } catch (err) {
      fail("invalid-argument", err.message || "Invalid url", {
        ...debugInfo,
        stage: "validate_url",
        reason: "bad_url",
        urlPreview:
          request.data && request.data.url
            ? String(request.data.url).slice(0, 180)
            : null,
      });
    }

    debugInfo.matchIdFromUrl = parsedUrl.matchId;
    debugInfo.sourceUrl = parsedUrl.url;
    logger.info("parseCricHeroesScorecard fetch start", debugInfo);

    const html = await fetchScorecardHtml(parsedUrl.url, debugInfo);
    debugInfo.stage = "fetch_ok";
    debugInfo.titlePreview = (() => {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 160) : null;
    })();
    debugInfo.looksLikeScorecard = /Yet to Bat|Batters|Match Date/i.test(html);

    let result;
    const parseStarted = Date.now();
    try {
      result = parseScorecardHtml(html, { sourceUrl: parsedUrl.url });
    } catch (err) {
      fail(
        "internal",
        `Failed to parse scorecard HTML: ${err.message || String(err)}`,
        {
          ...debugInfo,
          stage: "parse",
          reason: "parse_threw",
          errorMessage: err && err.message,
          titlePreview: debugInfo.titlePreview,
          htmlSnippet: htmlSnippet(html),
        }
      );
    }
    debugInfo.parseMs = Date.now() - parseStarted;
    debugInfo.parseSummary = summarizeParse(result);

    if (!result.matchName || !result.date || !result.teams || result.teams.length < 2) {
      fail(
        "failed-precondition",
        "Could not extract match name, date, and both teams from this scorecard. CricHeroes page layout may have changed, or the match page is incomplete.",
        {
          ...debugInfo,
          stage: "parse",
          reason: "incomplete_parse",
          htmlSnippet: htmlSnippet(html),
          hint: "If fetch worked but parse failed, save the live HTML and send titlePreview + debug JSON to the agent.",
        }
      );
    }

    result.matchId = parsedUrl.matchId;
    logger.info("parseCricHeroesScorecard success", {
      ...debugInfo,
      stage: "success",
    });

    if (debugRequested) {
      return {
        ...result,
        debug: {
          ...debugInfo,
          stage: "success",
          // Deliberately omit full HTML (large). Use htmlSnippet only on failures.
        },
      };
    }

    return result;
  }
);
