import { useState } from "react";
import { getAuctionSocket } from "../services/socket";
import { useApp } from "../context/useApp";

function AuctionPanel() {
  const { token, user, selectedMatch, auctionState, auctionError } = useApp();
  const [bidAmount, setBidAmount] = useState(5000);

  const isAdmin = user?.role === "admin";
  const isCaptain = !!user?.isCaptain;
  const canBidNow = isCaptain && selectedMatch && auctionState?.status === "running" && auctionState?.currentPlayer;
  const canStart = isAdmin && selectedMatch && auctionState?.status !== "running";
  const canSell = isAdmin && selectedMatch && auctionState?.status === "running" && auctionState?.currentPlayer;

  function emitStartAuction() {
    getAuctionSocket(token).emit("auction:start", { matchId: selectedMatch });
  }

  function emitBid() {
    getAuctionSocket(token).emit("bid:placed", { matchId: selectedMatch, amount: Number(bidAmount) });
  }

  function emitSold() {
    getAuctionSocket(token).emit("player:sold", { matchId: selectedMatch });
  }

  return (
    <section className="card grid">
      <h2>Live Auction</h2>
      <div className="inline">
        <button disabled={!canStart} onClick={emitStartAuction}>
          Start Auction
        </button>
        <input type="number" min="5000" step="500" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
        <button disabled={!canBidNow} onClick={emitBid}>
          Place Bid
        </button>
        <button disabled={!canSell} onClick={emitSold}>
          Mark Sold
        </button>
      </div>
      {!isCaptain && !isAdmin && <small>Only captains can place bids.</small>}
      {auctionError && <small>{auctionError}</small>}
      <pre>{JSON.stringify(auctionState, null, 2)}</pre>
    </section>
  );
}

export default AuctionPanel;
