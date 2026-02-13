-- MEDIUM-6: Rollback FK changes

-- 1. Drop new constraints
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_creator;
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_opponent;
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_winner;
ALTER TABLE game_moves DROP CONSTRAINT fk_game_moves_user;

-- 2. Handle rows where creator_id is NULL before restoring NOT NULL
-- (Note: This is destructive for games with deleted creators, as documented in the plan)
DELETE FROM game_rooms WHERE creator_id IS NULL;

-- 3. Restore NOT NULL on creator_id
ALTER TABLE game_rooms ALTER COLUMN creator_id SET NOT NULL;

-- 4. Restore original constraints
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_creator FOREIGN KEY (creator_id) REFERENCES users(id);
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_opponent FOREIGN KEY (opponent_id) REFERENCES users(id);
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_winner FOREIGN KEY (winner_id) REFERENCES users(id);
ALTER TABLE game_moves ADD CONSTRAINT fk_game_moves_user FOREIGN KEY (user_id) REFERENCES users(id);
