"use client";

import { useState, useEffect } from "react";
import { Plus, Users, LogOut } from "lucide-react";
import {
  getAllClans,
  getUserClan,
  createClan,
  joinClan,
  leaveClan,
  getClanLeaderboard,
  type Clan,
} from "@/lib/securities/cybersec/adhd-social-leaderboards";

interface Props {
  userId: string;
  onClanChange?: (clan: Clan | null) => void;
}

export function ClanSelector({ userId, onClanChange }: Props) {
  const [userClan, setUserClan] = useState<Clan | null>(null);
  const [allClans, setAllClans] = useState<Clan[]>([]);
  const [newClanName, setNewClanName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const clan = getUserClan(userId);
    setUserClan(clan);

    const clans = getClanLeaderboard();
    setAllClans(clans);
  }, [userId]);

  const handleCreateClan = () => {
    if (!newClanName.trim()) return;

    const newClan = createClan(newClanName, userId);
    setUserClan(newClan);
    setAllClans(getClanLeaderboard());
    setNewClanName("");
    setShowCreateForm(false);
    onClanChange?.(newClan);
  };

  const handleJoinClan = (clanId: string) => {
    if (joinClan(userId, clanId)) {
      const clan = getAllClans().find((c) => c.id === clanId) || null;
      setUserClan(clan);
      setAllClans(getClanLeaderboard());
      onClanChange?.(clan);
    }
  };

  const handleLeaveClan = () => {
    leaveClan(userId);
    setUserClan(null);
    setAllClans(getClanLeaderboard());
    onClanChange?.(null);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Users size={16} />
          Clans
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 transition-colors flex items-center gap-1"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {/* Create Clan Form */}
      {showCreateForm && (
        <div className="space-y-2 p-3 rounded-lg bg-slate-700/30 border border-cyan-500/20">
          <input
            type="text"
            value={newClanName}
            onChange={(e) => setNewClanName(e.target.value)}
            placeholder="Clan name..."
            className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreateClan()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateClan}
              className="flex-1 px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-semibold transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewClanName("");
              }}
              className="flex-1 px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current Clan */}
      {userClan ? (
        <div
          className="rounded-lg p-3 border-2"
          style={{
            borderColor: userClan.color,
            backgroundColor: `${userClan.color}10`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-100">{userClan.name}</p>
              <p className="text-xs text-slate-400">
                {userClan.members.length} member{userClan.members.length !== 1 ? "s" : ""} •{" "}
                {userClan.totalXp} XP
              </p>
            </div>
            <button
              onClick={handleLeaveClan}
              className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 transition-colors flex items-center gap-1"
            >
              <LogOut size={12} />
              Leave
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">No clan yet</p>
      )}

      {/* Other Clans Leaderboard */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-400 px-1">Leaderboard</p>
        {allClans.slice(0, 5).map((clan, index) => (
          <div
            key={clan.id}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-700/20 border border-slate-700 hover:border-slate-600"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: clan.color }}
              />
              <div>
                <p className="text-xs font-semibold text-slate-200">{clan.name}</p>
                <p className="text-xs text-slate-400">{clan.totalXp} XP</p>
              </div>
            </div>
            {!userClan || userClan.id !== clan.id ? (
              <button
                onClick={() => handleJoinClan(clan.id)}
                className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors"
              >
                Join
              </button>
            ) : (
              <span className="text-xs text-green-400 font-semibold">★</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
