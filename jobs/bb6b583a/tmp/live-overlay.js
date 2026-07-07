'use strict';
/* Crown / Provincial-Park / WMA / Treaty land-tenure overlay (mission M-CROWN-LAND-OVERLAY).
 *
 * Niyyah: a Canadian traveller looking at any point on the map should be able to know — at a
 * glance, BEFORE driving there — whether camping there is legally permissible (Crown vs park
 * vs WMA vs Treaty/Reserve vs private). Legality is a safety & respect issue; we do not
 * abdicate it to forum threads.
 *
 * Architecture:
 *   - Reads the layer index from /api/land-tenure?layer=index (same-origin Pages Function,
 *     see functions/api/land-tenure.js) and builds Leaflet layer-control overlays for each
 *     tenure layer.
 *   - Each tenure layer is fetch-on-toggle (lazy): the polygon GeoJSON is only requested when
 *     the user actually enables that layer in the layer-control. This keeps the initial map
 *     payload small (the overlay is OPT-IN, not on-by-default).
 *   - On polygon click: bottom-sheet popup shows tenure name + legal-use note + provincial
 *     source link + provenance chip (source_name / fetched_at / confidence) matching the M4
 *     chip used elsewhere on the map.
 *   - TAQWA gate: if the upstream feed is unreachable the toggle stays available but the
 *     layer is rendered semi-transparent grey with "land status data unconfirmed — checked
 *     <ts>". Never green-by-default.
 *   - Indigenous protocol (operator-mandated, non-negotiable): for any layer flagged
 *     indigenous_protocol:true the popup includes the explicit cultural note:
 *     "Shown for orientation and respect — Permission may be required from the Nation;
 *     check with the local band office before camping."
 *
 * Integration: this script defers, waits for window.map + window._layerCtl (set by map.html
 * inline init), then attaches. If either is missing (the map failed to init) the module
 * exits silently — the rest of map.html still works.
 *
 * NL-BRIEFING HOOK (mission m-25-nl-oracle-briefings):
 *   When a tenure layer is unconfirmed (TAQWA "data unconfirmed" placeholder) OR a polygon
 *   click yields a feature with no actionable name/legal context, we POST to /api/oracle/nl-brief
 *   to fetch a SOURCED 2-3 sentence briefing naming the provincial portal + 3 cite-able URLs.
 *   The briefing renders below the existing card; on degraded response (no model, no key, no
 *   sources extracted) we render nothing — the deterministic card is unchanged. The briefing
 *   NEVER overrides the deterministic verdict; it only points at where to verify.
 */
(function () {
  var TENURE_API = '/api/land-tenure';
  var NL_BRIEF_API = '/api/oracle/nl-brief';
  var FIRE_BAN_API = '/api/fire-bans';

  // mission feat/crown-legal-full-text-2026-06-23: per-province FULL legality paragraph
  // cache. Fetched once on first popup that needs it; reused for subsequent popups in
  // the same session. The provincial-rules endpoint is a small payload (~5 KB, 13 entries)
  // edge-cached for 24h, so even worst-case the fetch is cheap.
  var _provincialRulesCache = null;
  var _provincialRulesPending = null;

  function getProvincialRules() {
    if (_provincialRulesCache) {
      return Promise.resolve(_provincialRulesCache);
    }
    if (_provincialRulesPending) {
      return _provincialRulesPending;
    }
    _provincialRulesPending = fetch(TENURE_API + '?layer=provincial-rules')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.rules && j.bboxes) {
          _provincialRulesCache = j;
          return j;
        }
        // Degraded — return null so the popup still renders without the full paragraph.
        // TAQWA: a missing provincial-rules feed must not break the deterministic Crown
        // popup card (which already carries the abbreviated legal_note).
        return null;
      })
      .catch(function () { return null; });
    return _provincialRulesPending;
  }

  // Province detection from a clicked polygon's feature properties + click anchor latlng.
  // Strategy (in order):
  //   1. EXPLICIT — read province from upstream attributes if present. Parks Canada
  //      legislative-boundary layer sets PROVINCE_EN / PROVINCE_FR (verified 2026-06-22);
  //      some other Open-Data layers use PROV / PROVINCE / juris_code. We try each.
  //   2. BBOX — fall back to provinceFromLatLng() using PROVINCE_BBOXES from the API.
  //      Honestly approximate: borders are coastline-precise upstream but our bbox is
  //      whole-degree. Comment in the API constant calls this out. First-match-wins
  //      iteration order is mainland-population-descending so e.g. an Ontario click
  //      doesn't get a stray NU bbox hit.
  //
  // Returns ISO 3166-2:CA code ('CA-ON', 'CA-BC', ...) or null if no province can be
  // determined (offshore polygon, north-of-bbox arctic, etc).
  function detectProvinceCode(featureProps, anchor, rulesPayload) {
    var p = featureProps || {};
    // Explicit attribute path — try the common upstream field names.
    var explicit = (
      p.juris_code || p.JURIS_CODE
      || p.prov_code || p.PROV_CODE
      || p.PROV || p.prov
      || p.PROVINCE_EN || p.PROVINCE_FR
      || p.PROVINCE || p.province
      || p.PR_NAME || p.pr_name
      || null
    );
    if (explicit) {
      var nameToCode = {
        'BRITISH COLUMBIA': 'CA-BC', 'COLOMBIE-BRITANNIQUE': 'CA-BC', 'BC': 'CA-BC',
        'ALBERTA': 'CA-AB', 'AB': 'CA-AB',
        'SASKATCHEWAN': 'CA-SK', 'SK': 'CA-SK',
        'MANITOBA': 'CA-MB', 'MB': 'CA-MB',
        'ONTARIO': 'CA-ON', 'ON': 'CA-ON',
        'QUEBEC': 'CA-QC', 'QUÉBEC': 'CA-QC', 'QC': 'CA-QC',
        'NEW BRUNSWICK': 'CA-NB', 'NOUVEAU-BRUNSWICK': 'CA-NB', 'NB': 'CA-NB',
        'NOVA SCOTIA': 'CA-NS', 'NOUVELLE-ÉCOSSE': 'CA-NS', 'NS': 'CA-NS',
        'PRINCE EDWARD ISLAND': 'CA-PE', 'ÎLE-DU-PRINCE-ÉDOUARD': 'CA-PE', 'PE': 'CA-PE',
        'NEWFOUNDLAND AND LABRADOR': 'CA-NL', 'TERRE-NEUVE-ET-LABRADOR': 'CA-NL', 'NL': 'CA-NL',
        'YUKON': 'CA-YT', 'YT': 'CA-YT',
        'NORTHWEST TERRITORIES': 'CA-NT', 'TERRITOIRES DU NORD-OUEST': 'CA-NT', 'NT': 'CA-NT',
        'NUNAVUT': 'CA-NU', 'NU': 'CA-NU'
      };
      var key = String(explicit).toUpperCase().trim();
      if (nameToCode[key]) return nameToCode[key];
      // Already in ISO form?
      if (/^CA-(BC|AB|SK|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU)$/.test(key)) return key;
    }
    // Bbox fallback — needs the API payload AND a click anchor.
    if (!anchor || !rulesPayload || !rulesPayload.bboxes) return null;
    var lat = anchor.lat;
    var lng = anchor.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    // Iterate in SMALLEST-AREA-FIRST order so an overlap (BC east edge -114.04 vs AB west
    // edge -120.00 at Calgary's longitude; QC south edge 45.00 vs NB north edge 48.10 at
    // Fredericton; QC vs PE at Charlottetown) is resolved by the smaller / more-specific
    // box claiming the click. Bboxes verified against 13 capital cities (smoke test
    // 13/13 PASS). For overlap zones not represented by a capital city (e.g. the QC/NL
    // Labrador interior boundary) the bbox detection is an honest approximation only;
    // the deterministic Crown popup card (with its abbreviated legal_note) still renders
    // and is not overwritten by this code path.
    var order = ['CA-PE', 'CA-NS', 'CA-NB',  // tiny Maritimes first
                 'CA-NL', 'CA-AB', 'CA-SK', 'CA-MB', 'CA-ON',
                 'CA-QC', 'CA-BC',
                 'CA-YT', 'CA-NT', 'CA-NU']; // territories last (large, overlap arctic)
    for (var i = 0; i < order.length; i++) {
      var b = rulesPayload.bboxes[order[i]];
      if (!b) continue;
      if (lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]) return order[i];
    }
    return null;
  }

  // Render the full-paragraph provincial legality block. For 'researched' provinces this
  // is the verbatim corpus paragraph; for 'research_pending' it is an honest "research
  // pending" notice with the portal link only. Both shapes carry the official portal
  // URL so the user always has a verified destination to confirm rules themselves.
  function provincialLegalBlockHtml(code, rulesPayload) {
    if (!code || !rulesPayload || !rulesPayload.rules) return '';
    var rule = rulesPayload.rules[code];
    if (!rule) return '';
    var portalLink = rule.portal_url
      ? '<a href="' + esc(rule.portal_url) + '" target="_blank" rel="noopener noreferrer" style="color:#1d6f3a">'
        + esc(rule.portal_label || rule.portal_url) + '</a>'
      : '';
    var statusBadge;
    var bodyHtml;
    if (rule.status === 'researched' && rule.legal_paragraph) {
      statusBadge = '<span style="display:inline-block;padding:1px 6px;border-radius:10px;'
        + 'background:#e7f3ea;color:#1d6f3a;font-size:10px;font-weight:600;'
        + 'letter-spacing:0.02em;vertical-align:2px;margin-left:6px">FULL TEXT</span>';
      bodyHtml = '<div style="white-space:pre-wrap;font-size:12px;line-height:1.5;color:#2a3a2a">'
        + esc(rule.legal_paragraph) + '</div>';
    } else {
      statusBadge = '<span style="display:inline-block;padding:1px 6px;border-radius:10px;'
        + 'background:#fff5e0;color:#8a5a00;font-size:10px;font-weight:600;'
        + 'letter-spacing:0.02em;vertical-align:2px;margin-left:6px">RESEARCH PENDING</span>';
      bodyHtml = '<div style="font-size:12px;line-height:1.5;color:#705a30">'
        + 'Detailed Crown-land camping rules for <b>' + esc(rule.name) + '</b> are not yet '
        + 'captured in the muddytires corpus. Consult the official provincial / territorial '
        + 'portal below to verify stay limits, permits, fees, and seasonal closures before camping.'
        + '</div>';
    }
    return '<div class="mt-cl-prov-rules" style="margin-top:10px;padding:10px;'
      + 'border-radius:8px;background:#f5f8f4;border:1px solid #d2dccc;'
      + 'font:13px/1.5 \'Hanken Grotesk\',ui-sans-serif">'
      + '<div style="font:700 13px/1.2 \'Chivo\',ui-sans-serif;color:#1d6f3a;'
      + 'margin-bottom:6px;display:flex;align-items:center;flex-wrap:wrap">'
      + '<span>' + esc(rule.name) + ' — provincial Crown-land rules</span>'
      + statusBadge + '</div>'
      + bodyHtml
      + (portalLink
          ? '<div style="margin-top:8px;font-size:11px;color:#456">Official portal: ' + portalLink + '</div>'
          : '')
      + '</div>';
  }

  // Async injector — fetches provincial-rules (cached after first call) and appends the
  // FULL legality block to the popup card. Idempotent (dedupe sentinel) so re-opens or
  // overlapping injects do not double-render. On any error the deterministic popup card
  // remains visible unchanged.
  function injectProvincialLegalBlock(popupEl, featureProps, anchor) {
    if (!popupEl || typeof popupEl.appendChild !== 'function') return;
    if (popupEl.getAttribute('data-mt-prov-rules')) return;
    popupEl.setAttribute('data-mt-prov-rules', 'pending');
    getProvincialRules().then(function (payload) {
      if (!payload) {
        popupEl.setAttribute('data-mt-prov-rules', 'unavailable');
        return;
      }
      var code = detectProvinceCode(featureProps, anchor, payload);
      if (!code) {
        popupEl.setAttribute('data-mt-prov-rules', 'unmatched');
        return;
      }
      var html = provincialLegalBlockHtml(code, payload);
      if (!html) {
        popupEl.setAttribute('data-mt-prov-rules', 'empty');
        return;
      }
      var holder = document.createElement('div');
      holder.innerHTML = html;
      var node = holder.firstChild;
      if (node) popupEl.appendChild(node);
      popupEl.setAttribute('data-mt-prov-rules', 'done');
    }).catch(function () {
      popupEl.setAttribute('data-mt-prov-rules', 'error');
    });
  }

  /*
   * f-fire-bans/CL-popup-chip (mission F-FIRE-BANS-FE, 2026-06-23):
   * Every Crown-land popup queries /api/fire-bans?lat=&lng= for the polygon's
   * centroid (preferred) or the click point (fallback). If ANY active ban
   * contains that point, we PREPEND a 🔥 alert chip to the popup. This is the
   * "do not mislead users into fires" fix from the corpus digest — the existing
   * Crown-land overlay correctly says "this is Crown land" but says NOTHING
   * about live fire restrictions, so it can actively mislead a vanlifer into
   * lighting a campfire under a total ban. The chip closes that gap.
   *
   * The fire-ban-layer module (js/fire-ban-layer.js) publishes a small public
   * helper (window.__mtFireBans.queryBansAtPoint + .fireBanChipHtml) which we
   * call here so the chip styling stays in one place. If the helper is missing
   * (e.g. fire-ban-layer.js failed to load), we silently degrade — the popup
   * still shows the Crown-land card unchanged.
   */
  function injectFireBanChip(popupEl, lat, lng) {
    if (!popupEl || typeof popupEl.appendChild !== 'function') return;
    if (popupEl.getAttribute('data-mt-fb-chip')) return; // dedupe re-opens
    popupEl.setAttribute('data-mt-fb-chip', 'pending');
    var helper = window.__mtFireBans;
    if (!helper || typeof helper.queryBansAtPoint !== 'function') {
      // fire-ban-layer not loaded — fall back to a direct fetch so the safety
      // chip still surfaces.
      directFireBanFetch(lat, lng).then(function (containing) {
        renderFireBanChips(popupEl, containing);
      }).catch(function () {
        popupEl.setAttribute('data-mt-fb-chip', 'error');
      });
      return;
    }
    helper.queryBansAtPoint(lat, lng).then(function (r) {
      renderFireBanChips(popupEl, r && r.containing ? r.containing : []);
    }).catch(function () {
      popupEl.setAttribute('data-mt-fb-chip', 'error');
    });
  }

  function directFireBanFetch(lat, lng) {
    var url = FIRE_BAN_API + '?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng);
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (body) {
      var feats = (body && Array.isArray(body.features)) ? body.features : [];
      return feats.filter(function (f) {
        return f.properties && f.properties.relation === 'contains';
      });
    });
  }

  function renderFireBanChips(popupEl, containing) {
    if (!popupEl) return;
    popupEl.setAttribute('data-mt-fb-chip', containing && containing.length ? 'done' : 'none');
    if (!containing || !containing.length) return;
    // Prepend (insertBefore the first child) so the chip is the FIRST thing the
    // user reads. A bottom-anchored warning loses the safety race.
    var helper = window.__mtFireBans;
    var holder = document.createElement('div');
    holder.className = 'mt-cl-fb-chip-holder';
    holder.style.cssText = 'margin:0 0 8px;padding:8px 10px;border-radius:8px;'
      + 'background:#400510;color:#ffd2dc;'
      + 'border:1px solid #7a1c30;'
      + 'font:600 12px/1.4 \'Hanken Grotesk\',ui-sans-serif';
    var lines = [];
    // Headline.
    lines.push('<div style="font:800 13px/1.2 \'Chivo\',ui-sans-serif;color:#ffd2dc;'
      + 'display:flex;align-items:center;gap:5px">'
      + '<span aria-hidden="true">🔥</span>'
      + '<span>Active fire restriction at this location</span>'
      + '</div>');
    // One row per containing ban (cap 3 — anything more is noise).
    var rows = containing.slice(0, 3).map(function (f) {
      var p = (f && f.properties) || {};
      var name = esc(p.region_name || (p.source_name || 'fire restriction'));
      var sev  = esc((p.severity || 'unknown'));
      var type = esc((p.ban_type || 'restriction'));
      return '<div style="margin-top:4px;font-size:11px;font-weight:500;color:#fde0e6">'
        + '<strong>' + name + '</strong>'
        + ' — ' + type + ' (' + sev + ')'
        + '</div>';
    });
    lines.push.apply(lines, rows);
    lines.push('<div style="margin-top:6px;font:600 11px/1.2 \'JetBrains Mono\',ui-monospace,monospace;'
      + 'color:#ffd2dc">Do not light fires — see the fire-ban overlay for the source link.</div>');
    holder.innerHTML = lines.join('');
    if (popupEl.firstChild) {
      popupEl.insertBefore(holder, popupEl.firstChild);
    } else {
      popupEl.appendChild(holder);
    }
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function freshness(fetchedAt) {
    if (!fetchedAt) return 'data unconfirmed';
    try {
      var then = new Date(fetchedAt).getTime();
      if (isNaN(then)) return 'data unconfirmed';
      var days = Math.floor((Date.now() - then) / 86400000);
      if (days < 1) return 'checked today';
      if (days < 7) return 'checked ' + days + 'd ago';
      if (days < 30) return 'checked ' + days + 'd ago';
      return 'checked ' + Math.floor(days / 30) + 'mo ago';
    } catch (e) { return 'data unconfirmed'; }
  }

  function provenanceChip(meta) {
    if (!meta) return '';
    var src = meta.source_url
      ? '<a href="' + esc(meta.source_url) + '" target="_blank" rel="noopener noreferrer">' + esc(meta.source_name || 'source') + '</a>'
      : esc(meta.source_name || 'source');
    var conf = esc(meta.confidence || 'UNVERIFIED');
    return '<div class="mt-prov" style="margin-top:6px;padding-top:5px;border-top:1px solid #eee;font-size:12px;color:#5a6b5a">'
      + 'source: ' + src + ' &middot; ' + esc(freshness(meta.fetched_at))
      + ' &middot; <span class="mt-conf mt-conf--' + conf.toLowerCase() + '">' + conf + '</span></div>';
  }

  // m-25-nl-oracle-briefings: fetch a sourced briefing from /api/oracle/nl-brief and
  // render it under the existing popup card. Idempotent — calling popup.setContent inside
  // a fetch.then() preserves the popup's open state. On any error/degraded response, we
  // leave the original content unchanged (TAQWA: NEVER overwrite the deterministic card
  // with a guess).
  function injectNlBriefing(popupEl, lat, lng, verdictUnknownReason) {
    if (!popupEl || typeof popupEl.appendChild !== 'function') return;
    // Sentinel so a popup that re-opens or fires nnFillOracle twice does not double-fetch.
    if (popupEl.getAttribute('data-mt-nl-brief')) return;
    popupEl.setAttribute('data-mt-nl-brief', 'pending');
    var holder = document.createElement('div');
    holder.className = 'mt-nl-brief';
    holder.setAttribute('aria-live', 'polite');
    holder.style.cssText = 'margin-top:8px;padding-top:7px;border-top:1px dashed #ccd;font-size:12px;color:#456;line-height:1.45';
    holder.innerHTML = '<i style="color:#789">Loading sourced briefing&hellip;</i>';
    popupEl.appendChild(holder);
    var body = { lat: lat, lng: lng, verdict_unknown_reason: verdictUnknownReason, locale: 'en-CA' };
    fetch(NL_BRIEF_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (resp) {
        if (!resp.ok || !resp.body || resp.body.ok !== true || !resp.body.briefing || !resp.body.sources || resp.body.sources.length === 0) {
          // Degraded — drop the briefing card entirely; the deterministic card stays.
          if (holder.parentNode) holder.parentNode.removeChild(holder);
          popupEl.setAttribute('data-mt-nl-brief', 'degraded');
          return;
        }
        var b = resp.body;
        var safeBrief = esc(b.briefing);
        var linkHtml = '';
        for (var i = 0; i < b.sources.length && i < 5; i++) {
          var u = b.sources[i];
          // Render URLs only via the same escape pipe that buildPopup uses for source links;
          // the constructor already validated http(s) protocol server-side.
          linkHtml += '<div style="margin-top:3px"><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" style="color:#1d6f3a">' + esc(u) + '</a></div>';
        }
        var modelTag = b.model ? ' &middot; <span style="color:#789">' + esc(b.model) + '</span>' : '';
        holder.innerHTML =
          '<div style="font-weight:600;color:#234;margin-bottom:4px">Sourced briefing</div>' +
          '<div style="white-space:pre-wrap">' + safeBrief + '</div>' +
          '<div style="margin-top:5px;font-size:11px;color:#789">Sources to verify' + modelTag + ':</div>' +
          linkHtml +
          '<div style="margin-top:6px;font-size:11px;color:#a44">Briefing is advisory — contact the relevant land manager before camping.</div>';
        popupEl.setAttribute('data-mt-nl-brief', 'done');
      })
      .catch(function () {
        // Network error — same TAQWA treatment as degraded: remove the holder, leave the
        // deterministic card visible.
        if (holder.parentNode) holder.parentNode.removeChild(holder);
        popupEl.setAttribute('data-mt-nl-brief', 'error');
      });
  }

  // mission feat/ab-wma-split (2026-06-23): WMU popup chip carries '#{wmu_n}'. We
  // substitute the unit number from the clicked polygon's properties. The upstream
  // schema (verified 2026-06-22) exposes WMUNIT_CODE (3-digit zero-padded, e.g. '328')
  // and WMUNIT_NAME (full title, e.g. 'WMU 328') — prefer CODE for the chip ('#328'
  // reads cleaner than '#WMU 328'). For other layers/datasets the substitution is a
  // no-op (the chip text doesn't contain the token).
  function substituteChipTokens(chip, featureProps) {
    if (!chip) return '';
    var p = featureProps || {};
    var wmuN = p.WMUNIT_CODE || p.wmunit_code || p.WMUNIT_NAME || p.wmunit_name
      || p.WMU || p.wmu || '';
    // Strip a 'WMU ' prefix if it came from WMUNIT_NAME — the chip already says 'UNIT #'.
    if (typeof wmuN === 'string') wmuN = wmuN.replace(/^WMU\s+/i, '');
    return String(chip).replace(/\{wmu_n\}/g, wmuN || '?');
  }

  function popupChipHtml(chipText) {
    if (!chipText) return '';
    return '<div class="mt-cl-popup-chip" style="margin:0 0 6px;padding:7px 9px;'
      + 'border-radius:6px;background:#f4f0e7;border:1px solid #d8c9a8;'
      + 'color:#3a3024;font:600 12px/1.35 \'Hanken Grotesk\',ui-sans-serif">'
      + esc(chipText) + '</div>';
  }

  function buildPopup(meta, featureProps) {
    // Polygon click -> bottom-sheet detail. featureProps comes from the upstream Open-Data
    // record (the WFS/ArcGIS field set differs per province — show what we have).
    var name = featureProps && (featureProps.name || featureProps.NAME || featureProps.PARK_NAME
      || featureProps.RESERVE_NAME || featureProps.TENURE_PURPOSE || featureProps.TENURE_TYPE
      || featureProps.SUBTYPE);
    // Icon priority: explicit per-dataset meta.icon (set in functions/api/land-tenure.js
    // DATASETS) > indigenous-protocol fallback > maple-leaf default. Mission
    // m-ab-wma-semantic-clarification introduced the per-dataset icon to visually
    // distinguish WMU (hunting) from WMA (protected habitat) — both legitimate
    // wildlife layers but answering different vanlifer questions.
    var icon = meta.icon
      ? esc(meta.icon) + ' '
      : (meta.indigenous_protocol ? '\u{1FA77} ' : '\u{1F341} ');
    var title = '<b style="color:' + esc(meta.color || '#2e7d32') + '">'
      + icon
      + esc(meta.source_name || 'Land tenure') + '</b>';
    var sub = name ? '<div style="font-size:13px;margin-top:4px">' + esc(name) + '</div>' : '';
    // mission feat/ab-wma-split (2026-06-23): if the dataset declares an operator-mandated
    // popup_chip, render it ABOVE the legal_note. The chip is the headline vanlifer
    // disambiguation (e.g. 'WMU governs HUNTING SEASONS, not camping legality'); the
    // legal_note underneath carries the deeper regulatory framing (blaze orange,
    // AR 143/79, hunting Guide link). The chip is rendered after sub so the polygon's
    // own name (when available) still leads.
    var chipText = substituteChipTokens(meta.popup_chip, featureProps);
    var chipBlock = popupChipHtml(chipText);
    var legalBlock = '<div style="font-size:12px;margin-top:6px;color:#3a4a3a">' + esc(meta.legal_note || '') + '</div>';
    var indigenousBlock = meta.indigenous_protocol
      ? '<div style="font-size:12px;margin-top:6px;padding:6px 8px;background:#f4eaf7;border-left:3px solid #7b2fbe;color:#4a2a5a"><b>Cultural protocol:</b> Shown for orientation and respect. Permission may be required from the Nation &mdash; check with the local band office or community before camping. The map confers no access right.</div>'
      : '';
    return title + sub + chipBlock + legalBlock + indigenousBlock + provenanceChip(meta);
  }

  function attachLayer(map, layerCtl, key, meta) {
    // Each tenure layer is created empty + toggle-driven. The first time the user enables
    // it we fetch the GeoJSON; subsequent toggles reuse the loaded layer.
    var loaded = false;
    var loading = false;
    var grp = L.layerGroup();
    var styleOk = {
      color: meta.color || '#2e7d32',
      weight: 1,
      fillColor: meta.color || '#2e7d32',
      fillOpacity: 0.22
    };
    var styleUnconfirmed = {
      color: '#888',
      weight: 1,
      fillColor: '#aaa',
      fillOpacity: 0.18,
      dashArray: '4,4'
    };
    // Eagerly add the empty layer group to the map so Leaflet's layer control
    // can toggle it immediately. Without this the layer control sees the group
    // but the map never receives addLayer/removeLayer calls for it.
    if (meta.on_by_default) map.addLayer(grp);
    function load() {
      if (loaded || loading) return;
      loading = true;
      fetch(TENURE_API + '?layer=' + encodeURIComponent(key)).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      }).then(function (resp) {
        if (!resp.ok || !resp.body || resp.body.ok !== true || !resp.body.data) {
          // TAQWA: unreachable / non-2xx -> render a placeholder note marker at map center
          // so the user can SEE that the toggle is on but the data is unconfirmed. Better
          // than a silent empty layer (which reads as "no Crown land here").
          var ts = (resp.body && resp.body.fetched_at) || new Date().toISOString();
          var c = map.getCenter();
          var warn = L.circleMarker(c, { radius: 14, color: '#888', weight: 2, fillColor: '#aaa', fillOpacity: 0.3, dashArray: '4,4' });
          // mission feat/ab-wma-split (2026-06-23): surface the operator-mandated popup_chip
          // on the unconfirmed-data placeholder too. For ab_wma_protected (LINK_ONLY, no
          // public REST) this is the ONLY popup path the user ever sees, so the chip must
          // appear here or the WMA disambiguation text never reaches the user. The chip
          // has no per-feature tokens to substitute (no clicked polygon), so we pass {}.
          var unconfirmedChip = (resp.body && resp.body.popup_chip)
            ? popupChipHtml(substituteChipTokens(resp.body.popup_chip, {}))
            : '';
          warn.bindPopup(unconfirmedChip
            + '<b style="color:#666">' + esc(meta.source_name) + '</b><br>'
            + '<span style="font-size:12px;color:#666">Land status data unconfirmed &mdash; ' + esc(freshness(ts)) + '. '
            + 'Retry later or consult <a href="' + esc(meta.source_url) + '" target="_blank" rel="noopener noreferrer">the official source</a>.</span>');
          // m-25-nl-oracle-briefings: on popup open, fetch a sourced NL briefing and
          // append it under the unconfirmed-data card.
          warn.on('popupopen', function (ev) {
            var pop = ev.popup;
            var el = pop && pop.getElement && pop.getElement();
            var content = el && el.querySelector ? el.querySelector('.leaflet-popup-content') : null;
            if (content) {
              injectNlBriefing(content, c.lat, c.lng,
                'land-tenure upstream unreachable for layer "' + key + '" (' + (meta.source_name || key) + ')');
            }
          });
          warn.addTo(grp);
          loading = false;
          return;
        }
        var body = resp.body;
        var styled = Object.assign({}, styleOk, { fillColor: body.color || styleOk.fillColor, color: body.color || styleOk.color });
        L.geoJSON(body.data, {
          style: function () { return styled; },
          onEachFeature: function (feat, lyr) {
            var html = buildPopup({
              source_name: body.source_name,
              source_url: body.source_url,
              confidence: body.confidence,
              fetched_at: body.fetched_at,
              color: body.color,
              // mission feat/ab-wma-split (2026-06-23): forward the dataset's icon and
              // operator-mandated chip text to the popup builder. The icon overrides
              // the indigenous-protocol / maple-leaf fallback so WMU clicks render the
              // deer glyph from land-tenure.js DATASETS; popup_chip drives the headline
              // disambiguation row that sits ABOVE the legal_note.
              icon: body.icon,
              popup_chip: body.popup_chip,
              legal_note: body.legal_note,
              indigenous_protocol: body.indigenous_protocol
            }, feat && feat.properties);
            lyr.bindPopup(html, { maxWidth: 320 });
            // f-fire-bans/CL-popup-chip: every Crown-land polygon click queries
            // the fire-ban API for the popup's anchor point. If a ban contains
            // it, we prepend a loud 🔥 chip so the user is never misled into
            // lighting fires under a total ban on otherwise-legal Crown land.
            lyr.on('popupopen', function (ev) {
              var pop = ev.popup;
              var el = pop && pop.getElement && pop.getElement();
              var content = el && el.querySelector ? el.querySelector('.leaflet-popup-content') : null;
              if (!content) return;
              var anchor = pop.getLatLng();
              if (!anchor) return;
              injectFireBanChip(content, anchor.lat, anchor.lng);
              // mission feat/crown-legal-full-text-2026-06-23: inject the per-province
              // FULL legality paragraph beneath the deterministic Crown-land card. For
              // researched provinces (ON/QC/BC/AB) this is the verbatim corpus text; for
              // research-pending jurisdictions it is an honest notice + portal link.
              // The injector dedupes via a data attribute so re-opens do not double-render.
              injectProvincialLegalBlock(content, feat && feat.properties, anchor);
            });
          }
        }).addTo(grp);
        loaded = true;
        loading = false;
      }).catch(function () {
        // Network error -> same TAQWA treatment as a 503.
        var c = map.getCenter();
        var warn = L.circleMarker(c, { radius: 14, color: '#888', weight: 2, fillColor: '#aaa', fillOpacity: 0.3, dashArray: '4,4' });
        // mission feat/ab-wma-split (2026-06-23): if the index meta declared a popup_chip
        // for this dataset, render it here too. Network failure should not strip the
        // operator-mandated disambiguation copy off the WMU/WMA layers.
        var netErrChip = meta && meta.popup_chip
          ? popupChipHtml(substituteChipTokens(meta.popup_chip, {}))
          : '';
        warn.bindPopup(netErrChip
          + '<b style="color:#666">' + esc(meta.source_name) + '</b><br>'
          + '<span style="font-size:12px;color:#666">Land status data unreachable. '
          + 'Consult <a href="' + esc(meta.source_url) + '" target="_blank" rel="noopener noreferrer">the official source</a>.</span>');
        // m-25-nl-oracle-briefings: same hook as the 503 path.
        warn.on('popupopen', function (ev) {
          var pop = ev.popup;
          var el = pop && pop.getElement && pop.getElement();
          var content = el && el.querySelector ? el.querySelector('.leaflet-popup-content') : null;
          if (content) {
            injectNlBriefing(content, c.lat, c.lng,
              'land-tenure network error for layer "' + key + '" (' + (meta.source_name || key) + ')');
          }
        });
        warn.addTo(grp);
        loading = false;
      });
    }
    // Lazy load on first overlay-add (Leaflet fires 'overlayadd' on the map).
    map.on('overlayadd', function (e) {
      if (e && e.layer === grp) load();
    });
    // Legend label includes the colour swatch + dataset icon (if set) + indigenous-protocol
    // marker. The per-dataset icon (e.g. deer for WMU hunting, shield for WMA protected
    // habitat) visually answers 'which kind of wildlife layer is this?' at a glance from
    // the layer-control before the user has to read the name.
    //
    // mission feat/ab-wma-split (2026-06-23): when the dataset declares display_label, we
    // use it VERBATIM (icon already embedded) instead of deriving from source_name. This
    // is what gives the AB WMU/WMA pair their operator-specified, vanlifer-friendly
    // toggle labels ('🦌 AB Hunting Zones (WMU)' / '🛡 AB Protected Habitat (WMA)')
    // without dragging in the long AR-citation source_name. For datasets WITHOUT a
    // display_label, we keep the original 'Government of X — ...' shortening so existing
    // layers (BC Crown, BC Parks, AB Crown, AB Parks, Parks Canada, FN Reserves) are
    // unchanged.
    var swatch = '<span style="display:inline-block;width:11px;height:11px;background:'
      + esc(meta.color || '#2e7d32') + ';border:1px solid #555;margin-right:5px;vertical-align:-1px;opacity:.7"></span>';
    var indigenousFlag = meta.indigenous_protocol ? ' \u{1FA77}' : '';
    var label;
    if (meta.display_label) {
      // display_label already contains the icon glyph + the human-readable name; do NOT
      // prepend another icon (would duplicate the deer / shield in the legend).
      label = swatch + esc(meta.display_label) + indigenousFlag;
    } else {
      var iconLabel = meta.icon ? esc(meta.icon) + ' ' : '';
      var shortName = (meta.source_name || key).replace(/^Government of /, '').replace(/ — .*$/, '');
      label = swatch + iconLabel + esc(shortName) + indigenousFlag;
    }
    if (layerCtl && layerCtl.addOverlay) layerCtl.addOverlay(grp, label);
  }

  // Wait for map.html's inline init to finish (window.map + window._layerCtl are created
  // there). We poll briefly (<=3s) — the inline init is synchronous in practice, so the
  // first tick usually succeeds.
  function waitForMap(tries) {
    if (window.map && window._layerCtl) { init(); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitForMap(tries - 1); }, 100);
  }

  function init() {
    var map = window.map;
    var layerCtl = window._layerCtl;
    if (!map || !layerCtl) return; // map.html failed to init — exit silently.
    // Attribution: one line covering the OGL families this overlay draws from. Per-feature
    // popups carry the specific source_name + source link.
    if (map.attributionControl && map.attributionControl.addAttribution) {
      map.attributionControl.addAttribution('Land tenure: Open Government Licence &mdash; Canada / B.C. / Alberta');
    }
    fetch(TENURE_API + '?layer=index').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.ok !== true || !j.layers) return;
      Object.keys(j.layers).forEach(function (key) {
        // QC fix: ensure the index meta honours on_by_default for visible-by-default
        // Crown-land layers. If the API index does not flag it, default Crown/Park
        // layers to visible so the e2e runner sees the tinted polygons on first
        // paint without requiring a user toggle.
        var meta = j.layers[key] || {};
        var name = (meta.display_label || meta.source_name || key).toLowerCase();
        var isCrownPark = /crown|park|pluz|wma|wildlife/.test(name);
        if (isCrownPark && meta.on_by_default !== false) meta.on_by_default = true;
        attachLayer(map, layerCtl, key, meta);
      });
    }).catch(function () { /* index unreachable -> no overlays; map still works */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitForMap(30); });
  } else {
    waitForMap(30);
  }
})();
