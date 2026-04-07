import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../services/api";

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } })
};

function SortablePlayer({ id, player, captainId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined
  };

  const isCap = captainId && String(player._id) === String(captainId);

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        ...style,
        px: 1.5,
        py: 1,
        mb: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        cursor: "grab",
        opacity: isDragging ? 0.45 : 1,
        bgcolor: "background.paper",
        touchAction: "none"
      }}
    >
      <Box {...attributes} {...listeners} sx={{ display: "flex", color: "text.secondary" }} aria-label="Drag handle">
        <DragIndicatorRoundedIcon fontSize="small" />
      </Box>
      <Box flex={1}>
        <Typography fontWeight={600}>{player.name}</Typography>
        {isCap && (
          <Typography variant="caption" color="secondary">
            Captain — stays on this team
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function TeamColumn({ teamId, title, captain, playerIds, playerMap, caption }) {
  const { setNodeRef, isOver } = useDroppable({ id: teamId });

  return (
    <Box flex={1} minWidth={0}>
      <Typography fontWeight={700} color="primary.main" gutterBottom>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        Captain: {captain?.name || "—"}
      </Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {caption}
        </Typography>
      )}
      <SortableContext items={playerIds} strategy={verticalListSortingStrategy}>
        <Box
          ref={setNodeRef}
          sx={{
            minHeight: 120,
            p: 1,
            borderRadius: 2,
            border: "2px dashed",
            borderColor: isOver ? "primary.main" : "divider",
            bgcolor: isOver ? "action.hover" : "grey.50",
            transition: "border-color 0.15s, background 0.15s"
          }}
        >
          {playerIds.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              Drop players here
            </Typography>
          ) : (
            playerIds.map((pid) => {
              const p = playerMap.get(pid);
              if (!p) return null;
              const capId = captain?._id || captain;
              return <SortablePlayer key={pid} id={pid} player={p} captainId={capId} />;
            })
          )}
        </Box>
      </SortableContext>
    </Box>
  );
}

function findContainer(squads, id) {
  if (id === "teamA" || id === "teamB") return id;
  if (squads.teamA.includes(id)) return "teamA";
  if (squads.teamB.includes(id)) return "teamB";
  return null;
}

export default function SquadBoard({ matchId, displayMatch, canEdit, onSaved }) {
  const capA = displayMatch?.teams?.teamA?.captain;
  const capB = displayMatch?.teams?.teamB?.captain;

  const initialSquads = useMemo(() => {
    const a = (displayMatch?.teams?.teamA?.players || []).map((p) => String(p._id));
    const b = (displayMatch?.teams?.teamB?.players || []).map((p) => String(p._id));
    return { teamA: a, teamB: b };
  }, [displayMatch?.teams?.teamA?.players, displayMatch?.teams?.teamB?.players]);

  const [squads, setSquads] = useState(initialSquads);
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSquads(initialSquads);
  }, [initialSquads]);

  const playerMap = useMemo(() => {
    const m = new Map();
    [...(displayMatch?.teams?.teamA?.players || []), ...(displayMatch?.teams?.teamB?.players || [])].forEach((p) => {
      m.set(String(p._id), p);
    });
    return m;
  }, [displayMatch?.teams?.teamA?.players, displayMatch?.teams?.teamB?.players]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const persist = useCallback(
    async (nextTeams) => {
      setSaving(true);
      const rollback = () =>
        setSquads({
          teamA: (displayMatch?.teams?.teamA?.players || []).map((p) => String(p._id)),
          teamB: (displayMatch?.teams?.teamB?.players || []).map((p) => String(p._id))
        });
      try {
        await api.patch(`/matches/${matchId}/teams/players`, {
          teamAPlayerIds: nextTeams.teamA,
          teamBPlayerIds: nextTeams.teamB
        });
        onSaved?.(null);
      } catch (e) {
        rollback();
        onSaved?.(e);
      } finally {
        setSaving(false);
      }
    },
    [matchId, onSaved, displayMatch]
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !canEdit) return;

    const activePid = String(active.id);
    const capAid = capA?._id || capA;
    const capBid = capB?._id || capB;
    if (capAid && activePid === String(capAid)) {
      const dest = findContainer(squads, over.id);
      if (dest && dest !== "teamA") return;
    }
    if (capBid && activePid === String(capBid)) {
      const dest = findContainer(squads, over.id);
      if (dest && dest !== "teamB") return;
    }

    const activeContainer = findContainer(squads, active.id);
    let overContainer = findContainer(squads, over.id);
    if (!overContainer && (over.id === "teamA" || over.id === "teamB")) {
      overContainer = over.id;
    }
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const list = squads[activeContainer];
      const oldIndex = list.indexOf(activePid);
      if (oldIndex < 0) return;
      let newIndex;
      if (over.id === activeContainer) {
        newIndex = list.length - 1;
      } else {
        newIndex = list.indexOf(String(over.id));
      }
      if (newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(list, oldIndex, newIndex);
      const next = { ...squads, [activeContainer]: reordered };
      setSquads(next);
      void persist(next);
      return;
    }

    // Cross-container move
    const nextA = [...squads.teamA];
    const nextB = [...squads.teamB];
    const fromList = activeContainer === "teamA" ? nextA : nextB;
    const toList = overContainer === "teamA" ? nextA : nextB;
    const fromIdx = fromList.indexOf(activePid);
    if (fromIdx === -1) return;
    fromList.splice(fromIdx, 1);

    let insertAt = toList.length;
    if (over.id !== "teamA" && over.id !== "teamB") {
      const overIdx = toList.indexOf(String(over.id));
      if (overIdx >= 0) insertAt = overIdx;
    }

    if (capAid && activePid === String(capAid) && overContainer !== "teamA") return;
    if (capBid && activePid === String(capBid) && overContainer !== "teamB") return;

    toList.splice(insertAt, 0, activePid);
    const next = { teamA: nextA, teamB: nextB };
    setSquads(next);
    void persist(next);
  }

  const activePlayer = activeId ? playerMap.get(String(activeId)) : null;

  if (!canEdit) {
    return (
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <TeamColumnReadOnly title={displayMatch.teams.teamA.name} captain={capA} players={displayMatch.teams.teamA.players} />
        <TeamColumnReadOnly title={displayMatch.teams.teamB.name} captain={capB} players={displayMatch.teams.teamB.players} />
      </Stack>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ opacity: saving ? 0.7 : 1 }}>
        <TeamColumn
          teamId="teamA"
          title={displayMatch.teams.teamA.name || "Team A"}
          captain={capA}
          playerIds={squads.teamA}
          playerMap={playerMap}
          caption={saving ? "Saving…" : "Drag cards to reorder or move to the other team."}
        />
        <TeamColumn
          teamId="teamB"
          title={displayMatch.teams.teamB.name || "Team B"}
          captain={capB}
          playerIds={squads.teamB}
          playerMap={playerMap}
          caption={saving ? "Saving…" : "Drop here from the other squad."}
        />
      </Stack>
      <DragOverlay dropAnimation={dropAnimation}>
        {activePlayer ? (
          <Paper variant="outlined" sx={{ px: 1.5, py: 1, boxShadow: 4 }}>
            <Typography fontWeight={700}>{activePlayer.name}</Typography>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TeamColumnReadOnly({ title, captain, players }) {
  return (
    <Box flex={1}>
      <Typography fontWeight={700} color="primary.main" gutterBottom>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        Captain: {captain?.name || "—"}
      </Typography>
      <Stack spacing={1}>
        {(players || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No players yet.
          </Typography>
        ) : (
          (players || []).map((p) => (
            <Paper key={p._id} variant="outlined" sx={{ px: 1.5, py: 1 }}>
              <Typography fontWeight={600}>{p.name}</Typography>
              {captain && String(p._id) === String(captain._id || captain) && (
                <Chip size="small" label="Captain" sx={{ mt: 0.5 }} />
              )}
            </Paper>
          ))
        )}
      </Stack>
    </Box>
  );
}
