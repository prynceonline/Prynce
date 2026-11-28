// PRYNCE TV operations Edge Function — source backup
// Deployed Supabase function: prynce-tv-ops
// Deployed version: 32
// Snapshot date: 2026-11-28
// Change: HLS health checks now validate master playlist, child media playlist,
// and first media segment. This is endpoint/media-segment verification only;
// it does not grant retransmission rights or guarantee sustained device playback.
// Production source remains deployed in Supabase project hgpiiwigenzggopznpwk.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const ALLOWED_ORIGIN = "https://headless-bkznydlmefs-prynceonline-140c.wix-site-host.com";

function headers(origin: string | null) {
  const allowed = origin === ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}
function reply(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}
async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Database request failed (${response.status})`);
  return data;
}
async function identity(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json();
  const rows = await db(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role&limit=1`);
  return rows?.[0] ? { user, profile: rows[0] } : null;
}
function httpsUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
async function audit(actorId: string | null, action: string, feedId: string, details: Record<string, unknown> = {}) {
  await db("activity_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: actorId,
      action,
      entity_type: "prynce_tv_feed",
      entity_id: feedId,
      details,
    }),
  });
}
function cleanTerritories(value: unknown) {
  if (!Array.isArray(value)) return ["GH"];
  return [...new Set(value.map(v => String(v).trim().toUpperCase()).filter(v => /^[A-Z]{2}$/.test(v)))].slice(0, 30);
}

function isPublicAddress(address: string) {
  const value = address.toLowerCase();
  if (value.includes(":")) {
    if (value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") ||
        value.startsWith("fe80:") || value.startsWith("ff") || value.startsWith("::ffff:")) return false;
    return true;
  }
  const p = value.split(".").map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b] = p;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}
async function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || /^[0-9.]+$/.test(host) || host.includes(":")) {
    throw new Error("Feed host is not an allowed public hostname.");
  }
  const records: string[] = [];
  try { records.push(...await Deno.resolveDns(host, "A")); } catch {}
  try { records.push(...await Deno.resolveDns(host, "AAAA")); } catch {}
  if (!records.length || records.some(ip => !isPublicAddress(ip))) {
    throw new Error("Feed host does not resolve exclusively to public IP addresses.");
  }
}
async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const part = await reader.read();
      if (part.done) break;
      const take = part.value.slice(0, maxBytes - total);
      chunks.push(take);
      total += take.length;
      if (take.length < part.value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

async function fetchPublicHttps(value: string, maxHops = 3) {
  let target = new URL(value);
  for (let hop = 0; hop <= maxHops; hop++) {
    if (target.protocol !== "https:" || target.username || target.password) {
      throw new Error("Only public HTTPS feed endpoints are allowed.");
    }
    await assertPublicHost(target.hostname);
    const response = await fetch(target.href, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
      headers: { Range: "bytes=0-16383", Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, video/*, application/octet-stream, */*" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop === maxHops) throw new Error("Feed redirect limit exceeded or redirect target missing.");
      target = new URL(location, target);
      continue;
    }
    return { response, finalUrl: target };
  }
  throw new Error("Feed redirect limit exceeded.");
}

function firstMediaUri(playlist: string): string | null {
  const lines = playlist.replace(/^\uFEFF/, "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("#")) continue;
        return lines[j];
      }
    }
  }
  const map = playlist.match(/#EXT-X-MAP:[^\n]*URI="([^"]+)"/i)?.[1];
  if (map) return map;
  const part = playlist.match(/#EXT-X-PART:[^\n]*URI="([^"]+)"/i)?.[1];
  if (part) return part;
  return lines.find(line => !line.startsWith("#")) || null;
}

async function inspectFeed(urlValue: string, feedType: string) {
  const started = Date.now();
  let firstResponse: Response | null = null;
  let finalUrl = new URL(urlValue);
  let playlistValid: boolean | null = null;
  let bytesSampled = 0;
  let segmentValid: boolean | null = null;
  let segmentStatus: number | null = null;
  let contentType = "";

  if (feedType === "HLS") {
    const master = await fetchPublicHttps(urlValue);
    firstResponse = master.response;
    finalUrl = master.finalUrl;
    contentType = firstResponse.headers.get("content-type") || "";
    const masterStatus = firstResponse.status;
    if (!firstResponse.ok) {
      await firstResponse.body?.cancel();
      const status = masterStatus === 401 || masterStatus === 403 ? "blocked" :
        masterStatus === 404 || masterStatus === 410 || masterStatus >= 500 ? "offline" : "degraded";
      return { status, httpStatus: masterStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: false, bytesSampled: 0, errorCode: "HLS_MASTER_HTTP", errorMessage: "The HLS master endpoint did not return a successful response.", segmentValid: false, segmentStatus: null };
    }
    const masterBytes = await readLimited(firstResponse, 16384);
    bytesSampled += masterBytes.length;
    const masterText = new TextDecoder().decode(masterBytes).replace(/^\uFEFF/, "").trimStart();
    playlistValid = masterText.startsWith("#EXTM3U");
    if (!playlistValid) {
      return { status: "degraded", httpStatus: masterStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: false, bytesSampled, errorCode: "INVALID_HLS", errorMessage: "The response did not contain a valid HLS playlist header.", segmentValid: false, segmentStatus: null };
    }

    let mediaUrl = firstMediaUri(masterText);
    if (!mediaUrl) {
      return { status: "degraded", httpStatus: masterStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: true, bytesSampled, errorCode: "HLS_NO_MEDIA_URI", errorMessage: "The HLS playlist contained no variant or media segment URI.", segmentValid: false, segmentStatus: null };
    }
    let mediaTarget = new URL(mediaUrl, finalUrl);
    // A master playlist points to a child media playlist; a media playlist points directly to a segment.
    if (/\.m3u8(?:$|[?#])/i.test(mediaTarget.href)) {
      const child = await fetchPublicHttps(mediaTarget.href);
      const childResponse = child.response;
      if (!childResponse.ok) {
        const childStatus = childResponse.status;
        await childResponse.body?.cancel();
        const status = childStatus === 401 || childStatus === 403 ? "blocked" :
          childStatus === 404 || childStatus === 410 || childStatus >= 500 ? "offline" : "degraded";
        return { status, httpStatus: childStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: true, bytesSampled, errorCode: "HLS_MEDIA_PLAYLIST_HTTP", errorMessage: "The child media playlist could not be fetched.", segmentValid: false, segmentStatus: childStatus };
      }
      const childBytes = await readLimited(childResponse, 16384);
      bytesSampled += childBytes.length;
      const childText = new TextDecoder().decode(childBytes).replace(/^\uFEFF/, "").trimStart();
      if (!childText.startsWith("#EXTM3U")) {
        return { status: "degraded", httpStatus: childResponse.status, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: false, bytesSampled, errorCode: "INVALID_HLS_MEDIA_PLAYLIST", errorMessage: "The child media playlist did not contain a valid HLS header.", segmentValid: false, segmentStatus: null };
      }
      const segmentUri = firstMediaUri(childText);
      if (!segmentUri) {
        return { status: "degraded", httpStatus: childResponse.status, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: true, bytesSampled, errorCode: "HLS_NO_SEGMENT", errorMessage: "The child media playlist contained no media segment reference.", segmentValid: false, segmentStatus: null };
      }
      mediaTarget = new URL(segmentUri, child.finalUrl);
    }

    const segment = await fetchPublicHttps(mediaTarget.href);
    const segmentResponse = segment.response;
    segmentStatus = segmentResponse.status;
    if (!segmentResponse.ok) {
      await segmentResponse.body?.cancel();
      const status = segmentStatus === 401 || segmentStatus === 403 ? "blocked" :
        segmentStatus === 404 || segmentStatus === 410 || segmentStatus >= 500 ? "offline" : "degraded";
      return { status, httpStatus: masterStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: true, bytesSampled, errorCode: "HLS_SEGMENT_HTTP", errorMessage: "The first media segment could not be fetched.", segmentValid: false, segmentStatus };
    }
    const segmentBytes = await readLimited(segmentResponse, 1024);
    bytesSampled += segmentBytes.length;
    segmentValid = segmentBytes.length > 0;
    if (!segmentValid) {
      return { status: "degraded", httpStatus: masterStatus, responseMs: Date.now() - started, contentType: contentType.slice(0,160), playlistValid: true, bytesSampled, errorCode: "EMPTY_HLS_SEGMENT", errorMessage: "The first media segment returned no bytes.", segmentValid: false, segmentStatus };
    }
  } else {
    const target = new URL(urlValue);
    if (target.protocol !== "https:" || target.username || target.password) throw new Error("Only public HTTPS feed endpoints are allowed.");
    await assertPublicHost(target.hostname);
    firstResponse = await fetch(target.href, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(9000), headers: { Accept: "*/*" } });
    if ([301,302,303,307,308].includes(firstResponse.status)) {
      const location = firstResponse.headers.get("location");
      await firstResponse.body?.cancel();
      if (!location) throw new Error("Feed redirect target missing.");
      const redirected = await fetchPublicHttps(new URL(location,target).href);
      firstResponse = redirected.response;
    }
    contentType = firstResponse.headers.get("content-type") || "";
  }

  const elapsed = Date.now() - started;
  const httpStatus = firstResponse?.status ?? 0;
  let status = "healthy";
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  if (httpStatus === 401 || httpStatus === 403) {
    status = "blocked"; errorCode = "UPSTREAM_AUTH"; errorMessage = "The feed host denied access.";
  } else if (httpStatus >= 500 || httpStatus === 404 || httpStatus === 410) {
    status = "offline"; errorCode = "UPSTREAM_UNAVAILABLE"; errorMessage = "The feed endpoint is unavailable.";
  } else if (httpStatus < 200 || httpStatus >= 300) {
    status = "degraded"; errorCode = "HTTP_STATUS"; errorMessage = "The feed returned an unexpected HTTP status.";
  } else if (feedType === "HLS" && (playlistValid !== true || segmentValid !== true)) {
    status = "degraded"; errorCode = "HLS_MEDIA_NOT_VERIFIED"; errorMessage = "The HLS playlist or first media segment could not be verified.";
  } else if (elapsed > 12000) {
    status = "degraded"; errorCode = "SLOW_RESPONSE"; errorMessage = "The full HLS media check exceeded the 12-second threshold.";
  }
  return { status, httpStatus, responseMs: elapsed, contentType: contentType.slice(0,160), playlistValid, bytesSampled, errorCode, errorMessage, segmentValid, segmentStatus };
}


async function checkOneFeed(feed: any, actorId: string | null) {
  let result: any;
  try { result = await inspectFeed(feed.feed_url, feed.feed_type); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Feed check failed.";
    const blocked = /public hostname|public IP|HTTPS feed endpoints/i.test(message);
    result = { status: blocked ? "blocked" : "offline", httpStatus: null, responseMs: null, contentType: null, playlistValid: null, bytesSampled: 0, errorCode: blocked ? "UNSAFE_FEED_TARGET" : "FEED_CHECK_FAILED", errorMessage: message.slice(0, 220) };
  }
  const checkedAt = new Date().toISOString();
  await db("prynce_tv_stream_health_checks", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ feed_id: feed.id, checked_at: checkedAt, status: result.status, http_status: result.httpStatus, response_ms: result.responseMs, content_type: result.contentType, playlist_valid: result.playlistValid, bytes_sampled: result.bytesSampled, error_code: result.errorCode, error_message: result.errorMessage, checked_by: actorId }),
  });
  await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(feed.id)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ health_status: result.status, last_health_check: checkedAt, ...(actorId ? { updated_by: actorId } : {}), updated_at: checkedAt }),
  });
  // Health failures are advisory only. Never disable or remove a station automatically:
  // transient CDN, geo, CORS, or network failures must not hide a channel from viewers.
  const autoDisabled = false;
  if (["offline", "blocked", "error"].includes(result.status)) {
    await audit(actorId, "feed_health_degraded_preserved", feed.id, {
      status: result.status,
      enabled_state_preserved: true,
      action_required: "Investigate the source; keep the station registered and enabled.",
    });
  }
  await audit(actorId, "feed_health_checked", feed.id, { status: result.status, http_status: result.httpStatus, response_ms: result.responseMs, error_code: result.errorCode, auto_disabled: autoDisabled });
  return { feed_id: feed.id, channel_name: feed.channel_name, checked_at: checkedAt, ...result, auto_disabled: autoDisabled };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403, headers: headers(origin) });
    return new Response("ok", { headers: headers(origin) });
  }
  if (origin && origin !== ALLOWED_ORIGIN) return reply({ error: "Origin not allowed." }, 403, origin);
  try {
    const requestUrl = new URL(req.url);
    if (req.method === "POST" && requestUrl.pathname.endsWith("/prynce-tv-ops")) {
      const timestamp = req.headers.get("x-prynce-tv-timestamp") || "";
      const signature = req.headers.get("x-prynce-tv-signature") || "";
      const rawBody = await req.text();
      if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature) ||
          Math.abs(Date.now() - Number(timestamp) * 1000) > 120000) {
        return reply({ error: "Invalid or expired worker signature." }, 401, origin);
      }
      const secretResult = await db("rpc/prynce_tv_health_worker_token", { method: "POST", body: "{}" });
      const workerSecret = typeof secretResult === "string" ? secretResult : "";
      if (!workerSecret) return reply({ error: "Worker secret is not configured." }, 503, origin);
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(workerSecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const signed = await crypto.subtle.sign(
        "HMAC", key, new TextEncoder().encode(timestamp + "." + rawBody)
      );
      const expectedSignature = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (signature.length !== expectedSignature.length) return reply({ error: "Worker signature rejected." }, 401, origin);
      let signatureDiff = 0;
      for (let i = 0; i < signature.length; i++) signatureDiff |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
      if (signatureDiff !== 0) return reply({ error: "Worker signature rejected." }, 401, origin);
      let workerPayload: any;
      try { workerPayload = JSON.parse(rawBody || "{}"); } catch { return reply({ error: "Invalid worker payload." }, 400, origin); }
      if (!workerPayload || typeof workerPayload !== "object" || Array.isArray(workerPayload) || Object.keys(workerPayload).length) {
        return reply({ error: "Unexpected worker payload." }, 400, origin);
      }
      const feeds = await db("prynce_tv_feeds?enabled=eq.true&rights_status=eq.approved&select=id,feed_url,feed_type,channel_name,rights_valid_until&order=updated_at.asc&limit=25");
      const results = [];
      for (const feed of feeds || []) {
        if (feed.rights_valid_until && new Date(feed.rights_valid_until).getTime() <= Date.now()) {
          const checkedAt = new Date().toISOString();
          await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(feed.id)}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ enabled: false, rights_status: "expired", health_status: "expired", updated_at: checkedAt })
          });
          await audit(null, "feed_rights_expired", feed.id);
          results.push({ feed_id: feed.id, channel_name: feed.channel_name, status: "expired", auto_disabled: true });
          continue;
        }
        results.push(await checkOneFeed(feed, null));
      }
      const candidateSelect = "select=id,channel_name,feed_url,feed_type,review_notes,source_key,country_code,category,source_url,last_seen_at";
      const ghCandidates = await db("prynce_tv_discovery_candidates?review_status=in.(pending,approved_for_review)&country_code=eq.GH&" + candidateSelect + "&order=last_checked_at.asc.nullsfirst&limit=20");
      const internationalCandidates = await db("prynce_tv_discovery_candidates?review_status=in.(pending,approved_for_review)&country_code=neq.GH&" + candidateSelect + "&order=last_checked_at.asc.nullsfirst&limit=30");
      const pendingCandidates = [...(ghCandidates || []), ...(internationalCandidates || []).slice(0, Math.max(0, 30 - (ghCandidates || []).length))];
      const candidateResults: any[] = [];
      for (let offset = 0; offset < (pendingCandidates || []).length; offset += 8) {
        const group = pendingCandidates.slice(offset, offset + 8);
        const checked = await Promise.all(group.map(async (candidate: any) => {
          let result: any;
          try { result = await inspectFeed(candidate.feed_url, candidate.feed_type); }
          catch (error) {
            const message = error instanceof Error ? error.message : "Candidate endpoint check failed.";
            const blocked = /public hostname|public IP|HTTPS feed endpoints/i.test(message);
            result = { status: blocked ? "blocked" : "offline", httpStatus: null, responseMs: null, contentType: null, playlistValid: null, bytesSampled: 0, errorCode: blocked ? "UNSAFE_FEED_TARGET" : "FEED_CHECK_FAILED", errorMessage: message.slice(0, 220) };
          }
          if (candidate.feed_type !== "HLS" && result.status === "healthy") {
            result = {
              ...result,
              status: "degraded",
              errorCode: "PAGE_REACHABLE_NOT_STREAM",
              errorMessage: "The source page is reachable, but this check did not verify a direct playable stream or browser playback."
            };
          }
          const checkedAt = new Date().toISOString();
          const auditLine = "AUTOMATIC CANDIDATE CHECK " + checkedAt + ": " + result.status +
            "; HTTP " + (result.httpStatus ?? "n/a") + "; response " + (result.responseMs ?? "n/a") +
            "ms; HLS valid " + (result.playlistValid ?? "n/a") + "; " +
            (result.errorMessage || result.errorCode || "No endpoint error reported.") +
            ". Endpoint reachability only; rights remain pending.";
          await db("prynce_tv_discovery_candidates?id=eq." + encodeURIComponent(candidate.id), {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              health_status: result.status, http_status: result.httpStatus,
              response_ms: result.responseMs, last_checked_at: checkedAt,
              review_notes: [candidate.review_notes, auditLine].filter(Boolean).join("\n").slice(-4000),
              updated_at: checkedAt
            })
          });
          await db("prynce_tv_candidate_health_history", {
            method: "POST", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              candidate_id: candidate.id,
              checked_at: checkedAt,
              check_method: candidate.feed_type === "HLS" ? "manifest_probe" : "http_probe",
              source_key: candidate.source_key || "unknown",
              country_code: candidate.country_code || "ZZ",
              category: candidate.category || null,
              feed_url: candidate.feed_url,
              source_url: candidate.source_url || candidate.feed_url,
              status: result.status,
              http_status: result.httpStatus,
              response_ms: result.responseMs,
              content_type: result.contentType,
              playlist_valid: result.playlistValid,
              bytes_sampled: result.bytesSampled,
              error_code: result.errorCode,
              error_message: result.errorMessage,
              last_seen_at: candidate.last_seen_at || null
            })
          });
          return { candidate_id: candidate.id, channel_name: candidate.channel_name, checked_at: checkedAt, ...result };
        }));
        candidateResults.push(...checked);
      }
      return reply({
        worker: "prynce-tv-feed-health",
        checked: results.length,
        healthy: results.filter((x: any) => x.status === "healthy").length,
        candidate_checked: candidateResults.length,
        candidate_healthy: candidateResults.filter((x: any) => x.status === "healthy").length,
        candidate_degraded: candidateResults.filter((x: any) => x.status === "degraded").length,
        candidate_offline: candidateResults.filter((x: any) => x.status === "offline").length,
        candidate_blocked: candidateResults.filter((x: any) => x.status === "blocked").length,
        candidate_results: candidateResults,
        degraded: results.filter((x: any) => x.status === "degraded").length,
        offline: results.filter((x: any) => x.status === "offline").length,
        blocked: results.filter((x: any) => x.status === "blocked").length,
        expired: results.filter((x: any) => x.status === "expired").length,
        results
      }, 200, origin);
    }
    const publicAction = requestUrl.searchParams.get("action") || "";
    if (req.method === "GET" && publicAction === "public_channels") {
      const now = new Date().toISOString();
      const rows = await db(
        "prynce_tv_feeds?enabled=eq.true&rights_status=eq.approved&feed_type=eq.HLS&select=channel_slug,channel_name,category,country_code,feed_type,feed_url,territories,rights_valid_from,rights_valid_until,health_status,last_health_check&order=channel_name.asc&limit=500"
      );
      const channels = (rows || []).filter((feed: any) =>
        (!feed.rights_valid_from || new Date(feed.rights_valid_from).toISOString() <= now) &&
        (!feed.rights_valid_until || new Date(feed.rights_valid_until).toISOString() > now) &&
        Array.isArray(feed.territories) && feed.territories.includes("GH") &&
        feed.health_status === "healthy" && feed.last_health_check && (Date.now() - new Date(feed.last_health_check).getTime()) <= 15 * 60 * 1000
      ).map((feed: any) => ({
        channel_slug: feed.channel_slug,
        channel_name: feed.channel_name,
        category: feed.category || "General",
        country_code: feed.country_code || (feed.territories?.[0] || "GH"),
        feed_type: feed.feed_type,
        feed_url: feed.feed_url,
        health_status: feed.health_status,
        last_health_check: feed.last_health_check
      }));
      return reply({ channels, count: channels.length, region: "GH" }, 200, origin);
    }

    const auth = await identity(req);
    if (!auth) return reply({ error: "Sign in with your PRYNCE TV administrator account." }, 401, origin);
    if (auth.profile.role !== "admin") return reply({ error: "Administrator access is required." }, 403, origin);

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || url.searchParams.get("action") || "");


    if (req.method === "GET" && action === "rights_outreach") {
      const rows = await db("prynce_tv_rights_outreach?select=id,candidate_id,broadcaster_id,channel_name,contact_name,contact_email,contact_phone,contact_url,contact_verification,request_status,requested_rights,evidence_url,sent_at,response_due_at,response_notes,request_subject,request_message,created_at,updated_at&order=updated_at.desc&limit=500");
      const candidates = await db("prynce_tv_discovery_candidates?select=id,channel_name,country_code,category,source_url,feed_url,review_status,health_status&order=channel_name.asc&limit=500");
      const broadcasters = await db("prynce_tv_broadcaster_directory?select=id,broadcaster_key,channel_name,operator_name,country_code,official_website_url,rights_status&order=channel_name.asc&limit=500");
      const candidateMap = new Map((candidates || []).map((c: any) => [c.id, c]));
      const broadcasterMap = new Map((broadcasters || []).map((b: any) => [b.id, b]));
      return reply({ outreach: (rows || []).map((r: any) => ({ ...r, candidate: candidateMap.get(r.candidate_id) || null, broadcaster: broadcasterMap.get(r.broadcaster_id) || null })), candidates: candidates || [], broadcasters: broadcasters || [] }, 200, origin);
    }

    if (req.method === "GET" && action === "health_history") {
      const feedId = String(url.searchParams.get("feed_id") || "");
      if (!feedId) return reply({ error: "Feed ID is required." }, 400, origin);
      const feedRows = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(feedId)}&select=id,channel_name&limit=1`);
      if (!feedRows?.[0]) return reply({ error: "Feed not found." }, 404, origin);
      const history = await db(
        `prynce_tv_stream_health_checks?feed_id=eq.${encodeURIComponent(feedId)}&select=id,checked_at,status,http_status,response_ms,content_type,playlist_valid,bytes_sampled,error_code,error_message&order=checked_at.desc&limit=30`
      );
      return reply({ feed: feedRows[0], checks: history || [], count: (history || []).length }, 200, origin);
    }

    if (req.method === "GET" && action === "discovery_runs") {
      const runs = await db("prynce_tv_discovery_scan_runs?select=id,source_key,scanned_at,discovered_count,inserted_count,result&order=scanned_at.desc&limit=10");
      const workerStatus = await db("rpc/prynce_tv_health_worker_status", { method: "POST", body: "{}" });
      const pages = await Promise.all([0,1,2].map((page) => db(
        "prynce_tv_discovery_candidates?select=country_code,category,review_status,health_status&order=country_code.asc&limit=1000",
        { headers: { Range: (page * 1000) + "-" + ((page * 1000) + 999) } }
      )));
      const list = pages.flat().filter(Boolean);
      const countryMap = new Map<string, number>();
      for (const item of list) countryMap.set(item.country_code, (countryMap.get(item.country_code) || 0) + 1);
      const byCountry = [...countryMap.entries()].map(([country_code, count]) => ({ country_code, count })).sort((a,b) => b.count-a.count);
      return reply({
        schedule: "Ghana and global catalogue scans every 12 hours; candidate endpoint checks every 15 minutes",
        sources: ["IPTV-org Ghana country playlist", "IPTV-org Africa region playlist", "IPTV-org worldwide category playlists"],
        latest: (runs || [])[0] || null,
        runs: runs || [],
        health_worker: workerStatus || null,
        candidate_totals: {
          all: list.length,
          pending: list.filter((x: any) => x.review_status === "pending").length,
          approved_for_review: list.filter((x: any) => x.review_status === "approved_for_review").length,
          healthy_endpoint: list.filter((x: any) => x.health_status === "healthy").length,
          degraded: list.filter((x: any) => x.health_status === "degraded").length,
          offline: list.filter((x: any) => x.health_status === "offline").length,
          blocked: list.filter((x: any) => x.health_status === "blocked").length,
          not_checked: list.filter((x: any) => x.health_status === "not_checked").length
        },
        by_country: byCountry,
        note: "Candidates remain private. Endpoint health is not proof of rights, geo-availability, or sustained playback."
      }, 200, origin);
    }

    if (req.method === "GET" && action === "overview") {
      const rows = await db("prynce_tv_feeds?select=id,channel_slug,channel_name,feed_type,feed_url,rights_status,rights_evidence_url,rights_valid_from,rights_valid_until,territories,enabled,health_status,last_health_check,operator_notes,created_at,updated_at&order=updated_at.desc&limit=500");
      const now = Date.now();
      const expired = (rows || []).filter((row: any) =>
        row.rights_status === "approved" && row.rights_valid_until && new Date(row.rights_valid_until).getTime() <= now && row.enabled
      );
      for (const row of expired) {
        await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ enabled: false, rights_status: "expired", health_status: "expired", updated_at: new Date().toISOString() }),
        });
        await audit(auth.user.id, "feed_rights_expired", row.id);
      }
      const fresh = expired.length
        ? await db("prynce_tv_feeds?select=id,channel_slug,channel_name,feed_type,feed_url,rights_status,rights_evidence_url,rights_valid_from,rights_valid_until,territories,enabled,health_status,last_health_check,operator_notes,created_at,updated_at&order=updated_at.desc&limit=500")
        : rows;
      const items = fresh || [];
      return reply({
        feeds: items,
        totals: {
          all: items.length,
          enabled: items.filter((x: any) => x.enabled).length,
          approved: items.filter((x: any) => x.rights_status === "approved").length,
          pending: items.filter((x: any) => x.rights_status === "pending").length,
          expired: items.filter((x: any) => x.rights_status === "expired").length,
          healthy: items.filter((x: any) => x.health_status === "healthy").length,
        },
        identity: { name: auth.profile.full_name || auth.profile.email || "Administrator" },
      }, 200, origin);
    }

    if (req.method === "GET" && action === "candidates") {
      const pages = await Promise.all([0,1,2].map((page) => db(
        "prynce_tv_discovery_candidates?select=id,source_key,source_url,channel_name,channel_slug,category,country_code,feed_url,feed_type,review_status,health_status,rights_evidence_url,review_notes,discovered_at,last_seen_at,last_checked_at&order=last_seen_at.desc.nullslast&limit=1000",
        { headers: { Range: (page * 1000) + "-" + ((page * 1000) + 999) } }
      )));
      const all = pages.flat().filter(Boolean);
      const countryFilter = String(url.searchParams.get("country") || "").trim().toUpperCase();
      const categoryFilter = String(url.searchParams.get("category") || "").trim().toLowerCase();
      const healthFilter = String(url.searchParams.get("health") || "").trim().toLowerCase();
      const searchTerm = String(url.searchParams.get("search") || "").trim().toLowerCase();
      const filtered = all.filter((x: any) =>
        (!countryFilter || x.country_code === countryFilter) &&
        (!categoryFilter || String(x.category || "").toLowerCase().split(";").includes(categoryFilter)) &&
        (!healthFilter || String(x.health_status || "").toLowerCase() === healthFilter) &&
        (!searchTerm || [x.channel_name,x.channel_slug,x.category,x.country_code].some(v => String(v || "").toLowerCase().includes(searchTerm)))
      );
      const registered = await db("prynce_tv_feeds?select=channel_slug,feed_url&limit=1000");
      const knownSlugs = new Set((registered || []).map((x: any) => String(x.channel_slug || "").toLowerCase()));
      const knownUrls = new Set((registered || []).map((x: any) => String(x.feed_url || "").toLowerCase()));
      const items = filtered.slice(0,250).map((x: any) => ({
        ...x,
        registered: knownSlugs.has(String(x.channel_slug || "").toLowerCase()) || knownUrls.has(String(x.feed_url || "").toLowerCase())
      }));
      return reply({
        candidates: items,
        count: filtered.length,
        returned: items.length,
        total: all.length,
        registered: items.filter((x: any) => x.registered).length,
        countries: [...new Set(all.map((x: any) => x.country_code))].sort(),
        categories: [...new Set(all.flatMap((x: any) => String(x.category || "").split(";").map((v: string) => v.trim()).filter(Boolean)))].sort(),
        filters: { country: countryFilter || null, category: categoryFilter || null, health: healthFilter || null, search: searchTerm || null }
      }, 200, origin);
    }

    if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405, origin);


    if (action === "save_rights_outreach") {
      const candidateId = String(body.candidate_id || "").trim();
      const broadcasterId = String(body.broadcaster_id || "").trim();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const hasCandidate = uuidPattern.test(candidateId);
      const hasBroadcaster = uuidPattern.test(broadcasterId);
      if ((candidateId && !hasCandidate) || (broadcasterId && !hasBroadcaster) || hasCandidate === hasBroadcaster) {
        return reply({ error: "Provide exactly one valid discovery candidate ID or broadcaster ID." }, 400, origin);
      }
      let targetName = "";
      if (hasCandidate) {
        const candidateRows = await db(`prynce_tv_discovery_candidates?id=eq.${encodeURIComponent(candidateId)}&select=id,channel_name,country_code&limit=1`);
        const candidate = candidateRows?.[0];
        if (!candidate) return reply({ error: "Discovery candidate not found." }, 404, origin);
        targetName = candidate.channel_name;
      } else {
        const broadcasterRows = await db(`prynce_tv_broadcaster_directory?id=eq.${encodeURIComponent(broadcasterId)}&select=id,channel_name,country_code&limit=1`);
        const broadcaster = broadcasterRows?.[0];
        if (!broadcaster) return reply({ error: "Broadcaster directory entry not found." }, 404, origin);
        targetName = broadcaster.channel_name;
      }
      const verification = String(body.contact_verification || "unverified");
      if (!["official", "publisher_lead", "unverified"].includes(verification)) return reply({ error: "Invalid contact verification status." }, 400, origin);
      const status = String(body.request_status || "draft");
      if (!["draft", "ready_to_send", "sent", "acknowledged", "approved", "declined", "follow_up"].includes(status)) return reply({ error: "Invalid outreach status." }, 400, origin);
      const contactEmail = String(body.contact_email || "").trim().slice(0,254);
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return reply({ error: "Enter a valid contact email." }, 400, origin);
      const contactUrl = body.contact_url ? httpsUrl(body.contact_url) : null;
      const evidenceUrl = body.evidence_url ? httpsUrl(body.evidence_url) : null;
      if (body.contact_url && !contactUrl) return reply({ error: "Contact page must use a valid HTTPS URL." }, 400, origin);
      if (body.evidence_url && !evidenceUrl) return reply({ error: "Evidence link must use a valid HTTPS URL." }, 400, origin);
      const payload = {
        candidate_id: hasCandidate ? candidateId : null,
        broadcaster_id: hasBroadcaster ? broadcasterId : null,
        channel_name: targetName,
        contact_name: String(body.contact_name || "").trim().slice(0,160) || null,
        contact_email: contactEmail || null,
        contact_phone: String(body.contact_phone || "").trim().slice(0,60) || null,
        contact_url: contactUrl,
        contact_verification: verification,
        request_status: status,
        requested_rights: String(body.requested_rights || "Written permission to stream or retransmit the broadcaster's channel on PRYNCE TV").trim().slice(0,2000),
        evidence_url: evidenceUrl,
        sent_at: status === "sent" ? (body.sent_at || new Date().toISOString()) : (body.sent_at || undefined),
        response_due_at: body.response_due_at || null,
        response_notes: String(body.response_notes || "").trim().slice(0,4000) || null,
        request_subject: String(body.request_subject || "").trim().slice(0,240) || null,
        request_message: String(body.request_message || "").trim().slice(0,12000) || null,
        updated_at: new Date().toISOString()
      };
      if (!payload.requested_rights) return reply({ error: "Requested rights description is required." }, 400, origin);
      let saved;
      if (hasBroadcaster) {
        const existing = await db(`prynce_tv_rights_outreach?broadcaster_id=eq.${encodeURIComponent(broadcasterId)}&select=id&limit=1`);
        if (existing?.[0]) {
          saved = await db(`prynce_tv_rights_outreach?id=eq.${encodeURIComponent(existing[0].id)}&select=*`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload)
          });
        } else {
          saved = await db("prynce_tv_rights_outreach?select=*", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload)
          });
        }
      } else {
        saved = await db("prynce_tv_rights_outreach?on_conflict=candidate_id&select=*", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(payload)
        });
      }
      const row = saved?.[0];
      if (row) {
        await db("activity_log", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ actor_id: auth.user.id, action: "rights_outreach_saved", entity_type: "prynce_tv_rights_outreach", entity_id: row.id, details: { channel_name: targetName, request_status: status, contact_verification: verification } })
        });
      }
      return reply({ outreach: row, message: "Broadcaster rights outreach record saved. No email or message has been sent automatically." }, 200, origin);
    }

    if (action === "check_candidates_batch") {
      const candidates = await db(
        "prynce_tv_discovery_candidates?review_status=in.(pending,approved_for_review)&select=id,channel_name,feed_url,feed_type,review_notes&order=last_checked_at.asc.nullsfirst&limit=20"
      );
      const results: any[] = [];
      for (let offset = 0; offset < (candidates || []).length; offset += 3) {
        const group = candidates.slice(offset, offset + 3);
        const checked = await Promise.all(group.map(async (candidate: any) => {
          let result: any;
          try {
            result = await inspectFeed(candidate.feed_url, candidate.feed_type);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Candidate feed check failed.";
            const blocked = /public hostname|public IP|HTTPS feed endpoints/i.test(message);
            result = {
              status: blocked ? "blocked" : "offline",
              httpStatus: null,
              responseMs: null,
              contentType: null,
              playlistValid: null,
              bytesSampled: 0,
              errorCode: blocked ? "UNSAFE_FEED_TARGET" : "FEED_CHECK_FAILED",
              errorMessage: message.slice(0, 220)
            };
          }
          const checkedAt = new Date().toISOString();
          const auditLine = "BATCH SIGNAL TEST " + checkedAt + ": " + result.status +
            "; HTTP " + (result.httpStatus ?? "n/a") +
            "; response " + (result.responseMs ?? "n/a") + "ms" +
            "; content type " + (result.contentType ?? "n/a") +
            "; HLS valid " + (result.playlistValid ?? "n/a") +
            "; " + (result.errorMessage || result.errorCode || "No endpoint error reported.") +
            ". Endpoint check only; not a rights determination or full playback guarantee.";
          await db("prynce_tv_discovery_candidates?id=eq." + encodeURIComponent(candidate.id), {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              health_status: result.status,
              http_status: result.httpStatus,
              response_ms: result.responseMs,
              last_checked_at: checkedAt,
              review_notes: [candidate.review_notes, auditLine].filter(Boolean).join("\n").slice(-4000)
            })
          });
          return {
            candidate_id: candidate.id,
            channel_name: candidate.channel_name,
            checked_at: checkedAt,
            ...result
          };
        }));
        results.push(...checked);
      }
      return reply({
        checked: results.length,
        healthy: results.filter((x: any) => x.status === "healthy").length,
        degraded: results.filter((x: any) => x.status === "degraded").length,
        offline: results.filter((x: any) => x.status === "offline").length,
        blocked: results.filter((x: any) => x.status === "blocked").length,
        results,
        message: "Candidate endpoint checks completed. Healthy means the feed endpoint and HLS playlist passed this server-side check; it does not establish distribution rights or prove sustained video playback."
      }, 200, origin);
    }

    if (action === "check_candidate") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Candidate ID is required." }, 400, origin);
      const candidates = await db(`prynce_tv_discovery_candidates?id=eq.${encodeURIComponent(id)}&select=id,channel_name,feed_url,feed_type,review_notes&limit=1`);
      const candidate = candidates?.[0];
      if (!candidate) return reply({ error: "Discovery candidate not found." }, 404, origin);
      let result: any;
      try { result = await inspectFeed(candidate.feed_url, candidate.feed_type); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Candidate feed check failed.";
        const blocked = /public hostname|public IP|HTTPS feed endpoints/i.test(message);
        result = { status: blocked ? "blocked" : "offline", httpStatus: null, responseMs: null, contentType: null, playlistValid: null, bytesSampled: 0, errorCode: blocked ? "UNSAFE_FEED_TARGET" : "FEED_CHECK_FAILED", errorMessage: message.slice(0, 220) };
      }
      const checkedAt = new Date().toISOString();
      const auditLine = "SIGNAL TEST " + checkedAt + ": " + result.status + "; HTTP " + (result.httpStatus ?? "n/a") + "; response " + (result.responseMs ?? "n/a") + "ms; content type " + (result.contentType ?? "n/a") + "; HLS valid " + (result.playlistValid ?? "n/a") + "; " + (result.errorMessage || result.errorCode || "No endpoint error reported.") + ". This is an endpoint check only, not a rights determination or guarantee of full playback.";
      const updated = await db(`prynce_tv_discovery_candidates?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          health_status: result.status,
          http_status: result.httpStatus,
          response_ms: result.responseMs,
          last_checked_at: checkedAt,
          review_notes: String(candidate.review_notes || "").slice(0, 6000) + "\\n\\n" + auditLine,
          updated_at: checkedAt
        })
      });
      if (!updated?.[0]) return reply({ error: "Candidate signal result could not be saved." }, 500, origin);
      await audit(auth.user.id, "discovery_candidate_signal_checked", id, { status: result.status, http_status: result.httpStatus, response_ms: result.responseMs, error_code: result.errorCode });
      return reply({ candidate: updated[0], checked_at: checkedAt, ...result, message: "Candidate endpoint checked and result recorded. Rights remain pending." }, 200, origin);
    }

    if (action === "queue_candidate") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Candidate ID is required." }, 400, origin);
      const candidates = await db(`prynce_tv_discovery_candidates?id=eq.${encodeURIComponent(id)}&select=id,channel_slug,channel_name,category,country_code,feed_url,feed_type,source_key,source_url&limit=1`);
      const candidate = candidates?.[0];
      if (!candidate) return reply({ error: "Discovery candidate not found." }, 404, origin);
      const duplicate = await db(`prynce_tv_feeds?or=(channel_slug.eq.${encodeURIComponent(candidate.channel_slug)},feed_url.eq.${encodeURIComponent(candidate.feed_url)})&select=id,channel_name&limit=1`);
      if (duplicate?.[0]) return reply({ existing: duplicate[0], message: "This channel is already in the private feed registry." }, 200, origin);
      const saved = await db("prynce_tv_feeds", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          channel_slug: candidate.channel_slug,
          channel_name: candidate.channel_name,
          category: candidate.category || "General",
          country_code: candidate.country_code || "GH",
          feed_type: candidate.feed_type || "HLS",
          feed_url: candidate.feed_url,
          rights_status: "pending",
          rights_evidence_url: null,
          territories: [candidate.country_code || "GH"],
          enabled: false,
          health_status: "not_checked",
          operator_notes: "Imported from " + String(candidate.source_key || "public discovery") + ". Rights evidence is not supplied. Keep disabled until broadcaster permission is documented.",
          created_by: auth.user.id,
          updated_by: auth.user.id
        })
      });
      if (!saved?.[0]) return reply({ error: "Candidate could not be added to the review registry." }, 500, origin);
      await audit(auth.user.id, "discovery_candidate_queued_for_rights_review", saved[0].id, { source_key: candidate.source_key, candidate_id: candidate.id });
      return reply({ feed: saved[0], message: "Added to the private review registry as pending and disabled. Add official rights evidence and check the signal before approval." }, 200, origin);
    }

    if (action === "check_feed") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Feed ID is required." }, 400, origin);
      const rows = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(id)}&select=id,feed_url,feed_type,channel_name`);
      const feed = rows?.[0];
      if (!feed) return reply({ error: "Feed not found." }, 404, origin);
      return reply(await checkOneFeed(feed, auth.user.id), 200, origin);
    }

    if (action === "check_all") {
      const rows = await db("prynce_tv_feeds?enabled=eq.true&rights_status=eq.approved&select=id,feed_url,feed_type,channel_name,rights_valid_until&order=updated_at.asc&limit=25");
      const results = [];
      for (const feed of rows || []) {
        if (feed.rights_valid_until && new Date(feed.rights_valid_until).getTime() <= Date.now()) {
          const checkedAt = new Date().toISOString();
          await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(feed.id)}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ enabled: false, rights_status: "expired", health_status: "expired", updated_by: auth.user.id, updated_at: checkedAt }),
          });
          await audit(auth.user.id, "feed_rights_expired", feed.id);
          results.push({ feed_id: feed.id, channel_name: feed.channel_name, status: "expired", auto_disabled: true });
          continue;
        }
        results.push(await checkOneFeed(feed, auth.user.id));
      }
      return reply({
        checked: results.length,
        healthy: results.filter((x: any) => x.status === "healthy").length,
        degraded: results.filter((x: any) => x.status === "degraded").length,
        offline: results.filter((x: any) => x.status === "offline").length,
        blocked: results.filter((x: any) => x.status === "blocked").length,
        auto_disabled: results.filter((x: any) => x.auto_disabled).length,
        results,
        message: results.length ? "Batch health check completed." : "No approved and enabled feeds are registered for checking."
      }, 200, origin);
    }

    if (action === "save_feed") {
      const channelSlug = String(body.channel_slug || "").trim().toLowerCase();
      const channelName = String(body.channel_name || "").trim().slice(0, 120);
      const feedType = String(body.feed_type || "HLS").toUpperCase();
      const feedUrl = httpsUrl(body.feed_url);
      const evidence = body.rights_evidence_url ? httpsUrl(body.rights_evidence_url) : null;
      const territories = cleanTerritories(body.territories);
      const validFrom = body.rights_valid_from ? new Date(body.rights_valid_from) : null;
      const validUntil = body.rights_valid_until ? new Date(body.rights_valid_until) : null;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(channelSlug) || !channelName || !feedUrl)
        return reply({ error: "Enter a valid channel slug, channel name and HTTPS feed URL." }, 400, origin);
      if (!["HLS", "VIDEO", "EMBED", "EXTERNAL"].includes(feedType))
        return reply({ error: "Unsupported feed type." }, 400, origin);
      if (body.rights_evidence_url && !evidence)
        return reply({ error: "Rights evidence must use a valid HTTPS URL." }, 400, origin);
      if (validFrom && Number.isNaN(validFrom.getTime()) || validUntil && Number.isNaN(validUntil.getTime()))
        return reply({ error: "Enter valid rights dates." }, 400, origin);
      if (validFrom && validUntil && validUntil <= validFrom)
        return reply({ error: "Rights expiry must be after the start date." }, 400, origin);
      const row = {
        channel_slug: channelSlug,
        channel_name: channelName,
        feed_type: feedType,
        feed_url: feedUrl,
        rights_status: "pending",
        rights_evidence_url: evidence,
        rights_valid_from: validFrom ? validFrom.toISOString() : null,
        rights_valid_until: validUntil ? validUntil.toISOString() : null,
        territories: territories.length ? territories : ["GH"],
        enabled: false,
        health_status: "not_checked",
        operator_notes: String(body.operator_notes || "").trim().slice(0, 2000),
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      };
      const id = String(body.id || "");
      let saved;
      if (id) {
        saved = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(row),
        });
      } else {
        saved = await db("prynce_tv_feeds", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...row, created_by: auth.user.id }),
        });
      }
      if (!saved?.[0]) return reply({ error: "Feed configuration could not be saved." }, 500, origin);
      await audit(auth.user.id, id ? "feed_updated_pending_review" : "feed_created_pending_review", saved[0].id, { channel_slug: channelSlug, feed_type: feedType });
      return reply({ feed: saved[0], message: "Saved securely as pending. It cannot play until rights are approved." }, 200, origin);
    }

    if (action === "approve_feed") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Feed ID is required." }, 400, origin);
      const rows = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(id)}&select=id,rights_evidence_url,rights_valid_from,rights_valid_until,territories,enabled,feed_type,health_status,last_health_check`);
      const feed = rows?.[0];
      if (!feed) return reply({ error: "Feed not found." }, 404, origin);
      if (!httpsUrl(feed.rights_evidence_url)) return reply({ error: "Add official rights evidence before approval." }, 409, origin);
      const checkedAt = feed.last_health_check ? new Date(feed.last_health_check).getTime() : 0;
      if (feed.health_status !== "healthy" || !checkedAt || Date.now() - checkedAt > 15 * 60 * 1000)
        return reply({ error: "Run a successful feed check within the last 15 minutes before approval." }, 409, origin);
      const now = Date.now();
      if (feed.rights_valid_from && new Date(feed.rights_valid_from).getTime() > now)
        return reply({ error: "Rights period has not started yet." }, 409, origin);
      if (feed.rights_valid_until && new Date(feed.rights_valid_until).getTime() <= now)
        return reply({ error: "Rights period has expired. Update the dates before approval." }, 409, origin);
      const updated = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ rights_status: "approved", enabled: true, updated_by: auth.user.id, updated_at: new Date().toISOString() }),
      });
      await audit(auth.user.id, "feed_rights_approved", id, { territories: feed.territories });
      return reply({ feed: updated?.[0], message: "Rights approved. Feed is enabled for the listed territories." }, 200, origin);
    }

    if (action === "disable_feed" || action === "reject_feed") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Feed ID is required." }, 400, origin);
      const patch = action === "reject_feed"
        ? { enabled: false, rights_status: "rejected", updated_by: auth.user.id, updated_at: new Date().toISOString() }
        : { enabled: false, updated_by: auth.user.id, updated_at: new Date().toISOString() };
      const updated = await db(`prynce_tv_feeds?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!updated?.[0]) return reply({ error: "Feed not found or no change was made." }, 404, origin);
      await audit(auth.user.id, action === "reject_feed" ? "feed_rights_rejected" : "feed_disabled", id);
      return reply({ feed: updated[0], message: action === "reject_feed" ? "Feed rejected and disabled." : "Feed disabled." }, 200, origin);
    }

    return reply({ error: "Unknown action." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return reply({ error: message.slice(0, 240) }, 500, origin);
  }
});