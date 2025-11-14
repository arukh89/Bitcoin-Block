// SpacetimeDB imports
use spacetimedb::{table, reducer, ReducerContext, Table, Timestamp, UniqueColumn};

// Helper: current Unix timestamp in seconds (i64)
fn now_unix_seconds(ctx: &ReducerContext) -> i64 {
    ctx.timestamp.to_micros_since_unix_epoch() / 1_000_000
}

// --- Table Definitions ---

#[table(name = rounds, public)]
#[derive(Clone)]
pub struct Round {
    #[primary_key]
    #[auto_inc]
    round_id: u64,
    round_number: i64,     // Admin-entered display round number
    start_time: i64,       // Unix seconds
    end_time: i64,         // Unix seconds
    duration_minutes: i64, // Admin-entered duration in minutes
    prize: String,
    #[index(btree)]
    status: String,        // "open", "closed", "finished"
    block_number: Option<i64>,  // Target Bitcoin block number
    actual_tx_count: Option<i64>,
    winning_fid: Option<i64>,           // Jackpot (exact) or closest
    second_place_winner_fid: Option<i64>, // Runner-up (second closest)
    block_hash: Option<String>,
    created_at: i64,       // Unix seconds
}

#[table(name = guesses, public)]
#[derive(Clone)]
pub struct Guess {
    #[primary_key]
    #[auto_inc]
    guess_id: u64,
    #[index(btree)]
    round_id: u64,
    #[index(btree)]
    fid: i64,              // Placeholder for address/ID
    username: String,
    guess: i64,
    pfp_url: Option<String>,
    submitted_at: i64,     // Unix seconds
}

#[table(name = logs, public)]
#[derive(Clone)]
pub struct LogEvent {
    #[primary_key]
    #[auto_inc]
    log_id: u64,
    event_type: String,  // e.g., "round_created", "guess_submitted", etc.
    details: String,
    timestamp: i64,      // Unix seconds
}

#[table(name = chat_messages, public)]
#[derive(Clone)]
pub struct ChatMessage {
    #[primary_key]
    #[auto_inc]
    chat_id: u64,
    #[index(btree)]
    round_id: String,    // Can be round ID or "global"
    address: String,     // Address/identifier
    username: String,
    message: String,
    pfp_url: String,
    timestamp: i64,      // Unix seconds
    msg_type: String,    // "guess", "system", "winner", "chat"
}

// PrizeConfig schema (singleton latest config)
#[table(name = prize_config, public)]
#[derive(Clone)]
pub struct PrizeConfig {
    #[primary_key]
    #[auto_inc]
    config_id: u64,
    jackpot_amount: i64,
    first_place_amount: i64,
    second_place_amount: i64,
    currency_type: String,
    token_contract_address: String,
    updated_at: i64,
}

// --- Reducers ---

// Note: SpacetimeDB reducers do not return data. Clients should read results from public tables.
#[reducer]
pub fn create_round(
    ctx: &ReducerContext,
    round_number: i64,
    duration_minutes: i64,
    prize: String,
    block_number: Option<i64>,
) -> Result<(), String> {
    // Basic validation
    if duration_minutes <= 0 {
        return Err("duration_minutes must be greater than 0".into());
    }

    let created_at = now_unix_seconds(ctx);
    let start_time = created_at;
    let end_time = start_time + (duration_minutes * 60);

    let new_round = Round {
        round_id: 0, // auto_inc
        round_number,
        start_time,
        end_time,
        duration_minutes,
        prize: prize.clone(),
        status: "open".to_string(),
        block_number,
        actual_tx_count: None,
        winning_fid: None,
        second_place_winner_fid: None,
        block_hash: None,
        created_at,
    };

    match ctx.db.rounds().try_insert(new_round) {
        Ok(inserted) => {
            // Log event with the generated round_id
            let block_num_str = inserted.block_number.map(|n| n.to_string()).unwrap_or_else(|| "N/A".to_string());
            let details = format!(
                "round_id={}, round_number={}, start_time={}, end_time={}, duration_minutes={}, prize={}, block_number={}",
                inserted.round_id, inserted.round_number, inserted.start_time, inserted.end_time, inserted.duration_minutes, prize, block_num_str
            );
            let _ = ctx.db.logs().try_insert(LogEvent {
                log_id: 0,
                event_type: "round_created".to_string(),
                details,
                timestamp: created_at,
            });
            spacetimedb::log::info!("Round {} created", inserted.round_id);
            Ok(())
        }
        Err(e) => {
            let msg = format!("Failed to create round: {}", e);
            spacetimedb::log::error!("{}", msg);
            Err(msg)
        }
    }
}

#[reducer]
pub fn submit_guess(
    ctx: &ReducerContext,
    round_id: u64,
    fid: i64,
    username: String,
    guess: i64,
    pfp_url: Option<String>,
) -> Result<(), String> {
    // Validate round exists and is open
    let round = match ctx.db.rounds().round_id().find(&round_id) {
        Some(r) => r,
        None => return Err("Round not found".into()),
    };

    if round.status != "open" {
        return Err("Round is not open for guesses".into());
    }

    // Time-based validation: must be within [start_time, end_time)
    let now = now_unix_seconds(ctx);
    if now < round.start_time {
        return Err("Round has not started yet".into());
    }
    if now >= round.end_time {
        return Err("Round has ended; no more guesses allowed".into());
    }

    // Ensure user hasn't already submitted a guess for this round
    for g in ctx.db.guesses().iter() {
        if g.round_id == round_id && g.fid == fid {
            return Err("User has already submitted a guess for this round".into());
        }
    }

    let submitted_at = now;

    let guess_row = Guess {
        guess_id: 0, // auto_inc
        round_id,
        fid,
        username: username.clone(),
        guess,
        pfp_url: pfp_url.clone(),
        submitted_at,
    };

    match ctx.db.guesses().try_insert(guess_row) {
        Ok(inserted) => {
            // Log event
            let details = format!(
                "round_id={}, guess_id={}, fid={}, username={}, guess={}, pfp_url={}",
                round_id,
                inserted.guess_id,
                fid,
                username,
                guess,
                pfp_url.clone().unwrap_or_else(|| "".to_string())
            );
            let _ = ctx.db.logs().try_insert(LogEvent {
                log_id: 0,
                event_type: "guess_submitted".to_string(),
                details,
                timestamp: submitted_at,
            });
            spacetimedb::log::info!("Guess {} submitted for round {}", inserted.guess_id, round_id);
            Ok(())
        }
        Err(e) => {
            let msg = format!("Failed to submit guess: {}", e);
            spacetimedb::log::error!("{}", msg);
            Err(msg)
        }
    }
}

#[reducer]
pub fn end_round_manually(ctx: &ReducerContext, round_id: u64) -> Result<(), String> {
    if let Some(mut round) = ctx.db.rounds().round_id().find(&round_id) {
        if round.status != "open" {
            return Err("Round is not in 'open' status".into());
        }

        round.status = "closed".to_string();
        // Store details before moving round in update
        let details = format!("round_id={} closed manually", round_id);

        ctx.db.rounds().round_id().update(round);

        let _ = ctx.db.logs().try_insert(LogEvent {
            log_id: 0,
            event_type: "round_closed_manually".to_string(),
            details,
            timestamp: now_unix_seconds(ctx),
        });

        spacetimedb::log::info!("Round {} closed manually", round_id);
        Ok(())
    } else {
        Err("Round not found".into())
    }
}

#[reducer]
pub fn update_round_result(
    ctx: &ReducerContext,
    round_id: u64,
    actual_tx_count: i64,
    block_hash: String,
    winning_fid: i64,
) -> Result<(), String> {
    // Preserve provided fid for logging/back-compat only
    let provided_winning_fid = winning_fid;

    if let Some(mut round) = ctx.db.rounds().round_id().find(&round_id) {
        if round.status == "finished" {
            return Err("Round is already finished".into());
        }
        // Require round to be closed before updating result to enforce lifecycle
        if round.status != "closed" {
            return Err("Round must be 'closed' before updating result".into());
        }

        // Collect guesses for this round
        let mut round_guesses: Vec<Guess> = Vec::new();
        for g in ctx.db.guesses().iter() {
            if g.round_id == round_id {
                round_guesses.push(g.clone());
            }
        }

        // Rank guesses by absolute difference, then by earliest submission
        let mut ranked: Vec<(Guess, i64)> = round_guesses
            .into_iter()
            .map(|g| {
                let diff = (g.guess - actual_tx_count).abs();
                (g, diff)
            })
            .collect();

        ranked.sort_by(|a, b| {
            let ad = a.1;
            let bd = b.1;
            match ad.cmp(&bd) {
                std::cmp::Ordering::Equal => a.0.submitted_at.cmp(&b.0.submitted_at),
                other => other,
            }
        });

        let mut computed_winner: Option<i64> = None;
        let mut computed_runner_up: Option<i64> = None;
        let mut is_jackpot = false;

        if let Some((first, first_diff)) = ranked.get(0) {
            computed_winner = Some(first.fid);
            if *first_diff == 0 {
                is_jackpot = true;
            }
        }
        if ranked.len() > 1 {
            computed_runner_up = Some(ranked[1].0.fid);
        }

        // Prepare details before update to avoid moved values issues
        let details = format!(
            "round_id={}, actual_tx_count={}, computed_winner_fid={:?}, runner_up_fid={:?}, jackpot={}, provided_winning_fid={}, block_hash={}",
            round_id,
            actual_tx_count,
            computed_winner,
            computed_runner_up,
            is_jackpot,
            provided_winning_fid,
            block_hash
        );

        round.actual_tx_count = Some(actual_tx_count);
        round.block_hash = Some(block_hash);
        round.winning_fid = computed_winner;
        round.second_place_winner_fid = computed_runner_up;
        round.status = "finished".to_string();

        ctx.db.rounds().round_id().update(round);

        let _ = ctx.db.logs().try_insert(LogEvent {
            log_id: 0,
            event_type: "round_finished".to_string(),
            details,
            timestamp: now_unix_seconds(ctx),
        });

        spacetimedb::log::info!(
            "Round {} updated with results and marked finished (winner: {:?}, runner_up: {:?})",
            round_id,
            computed_winner,
            computed_runner_up
        );
        Ok(())
    } else {
        Err("Round not found".into())
    }
}

#[reducer]
pub fn send_chat_message(
    ctx: &ReducerContext,
    round_id: String,
    address: String,
    username: String,
    message: String,
    pfp_url: String,
    msg_type: String,
) -> Result<(), String> {
    let timestamp = now_unix_seconds(ctx);

    let chat_msg = ChatMessage {
        chat_id: 0, // auto_inc
        round_id: round_id.clone(),
        address: address.clone(),
        username: username.clone(),
        message: message.clone(),
        pfp_url: pfp_url.clone(),
        timestamp,
        msg_type: msg_type.clone(),
    };

    match ctx.db.chat_messages().try_insert(chat_msg) {
        Ok(inserted) => {
            // Log event
            let details = format!(
                "chat_id={}, round_id={}, address={}, username={}, msg_type={}",
                inserted.chat_id, round_id, address, username, msg_type
            );
            let _ = ctx.db.logs().try_insert(LogEvent {
                log_id: 0,
                event_type: "chat_message_sent".to_string(),
                details,
                timestamp,
            });
            spacetimedb::log::info!("Chat message {} sent", inserted.chat_id);
            Ok(())
        }
        Err(e) => {
            let msg = format!("Failed to send chat message: {}", e);
            spacetimedb::log::error!("{}", msg);
            Err(msg)
        }
    }
}

#[reducer]
pub fn get_active_round(ctx: &ReducerContext) -> Result<(), String> {
    // Select the most recent round whose status is "open" or "closed"
    let mut active: Option<Round> = None;
    for r in ctx.db.rounds().iter() {
        if r.status == "open" || r.status == "closed" {
            match &active {
                Some(curr) => {
                    if r.round_id > curr.round_id {
                        active = Some(r.clone());
                    }
                }
                None => active = Some(r.clone()),
            }
        }
    }

    // Log the lookup (clients can read the rounds table directly)
    let details = match active {
        Some(r) => format!(
            "active_round_id={}, status={}, start_time={}, end_time={}, duration_minutes={}",
            r.round_id, r.status, r.start_time, r.end_time, r.duration_minutes
        ),
        None => "no_active_round".to_string(),
    };

    let _ = ctx.db.logs().try_insert(LogEvent {
        log_id: 0,
        event_type: "active_round_checked".to_string(),
        details,
        timestamp: now_unix_seconds(ctx),
    });

    Ok(())
}

// New reducers for PrizeConfig

#[reducer]
pub fn savePrizeConfig(
    ctx: &ReducerContext,
    jackpot_amount: i64,
    first_place_amount: i64,
    second_place_amount: i64,
    currency_type: String,
    token_contract_address: String,
) -> Result<(), String> {
    // Basic validation
    if jackpot_amount <= 0 || first_place_amount <= 0 || second_place_amount <= 0 {
        return Err("All prize amounts must be positive numbers".into());
    }

    if currency_type.trim().is_empty() {
        return Err("Currency type must be non-empty".into());
    }

    let now_unix = now_unix_seconds(ctx);

    if ctx.db.prize_config().count() == 0 {
        // Insert first config
        let new_cfg = PrizeConfig {
            config_id: 0, // auto_inc
            jackpot_amount,
            first_place_amount,
            second_place_amount,
            currency_type: currency_type.clone(),
            token_contract_address: token_contract_address.clone(),
            updated_at: now_unix,
        };

        match ctx.db.prize_config().try_insert(new_cfg) {
            Ok(inserted) => {
                let details = format!(
                    "created config_id={} jackpot_amount={} first_place={} second_place={} currency='{}'",
                    inserted.config_id, jackpot_amount, first_place_amount, second_place_amount, currency_type
                );
                let _ = ctx.db.logs().try_insert(LogEvent {
                    log_id: 0,
                    event_type: "prize_config_saved".to_string(),
                    details,
                    timestamp: now_unix,
                });
                spacetimedb::log::info!("PrizeConfig created (config_id={})", inserted.config_id);
                Ok(())
            }
            Err(e) => {
                let msg = format!("Failed to create prize config: {}", e);
                spacetimedb::log::error!("{}", msg);
                Err(msg)
            }
        }
    } else {
        // Update the latest row (by highest config_id)
        let mut latest: Option<PrizeConfig> = None;
        for cfg in ctx.db.prize_config().iter() {
            match &latest {
                Some(curr) => {
                    if cfg.config_id > curr.config_id {
                        latest = Some(cfg.clone());
                    }
                }
                None => latest = Some(cfg.clone()),
            }
        }

        if let Some(mut current) = latest {
            current.jackpot_amount = jackpot_amount;
            current.first_place_amount = first_place_amount;
            current.second_place_amount = second_place_amount;
            current.currency_type = currency_type.clone();
            current.token_contract_address = token_contract_address.clone();
            current.updated_at = now_unix;

            // Prepare details before update (avoid moved values)
            let details = format!(
                "updated config_id={} jackpot_amount={} first_place={} second_place={} currency='{}'",
                current.config_id, jackpot_amount, first_place_amount, second_place_amount, currency_type
            );

            ctx.db.prize_config().config_id().update(current);

            // Ensure only one row remains by deleting older rows (if any)
            let mut to_delete: Vec<u64> = Vec::new();
            for cfg in ctx.db.prize_config().iter() {
                if let Some(lat) = &latest {
                    if cfg.config_id != lat.config_id {
                        to_delete.push(cfg.config_id);
                    }
                }
            }
            for id in to_delete {
                ctx.db.prize_config().config_id().delete(&id);
            }

            let _ = ctx.db.logs().try_insert(LogEvent {
                log_id: 0,
                event_type: "prize_config_saved".to_string(),
                details,
                timestamp: now_unix,
            });

            spacetimedb::log::info!("PrizeConfig updated");
            Ok(())
        } else {
            // Fallback: no latest found despite count > 0 (shouldn't happen)
            let msg = "Inconsistent state: prize_config count > 0 but no rows found".to_string();
            spacetimedb::log::error!("{}", msg);
            Err(msg)
        }
    }
}

#[reducer]
pub fn getPrizeConfig(ctx: &ReducerContext) -> Result<(), String> {
    // Fetch the latest config (by highest config_id) and log it.
    let mut latest: Option<PrizeConfig> = None;
    for cfg in ctx.db.prize_config().iter() {
        match &latest {
            Some(curr) => {
                if cfg.config_id > curr.config_id {
                    latest = Some(cfg.clone());
                }
            }
            None => latest = Some(cfg.clone()),
        }
    }

    let details = match latest {
        Some(cfg) => format!(
            "latest_config_id={} jackpot_amount={} first_place={} second_place={} currency='{}'",
            cfg.config_id, cfg.jackpot_amount, cfg.first_place_amount, cfg.second_place_amount, cfg.currency_type
        ),
        None => "no_prize_config_found".to_string(),
    };

    let _ = ctx.db.logs().try_insert(LogEvent {
        log_id: 0,
        event_type: "prize_config_checked".to_string(),
        details,
        timestamp: now_unix_seconds(ctx),
    });

    // Clients should read the public prize_config table to get the data.
    Ok(())
}