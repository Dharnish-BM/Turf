const LEGAL_EXTRA = new Set(["none", "bye", "leg-bye"]);

export function isLegalDelivery(extrasType) {
  return LEGAL_EXTRA.has(extrasType || "none") || extrasType === undefined;
}

export function toOverString(legalBalls) {
  const b = Number(legalBalls) || 0;
  const o = Math.floor(b / 6);
  const r = b % 6;
  return `${o}.${r}`;
}

export function batterStatsFromBalls(balls, playerId) {
  if (!playerId || !balls?.length) return { runs: 0, balls: 0, fours: 0, sixes: 0, sr: 0 };
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  for (const b of balls) {
    const bid = b.batsman?._id ?? b.batsman;
    if (String(bid) !== String(playerId)) continue;
    const ex = b.extras?.type || "none";
    if (!isLegalDelivery(ex)) continue;
    runs += Number(b.runs || 0);
    ballsFaced += 1;
    if (Number(b.runs) === 4) fours += 1;
    if (Number(b.runs) === 6) sixes += 1;
  }
  const sr = ballsFaced ? Math.round((runs / ballsFaced) * 10000) / 100 : 0;
  return { runs, balls: ballsFaced, fours, sixes, sr };
}

export function extrasTotalsFromBalls(balls) {
  let total = 0;
  let wide = 0;
  let noBall = 0;
  for (const b of balls || []) {
    const ex = b.extras?.type || "none";
    const er = Number(b.extras?.runs || 0);
    if (ex === "none") continue;
    total += er;
    if (ex === "wide") wide += er || 1;
    if (ex === "no-ball") noBall += er || 1;
    if (ex === "bye" || ex === "leg-bye") total += er;
  }
  return { total, wide, noBall };
}

export function bowlerAggregatesFromBalls(balls) {
  const map = new Map();
  for (const b of balls || []) {
    const bid = b.bowler?._id ?? b.bowler;
    if (!bid) continue;
    const key = String(bid);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: b.bowler?.name || "—",
        legalBalls: 0,
        runs: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0
      });
    }
    const row = map.get(key);
    const ex = b.extras?.type || "none";
    const batRuns = Number(b.runs || 0);
    const exRuns = Number(b.extras?.runs || 0);
    row.runs += batRuns + exRuns;
    if (b.wicket?.isWicket) row.wickets += 1;
    if (ex === "wide") row.wides += 1;
    if (ex === "no-ball") row.noBalls += 1;
    if (isLegalDelivery(ex)) row.legalBalls += 1;
  }
  return [...map.values()].map((r) => ({
    ...r,
    overs: Math.round((r.legalBalls / 6) * 10) / 10,
    economy: r.legalBalls ? Math.round((r.runs / (r.legalBalls / 6)) * 100) / 100 : 0
  }));
}

export function uniqueBatsmenFromBalls(balls) {
  const ids = [];
  const seen = new Set();
  for (const b of balls || []) {
    const id = b.batsman?._id ?? b.batsman;
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    ids.push(id);
  }
  return ids;
}

export function formatBallShort(b) {
  const ex = b.extras?.type || "none";
  if (b.wicket?.isWicket) {
    const r = Number(b.runs || 0);
    if (ex === "no-ball") {
      const er = Number(b.extras?.runs || 0);
      if (r > 0) return `nb+${r}W`;
      return er > 1 ? `nb+${er - 1}W` : "nbW";
    }
    return r > 0 ? `${r}W` : "W";
  }
  if (ex === "wide") {
    const er = Number(b.extras?.runs || 1);
    return er > 1 ? `wd+${er - 1}` : "wd";
  }
  if (ex === "no-ball") {
    const r = Number(b.runs || 0);
    return r ? `nb+${r}` : "nb";
  }
  return String(b.runs ?? 0);
}

export function recentOversFromBalls(balls) {
  const list = [...(balls || [])];
  const byOver = new Map();
  for (const b of list) {
    const o = Number(b.over ?? 0);
    if (!byOver.has(o)) byOver.set(o, []);
    byOver.get(o).push(b);
  }
  const overs = [...byOver.entries()].sort((a, x) => a[0] - x[0]);
  return overs.map(([overIdx, stack]) => {
    const legalSample = stack.find((b) => isLegalDelivery(b.extras?.type ?? "none"));
    const bowlerName = (legalSample ?? stack[0])?.bowler?.name || "—";
    const runs = stack.reduce((s, b) => s + Number(b.runs || 0) + Number(b.extras?.runs || 0), 0);
    return {
      overNo: overIdx + 1,
      bowler: bowlerName,
      stack: stack.map(formatBallShort),
      runs
    };
  });
}
