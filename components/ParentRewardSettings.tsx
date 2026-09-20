"use client";

import { useEffect, useState } from "react";
import { normalizeRewardSettings, type RewardSettings } from "@/lib/rewards";

type ParentRewardSettingsProps = {
  open: boolean;
  settings: RewardSettings;
  onClose: () => void;
  onSave: (settings: RewardSettings) => void;
};

export function ParentRewardSettings({ open, settings, onClose, onSave }: ParentRewardSettingsProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="reward-settings-title">
        <button className="modal-close" onClick={onClose} aria-label="Close parent settings">×</button>
        <p className="eyebrow">Parent space</p>
        <h2 id="reward-settings-title">A goal worth hopping toward</h2>
        <p className="modal-intro">Choose an optional family reward. Rabbit keeps the message positive and celebrates effort beyond the daily lesson.</p>

        <label className="toggle-row">
          <span><strong>Enable a reward goal</strong><small>Show this goal to your learner</small></span>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          <i aria-hidden="true" />
        </label>

        <div className={`reward-fields ${draft.enabled ? "" : "disabled"}`}>
          <label>
            <span>Points to earn</span>
            <input
              type="number"
              min="50"
              max="10000"
              step="10"
              value={draft.targetPoints}
              disabled={!draft.enabled}
              onChange={(event) => setDraft({ ...draft, targetPoints: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Reward or experience</span>
            <input
              type="text"
              maxLength={80}
              value={draft.present}
              disabled={!draft.enabled}
              placeholder="e.g. Choose Friday's dessert"
              onChange={(event) => setDraft({ ...draft, present: event.target.value })}
            />
          </label>
        </div>

        <div className="parent-note"><span aria-hidden="true">♡</span><p><strong>Keep it encouraging</strong>Rewards are a bonus, never a punishment. Points already earned are never taken away.</p></div>
        <div className="modal-actions">
          <button className="text-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => onSave(normalizeRewardSettings(draft))}>Save goal</button>
        </div>
      </section>
    </div>
  );
}
