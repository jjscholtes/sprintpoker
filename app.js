import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const CONFIG_ENDPOINTS = ["/config.json", "/api/config"];

const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const SERVER_TIME_SYNC_MS = 5 * 60 * 1000;
const CARD_VALUES = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "?",
  "☕"
];
const DEADLOCK_GAP_THRESHOLD = 8;
const DEADLOCK_MIN_SHARE = 0.4;
const DEVILS_ADVOCATE_DURATION_SEC = 60;

const els = {
  landing: document.getElementById("landing"),
  session: document.getElementById("session"),
  createSession: document.getElementById("create-session"),
  sessionId: document.getElementById("session-id"),
  copyLink: document.getElementById("copy-link"),
  expired: document.getElementById("expired"),
  expiredCreate: document.getElementById("expired-create"),
  join: document.getElementById("join"),
  joinForm: document.getElementById("join-form"),
  nameInput: document.getElementById("name-input"),
  emojiPickerBtn: document.getElementById("emoji-picker-btn"),
  emojiPicker: document.getElementById("emoji-picker"),
  emojiGrid: document.querySelector(".emoji-grid"),
  table: document.getElementById("table"),
  status: document.getElementById("status"),
  average: document.getElementById("average"),
  participants: document.getElementById("participants"),
  cardSection: document.querySelector(".card-section"),
  cardGrid: document.getElementById("card-grid"),
  revealBtn: document.getElementById("reveal-btn"),
  resetBtn: document.getElementById("reset-btn"),
  timerToggle: document.getElementById("timer-toggle"),
  timerDuration: document.getElementById("timer-duration"),
  timerDisplay: document.getElementById("timer-display"),
  timerCircle: document.getElementById("timer-circle"),
  timerProgress: document.getElementById("timer-progress"),
  timerText: document.getElementById("timer-text"),
  devilsAdvocate: document.getElementById("devils-advocate"),
  devilsAdvocateMessage: document.getElementById("devils-advocate-message"),
  devilsAdvocateTime: document.getElementById("devils-advocate-time"),
  error: document.getElementById("global-error")
};

// Available emojis for avatar selection
const AVATAR_EMOJIS = [
  "😀", "😎", "🤓", "🥳", "🤩", "😇", "🤠", "🥸",
  "👨‍💻", "👩‍💻", "🧑‍💼", "👨‍🔧", "👩‍🎨", "🧙", "🦸", "🦹",
  "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐸", "🐵",
  "🚀", "⭐", "🔥", "💡", "💎", "🎯", "🎲", "🃏"
];

// Avatar color palette for participants (used as fallback)
const AVATAR_COLORS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)"
];

const state = {
  sessionId: null,
  participantId: null,
  name: null,
  selectedEmoji: "🚀",
  session: null,
  votes: new Map(),
  participants: [],
  channel: null,
  revealed: false,
  serverOffsetMs: 0,
  lastServerSyncAt: 0,
  timerIntervalId: null,
  timerEndsAt: null,
  devilsAdvocateTimerId: null,
  devilsAdvocateEndsAt: null
};

let supabase = null;

void init();

async function init() {
  wireEvents();
  buildCardGrid();
  buildEmojiPicker();

  const config = await loadConfig();
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    showError(
      "Supabase config ontbreekt. Vul SUPABASE_URL en SUPABASE_ANON_KEY in config.json of in Vercel Environment Variables."
    );
    return;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  void syncServerTime();

  const path = window.location.pathname;
  if (path.startsWith("/s/")) {
    const parts = path.split("/").filter(Boolean);
    state.sessionId = parts[1];
    showSessionView();
    void loadSession(state.sessionId);
  } else {
    showLandingView();
  }
}

async function loadConfig() {
  if (
    window.APP_CONFIG?.SUPABASE_URL &&
    window.APP_CONFIG?.SUPABASE_ANON_KEY
  ) {
    return window.APP_CONFIG;
  }

  for (const endpoint of CONFIG_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (data?.SUPABASE_URL && data?.SUPABASE_ANON_KEY) {
        return data;
      }
    } catch (error) {
      // Ignore and try the next endpoint.
    }
  }

  return null;
}

function wireEvents() {
  els.createSession.addEventListener("click", async () => {
    clearError();
    await createSession();
  });

  els.copyLink.addEventListener("click", async () => {
    const link = window.location.href;
    const copied = await copyToClipboard(link);
    if (copied) {
      els.copyLink.textContent = "Gekopieerd";
      setTimeout(() => {
        els.copyLink.textContent = "Kopieer link";
      }, 1600);
    } else {
      showError(
        "Kopieren mislukt. De link is geselecteerd—kopieer met Ctrl/Cmd+C."
      );
    }
  });

  els.expiredCreate.addEventListener("click", async () => {
    window.location.href = "/";
  });

  els.joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const name = els.nameInput.value.trim();
    if (!name) {
      showError("Vul je naam in om mee te doen.");
      return;
    }
    localStorage.setItem(`sp_name_${state.sessionId}`, name);
    localStorage.setItem(`sp_emoji_${state.sessionId}`, state.selectedEmoji);
    await joinSession(name);
  });

  els.revealBtn.addEventListener("click", async () => {
    clearError();
    if (!(await ensureActiveSession())) {
      return;
    }
    if (state.session?.devils_advocate_active) {
      showError("Wacht tot de Devil's Advocate timer voorbij is.");
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({ revealed: true, last_activity_at: now })
      .eq("id", state.sessionId);
    if (error) {
      showError("Reveal mislukt.");
      return;
    }
    const refreshed = await refreshVotes();
    if (refreshed) {
      await evaluateDeadlockAfterReveal();
    }
  });

  els.resetBtn.addEventListener("click", async () => {
    clearError();
    if (!(await ensureActiveSession())) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("session_id", state.sessionId);
    if (deleteError && !isMissingTableError(deleteError, "votes")) {
      console.error("Votes delete failed:", deleteError);
      showError(getVotesErrorMessage(deleteError, "Nieuwe ronde mislukt."));
      return;
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        revealed: false,
        last_activity_at: now,
        devils_advocate_active: false,
        devils_advocate_participant_id: null,
        devils_advocate_name: null,
        devils_advocate_value: null,
        devils_advocate_side: null,
        devils_advocate_started_at: null,
        devils_advocate_duration_sec: null,
        deadlock_count: 0
      })
      .eq("id", state.sessionId);
    if (updateError) {
      console.error("Session reset failed:", updateError);
      showError("Nieuwe ronde mislukt.");
      return;
    }
    clearVotesState(false);
  });

  if (els.timerToggle) {
    els.timerToggle.addEventListener("click", () => {
      toggleTimer();
    });
  }

  if (els.timerDuration) {
    els.timerDuration.addEventListener("change", () => {
      if (!state.timerIntervalId) {
        setTimerDisplay(getSelectedDuration());
      }
    });
  }
}

async function createSession() {
  const sessionId = generateId();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sessions")
    .insert({ id: sessionId, revealed: false, last_activity_at: now });

  if (error) {
    showError("Sessie aanmaken mislukt.");
    return;
  }

  window.location.href = `/s/${sessionId}`;
}

async function loadSession(sessionId) {
  await syncServerTime();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    showError("Sessie niet gevonden. Maak een nieuwe sessie aan.");
    setExpiredState(true);
    return;
  }

  state.session = data;
  state.revealed = data.revealed;
  els.sessionId.textContent = sessionId;

  const storedName = localStorage.getItem(`sp_name_${sessionId}`) || "";
  els.nameInput.value = storedName;
  const storedEmoji = localStorage.getItem(`sp_emoji_${sessionId}`);
  if (storedEmoji) {
    state.selectedEmoji = storedEmoji;
    if (els.emojiPickerBtn) {
      els.emojiPickerBtn.textContent = storedEmoji;
    }
  }

  if (isExpired(data.last_activity_at)) {
    setExpiredState(true);
    return;
  }

  setExpiredState(false);
  showJoin();
}

async function joinSession(name) {
  if (!(await ensureActiveSession())) {
    return;
  }

  state.name = name;
  state.participantId = getOrCreateParticipantId();

  await touchSession();

  if (state.channel) {
    await state.channel.unsubscribe();
  }

  state.channel = supabase.channel(`session:${state.sessionId}`, {
    config: {
      presence: {
        key: state.participantId
      }
    }
  });

  state.channel
    .on("presence", { event: "sync" }, () => {
      updatePresence();
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "votes",
        filter: `session_id=eq.${state.sessionId}`
      },
      () => {
        void refreshVotes();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${state.sessionId}`
      },
      (payload) => {
        const wasRevealed = state.revealed;
        state.session = payload.new ?? state.session;
        state.revealed = state.session?.revealed ?? false;
        if (wasRevealed && !state.revealed) {
          clearVotesState(false);
          return;
        }
        if (!wasRevealed && state.revealed) {
          void refreshVotes().then((refreshed) => {
            if (refreshed) {
              void evaluateDeadlockAfterReveal();
            }
          });
        }
        render();
      }
    );

  state.channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      clearError();
      void state.channel.track({
        id: state.participantId,
        name: state.name,
        emoji: state.selectedEmoji
      });
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      showError("Realtime verbinding mislukt.");
    }
  });

  await refreshVotes();
  showTable();
}

function updatePresence() {
  if (!state.channel) {
    return;
  }
  const presenceState = state.channel.presenceState();
  const participants = [];
  Object.values(presenceState).forEach((entries) => {
    if (entries.length > 0) {
      participants.push(entries[entries.length - 1]);
    }
  });
  state.participants = participants;
  renderParticipants();
  renderStatus();
}

async function refreshVotes() {
  const { data, error } = await supabase
    .from("votes")
    .select("participant_id,value")
    .eq("session_id", state.sessionId);
  if (error) {
    console.error("Votes fetch failed:", error);
    showError("Votes ophalen mislukt.");
    return false;
  }
  state.votes = new Map(data.map((vote) => [vote.participant_id, vote.value]));
  render();
  return true;
}

function buildCardGrid() {
  els.cardGrid.innerHTML = "";
  CARD_VALUES.forEach((value, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-button";
    button.textContent = value;
    button.style.setProperty("--i", index);
    button.addEventListener("click", async () => {
      clearError();
      if (!(await ensureActiveSession())) {
        return;
      }
      handleCardSelection(value, button);
    });
    els.cardGrid.appendChild(button);
  });
}

function buildEmojiPicker() {
  if (!els.emojiGrid || !els.emojiPickerBtn || !els.emojiPicker) {
    return;
  }

  els.emojiGrid.innerHTML = "";
  AVATAR_EMOJIS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.textContent = emoji;
    button.addEventListener("click", () => {
      state.selectedEmoji = emoji;
      els.emojiPickerBtn.textContent = emoji;
      if (state.sessionId) {
        localStorage.setItem(`sp_emoji_${state.sessionId}`, emoji);
      }
      els.emojiPicker.classList.add("hidden");
    });
    els.emojiGrid.appendChild(button);
  });

  // Toggle emoji picker on button click
  els.emojiPickerBtn.addEventListener("click", () => {
    els.emojiPicker.classList.toggle("hidden");
  });

  // Close picker when clicking outside
  document.addEventListener("click", (e) => {
    if (!els.emojiPicker.contains(e.target) && e.target !== els.emojiPickerBtn) {
      els.emojiPicker.classList.add("hidden");
    }
  });
}

async function handleCardSelection(value) {
  renderCards();
  await submitVote(value);
}

async function submitVote(value) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("votes").upsert(
    {
      session_id: state.sessionId,
      participant_id: state.participantId,
      value
    },
    { onConflict: "session_id,participant_id" }
  );

  if (error) {
    console.error("Vote upsert failed:", error);
    showError("Stemmen mislukt.");
    return false;
  }

  await supabase
    .from("sessions")
    .update({ last_activity_at: now })
    .eq("id", state.sessionId);

  return true;
}

async function touchSession() {
  const now = new Date().toISOString();
  await supabase
    .from("sessions")
    .update({ last_activity_at: now })
    .eq("id", state.sessionId);
}

function render() {
  renderParticipants();
  renderStatus();
  renderAverage();
  renderCards();
  renderDevilsAdvocate();
}

function clearVotesState(nextRevealed) {
  state.votes = new Map();
  if (typeof nextRevealed === "boolean") {
    state.revealed = nextRevealed;
  }
  render();
}

function renderParticipants() {
  if (!els.participants) {
    return;
  }

  const nameCounts = {};
  state.participants.forEach((participant) => {
    const key = participant.name || "Onbekend";
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });

  const nameInstances = {};
  els.participants.innerHTML = "";

  if (state.participants.length === 0) {
    const empty = document.createElement("li");
    empty.className = "participant";
    empty.innerHTML = `
      <div class="card not-voted"></div>
      <div class="avatar" style="background: #e2e8f0; color: #64748b;">?</div>
      <span class="name">Wachten...</span>
    `;
    els.participants.appendChild(empty);
    return;
  }

  state.participants.forEach((participant, index) => {
    const name = participant.name || "Onbekend";
    nameInstances[name] = (nameInstances[name] || 0) + 1;
    const suffix = nameCounts[name] > 1 ? ` (${nameInstances[name]})` : "";
    const displayName = `${name}${suffix}`;
    const li = document.createElement("li");
    li.className = "participant";
    if (participant.id === state.participantId) {
      li.classList.add("me");
    }

    const voteValue = state.votes.get(participant.id);
    const hasVoted = voteValue !== undefined;

    // Get initials for avatar
    const initials = name
      .split(" ")
      .map((chunk) => chunk[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const emoji = typeof participant.emoji === "string" ? participant.emoji.trim() : "";
    const avatarContent = emoji || initials;
    const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const avatarClass = emoji ? "avatar emoji" : "avatar";

    // Determine card state
    let cardClass = "card ";
    let cardContent = "";
    if (state.revealed && hasVoted) {
      cardClass += "revealed";
      cardContent = voteValue;
    } else if (hasVoted) {
      cardClass += "voted-hidden";
      cardContent = "";
    } else {
      cardClass += "not-voted";
      cardContent = "";
    }

    li.innerHTML = `
      <div class="${cardClass}">${cardContent}</div>
      <div class="${avatarClass}" style="background: ${avatarColor}">${avatarContent}</div>
      <span class="name">${displayName}</span>
    `;

    // Keep the old vote span for compatibility
    const voteEl = document.createElement("span");
    voteEl.className = "vote";
    voteEl.style.display = "none";
    li.appendChild(voteEl);

    els.participants.appendChild(li);
  });
}

function renderStatus() {
  const total = state.participants.length;
  const voted = state.participants.filter((p) => state.votes.has(p.id)).length;
  const revealLabel = state.revealed ? "Onthuld" : "Verborgen";
  els.status.textContent = `${total} deelnemers, ${voted} gestemd · ${revealLabel}`;

  const devilsActive = Boolean(state.session?.devils_advocate_active);
  els.revealBtn.disabled = devilsActive || voted === 0 || state.revealed;
  els.resetBtn.disabled = voted === 0 && !state.revealed;
}

function renderAverage() {
  if (!state.revealed) {
    els.average.textContent = "-";
    return;
  }
  const numericVotes = [...state.votes.values()]
    .map((value) => Number.parseFloat(value))
    .filter((value) => !Number.isNaN(value));
  if (numericVotes.length === 0) {
    els.average.textContent = "N/A";
    return;
  }
  const sum = numericVotes.reduce((acc, value) => acc + value, 0);
  const avg = sum / numericVotes.length;
  const display = Number.isInteger(avg) ? avg.toString() : avg.toFixed(1);
  els.average.textContent = display;
}

function renderCards() {
  const myVote = state.votes.get(state.participantId);
  const disabled =
    !state.participantId ||
    isExpired(state.session?.last_activity_at) ||
    state.session?.devils_advocate_active;
  const buttons = els.cardGrid.querySelectorAll(".card-button");
  buttons.forEach((button) => {
    button.classList.toggle("selected", button.textContent === myVote);
    button.disabled = disabled;
  });
}

function detectDeadlock(votesMap) {
  const numericVotes = [];
  votesMap.forEach((value) => {
    const numeric = Number.parseFloat(value);
    if (!Number.isNaN(numeric)) {
      numericVotes.push(numeric);
    }
  });

  if (numericVotes.length < 2) {
    return { isDeadlock: false };
  }

  const min = Math.min(...numericVotes);
  const max = Math.max(...numericVotes);
  if (min === max || max - min < DEADLOCK_GAP_THRESHOLD) {
    return { isDeadlock: false };
  }

  const total = numericVotes.length;
  const minCount = numericVotes.filter((value) => value === min).length;
  const maxCount = numericVotes.filter((value) => value === max).length;
  if (minCount / total < DEADLOCK_MIN_SHARE || maxCount / total < DEADLOCK_MIN_SHARE) {
    return { isDeadlock: false };
  }

  return { isDeadlock: true, min, max };
}

async function evaluateDeadlockAfterReveal() {
  if (state.session?.devils_advocate_active) {
    return;
  }
  const deadlock = detectDeadlock(state.votes);
  const currentCount = Number(state.session?.deadlock_count) || 0;

  if (!deadlock.isDeadlock) {
    if (currentCount !== 0) {
      await updateDeadlockCount(0);
    }
    return;
  }

  const nextCount = Math.min(2, currentCount + 1);
  if (nextCount < 2) {
    await updateDeadlockCount(nextCount);
    return;
  }

  await triggerDevilsAdvocate(deadlock);
}

async function updateDeadlockCount(count) {
  const { error } = await supabase
    .from("sessions")
    .update({ deadlock_count: count })
    .eq("id", state.sessionId);
  if (!error && state.session) {
    state.session.deadlock_count = count;
  }
}

async function triggerDevilsAdvocate(deadlock) {
  const candidate = pickAdvocateCandidate();
  if (!candidate) {
    await updateDeadlockCount(1);
    return;
  }

  const side = Math.random() < 0.5 ? "low" : "high";
  const value = side === "low" ? deadlock.min : deadlock.max;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      devils_advocate_active: true,
      devils_advocate_participant_id: candidate.id,
      devils_advocate_name: candidate.name || "Onbekend",
      devils_advocate_value: value.toString(),
      devils_advocate_side: side,
      devils_advocate_started_at: now,
      devils_advocate_duration_sec: DEVILS_ADVOCATE_DURATION_SEC,
      deadlock_count: 0,
      last_activity_at: now
    })
    .eq("id", state.sessionId)
    .eq("devils_advocate_active", false)
    .select();

  if (error) {
    showError("Devil's Advocate starten mislukt.");
    return;
  }

  if (!data || data.length === 0) {
    return;
  }
}

function pickAdvocateCandidate() {
  const voters = state.participants.filter((participant) =>
    state.votes.has(participant.id)
  );
  if (voters.length === 0) {
    return null;
  }
  const index = randomIndex(voters.length);
  return voters[index];
}

function renderDevilsAdvocate() {
  if (!els.devilsAdvocate || !els.devilsAdvocateMessage || !els.devilsAdvocateTime) {
    return;
  }

  const active = Boolean(state.session?.devils_advocate_active);
  els.devilsAdvocate.classList.toggle("hidden", !active);

  if (!active) {
    stopDevilsAdvocateTimer();
    return;
  }

  hideConfidencePopover();

  const name = state.session?.devils_advocate_name || "Iemand";
  const value = state.session?.devils_advocate_value || "?";
  const side = state.session?.devils_advocate_side || "low";
  const isYou = state.session?.devils_advocate_participant_id === state.participantId;
  const prompt =
    side === "high"
      ? "Vertel ons waarom dit project ons hele weekend gaat kosten."
      : "Vertel ons waarom dit eigenlijk heel simpel is.";
  const subject = isYou ? "Jij bent" : `${name} is`;
  els.devilsAdvocateMessage.textContent = `${subject} nu de advocaat van de ${value}. ${prompt}`;

  ensureDevilsAdvocateTimer();
}

function ensureDevilsAdvocateTimer() {
  if (!state.session?.devils_advocate_started_at) {
    return;
  }
  const duration =
    Number(state.session?.devils_advocate_duration_sec) || DEVILS_ADVOCATE_DURATION_SEC;
  const startMs = new Date(state.session.devils_advocate_started_at).getTime();
  if (Number.isNaN(startMs)) {
    return;
  }
  const endsAt = startMs + duration * 1000;
  if (state.devilsAdvocateEndsAt !== endsAt) {
    state.devilsAdvocateEndsAt = endsAt;
    if (state.devilsAdvocateTimerId) {
      window.clearInterval(state.devilsAdvocateTimerId);
    }
    state.devilsAdvocateTimerId = window.setInterval(() => {
      updateDevilsAdvocateTimer();
    }, 250);
  }
  updateDevilsAdvocateTimer();
}

function updateDevilsAdvocateTimer() {
  if (!state.devilsAdvocateEndsAt || !els.devilsAdvocateTime) {
    return;
  }
  const remainingMs = state.devilsAdvocateEndsAt - getNowMs();
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  els.devilsAdvocateTime.textContent = formatSeconds(remainingSec);
  if (remainingSec <= 0) {
    stopDevilsAdvocateTimer();
    void endDevilsAdvocateRound();
  }
}

function stopDevilsAdvocateTimer() {
  if (state.devilsAdvocateTimerId) {
    window.clearInterval(state.devilsAdvocateTimerId);
  }
  state.devilsAdvocateTimerId = null;
  state.devilsAdvocateEndsAt = null;
}

async function endDevilsAdvocateRound() {
  if (!state.session?.devils_advocate_active) {
    return;
  }
  const now = new Date().toISOString();
  await supabase.from("votes").delete().eq("session_id", state.sessionId);
  await supabase
    .from("sessions")
    .update({
      revealed: false,
      last_activity_at: now,
      devils_advocate_active: false,
      devils_advocate_participant_id: null,
      devils_advocate_name: null,
      devils_advocate_value: null,
      devils_advocate_side: null,
      devils_advocate_started_at: null,
      devils_advocate_duration_sec: null,
      deadlock_count: 0
    })
    .eq("id", state.sessionId)
    .eq("devils_advocate_active", true);
}

async function ensureActiveSession() {
  await syncServerTime();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", state.sessionId)
    .maybeSingle();

  if (error || !data) {
    showError("Sessie niet gevonden.");
    setExpiredState(true);
    return false;
  }

  state.session = data;
  state.revealed = data.revealed;

  if (isExpired(data.last_activity_at)) {
    setExpiredState(true);
    return false;
  }

  setExpiredState(false);
  return true;
}

function isExpired(lastActivity) {
  if (!lastActivity) {
    return false;
  }
  const last = new Date(lastActivity).getTime();
  if (Number.isNaN(last)) {
    return false;
  }
  return getNowMs() - last > SESSION_TTL_MS;
}

function showLandingView() {
  els.landing.classList.remove("hidden");
  els.session.classList.add("hidden");
}

function showSessionView() {
  els.landing.classList.add("hidden");
  els.session.classList.remove("hidden");
}

function showJoin() {
  els.join.classList.remove("hidden");
  els.table.classList.add("hidden");
}

function showTable() {
  els.join.classList.add("hidden");
  els.table.classList.remove("hidden");
  render();
  if (!state.timerIntervalId) {
    setTimerDisplay(getSelectedDuration());
  }
}

function setExpiredState(expired) {
  if (expired) {
    els.expired.classList.remove("hidden");
    els.join.classList.add("hidden");
    els.table.classList.add("hidden");
    if (els.devilsAdvocate) {
      els.devilsAdvocate.classList.add("hidden");
    }
    stopDevilsAdvocateTimer();
  } else {
    els.expired.classList.add("hidden");
  }
}

function showError(message) {
  els.error.textContent = message;
  els.error.classList.remove("hidden");
}

function clearError() {
  els.error.textContent = "";
  els.error.classList.add("hidden");
}

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 12)}`;
}

function toggleTimer() {
  if (state.timerIntervalId) {
    stopTimer();
    return;
  }
  startTimer();
}

function startTimer() {
  const duration = getSelectedDuration();
  if (!duration) {
    return;
  }
  state.timerEndsAt = Date.now() + duration * 1000;
  state.timerDuration = duration;
  setTimerDisplay(duration, duration);
  updateTimerLabel(true);
  showCircularTimer(true);

  state.timerIntervalId = window.setInterval(() => {
    const remaining = Math.max(
      0,
      Math.ceil((state.timerEndsAt - Date.now()) / 1000)
    );
    setTimerDisplay(remaining, state.timerDuration);
    if (remaining <= 0) {
      stopTimer();
    }
  }, 100);
}

function stopTimer() {
  if (state.timerIntervalId) {
    window.clearInterval(state.timerIntervalId);
  }
  state.timerIntervalId = null;
  state.timerEndsAt = null;
  updateTimerLabel(false);
  showCircularTimer(false);
  setTimerDisplay(getSelectedDuration(), getSelectedDuration());
}

function showCircularTimer(active) {
  if (els.timerCircle) {
    els.timerCircle.classList.toggle("active", active);
  }
}

function updateTimerLabel(running) {
  if (!els.timerToggle) {
    return;
  }
  els.timerToggle.textContent = running ? "Stop" : "Start";
}

function getSelectedDuration() {
  if (!els.timerDuration) {
    return 0;
  }
  const value = Number.parseInt(els.timerDuration.value, 10);
  return Number.isNaN(value) ? 0 : value;
}

function setTimerDisplay(seconds, totalDuration) {
  // Update text display in toolbar
  if (els.timerDisplay) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    els.timerDisplay.textContent = `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  // Update circular timer
  if (els.timerProgress && els.timerText && totalDuration > 0) {
    const circumference = 2 * Math.PI * 16; // r=16 from SVG
    const progress = seconds / totalDuration;
    const offset = circumference * (1 - progress);
    els.timerProgress.style.strokeDashoffset = offset;

    // Color: green when > 30%, yellow when 10-30%, red when < 10%
    let color = "#22c55e"; // green
    if (progress < 0.1) {
      color = "#ef4444"; // red
    } else if (progress < 0.3) {
      color = "#f59e0b"; // yellow/orange
    }
    els.timerProgress.style.stroke = color;

    // Update text in circle
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    els.timerText.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function errorText(error) {
  if (!error) {
    return "";
  }
  return [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isMissingTableError(error, table) {
  if (error?.code === "42P01") {
    return true;
  }
  const text = errorText(error);
  return (
    text.includes(`relation "${table}"`) ||
    text.includes(`relation "public.${table}"`) ||
    text.includes(`relation ${table}`) ||
    text.includes(`relation public.${table}`)
  ) && text.includes("does not exist");
}

function randomIndex(max) {
  if (max <= 1) {
    return 0;
  }
  if (crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fall through to manual copy.
    }
  }
  return copyWithSelection(text);
}

function copyWithSelection(text) {
  const input = document.createElement("input");
  input.value = text;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, text.length);

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    success = false;
  }

  if (!success) {
    try {
      window.prompt("Kopieer de link:", text);
      success = true;
    } catch (error) {
      success = false;
    }
  }

  input.remove();
  return success;
}

async function syncServerTime() {
  if (!supabase) {
    return;
  }
  if (Date.now() - state.lastServerSyncAt < SERVER_TIME_SYNC_MS) {
    return;
  }
  const { data, error } = await supabase.rpc("server_time");
  if (error || !data) {
    return;
  }
  const serverMs = new Date(data).getTime();
  if (Number.isNaN(serverMs)) {
    return;
  }
  state.serverOffsetMs = serverMs - Date.now();
  state.lastServerSyncAt = Date.now();
}

function getNowMs() {
  return Date.now() + state.serverOffsetMs;
}

function getOrCreateParticipantId() {
  const key = "sp_participant_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId();
    localStorage.setItem(key, id);
  }
  return id;
}
