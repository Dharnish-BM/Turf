function isLegalBall(extraType) {
  return !["wide", "no-ball"].includes(extraType || "none");
}

function rotateStrike(striker, nonStriker) {
  return { striker: nonStriker, nonStriker: striker };
}

/**
 * Recompute innings totals and positions from ball history + opening lineup.
 * Must mirror POST /matches/:id/score semantics.
 */
export function replayInningsState(match, innMeta, balls) {
  const target = Number(innMeta.target || 0);
  let striker = innMeta.openingStriker;
  let nonStriker = innMeta.openingNonStriker;
  let currentBowler = innMeta.openingBowler;
  let totalRuns = 0;
  let ballsFaced = 0;
  let wickets = 0;
  let nextBatsmanRequired = false;
  const battingTeam = match?.teams?.[innMeta?.battingTeam];
  const maxWickets = battingTeam?.players?.length ? Math.max(battingTeam.players.length - 1, 0) : 10;

  for (const ball of balls) {
    currentBowler = ball.bowler;
    const legal = isLegalBall(ball.extras?.type);
    const batRuns = Number(ball.runs || 0);
    const extraRuns = Number(ball.extras?.runs || 0);
    const totalOnBall = batRuns + extraRuns;

    if (legal) ballsFaced += 1;
    totalRuns += totalOnBall;

    const w = ball.wicket;
    if (w?.isWicket) {
      wickets += 1;
      const outId = w.playerOut ? w.playerOut._id ?? w.playerOut : striker;
      const outPlayer = String(outId);
      const next = ball.nextBatsman ? ball.nextBatsman._id ?? ball.nextBatsman : null;
      const onStrike = ball.onStrikeNext ? ball.onStrikeNext._id ?? ball.onStrikeNext : null;
      if (w.type === "run-out" && next && onStrike) {
        const incomingId = String(next);
        const survivorId =
          String(striker) === outPlayer ? String(nonStriker) : String(nonStriker) === outPlayer ? String(striker) : null;
        const strikeId = String(onStrike);
        if (survivorId && (strikeId === incomingId || strikeId === survivorId)) {
          if (strikeId === incomingId) {
            striker = next;
            nonStriker = survivorId;
          } else {
            striker = survivorId;
            nonStriker = next;
          }
        } else if (String(striker) === outPlayer) {
          striker = next;
        } else if (String(nonStriker) === outPlayer) {
          nonStriker = next;
        } else {
          striker = next ?? striker;
        }
      } else if (String(striker) === outPlayer) {
        striker = next;
      } else if (String(nonStriker) === outPlayer) {
        nonStriker = next;
      } else {
        striker = next ?? striker;
      }
      nextBatsmanRequired = !next;
    } else {
      nextBatsmanRequired = false;
      if (totalOnBall % 2 === 1) {
        ({ striker, nonStriker } = rotateStrike(striker, nonStriker));
      }
    }

    const endOfOver = legal && ballsFaced > 0 && ballsFaced % 6 === 0;
    if (endOfOver) {
      ({ striker, nonStriker } = rotateStrike(striker, nonStriker));
    }
  }

  const allOut = wickets >= maxWickets;
  const oversComplete = ballsFaced >= (match.overs || 10) * 6;
  const chaseDone = target > 0 && totalRuns >= target;
  const isComplete = allOut || oversComplete || chaseDone;

  return {
    totalRuns,
    ballsFaced,
    wickets,
    striker,
    nonStriker,
    currentBowler,
    nextBatsmanRequired,
    isComplete
  };
}
