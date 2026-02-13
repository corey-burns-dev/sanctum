-- MEDIUM-6: Enforce ON DELETE SET NULL on game_rooms user FKs and ON DELETE CASCADE on game_moves.user_id

-- 1. Drop old constraints
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_creator;
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_opponent;
ALTER TABLE game_rooms DROP CONSTRAINT fk_game_rooms_winner;

-- 2. Make creator_id nullable
ALTER TABLE game_rooms ALTER COLUMN creator_id DROP NOT NULL;

-- 3. Add new constraints with ON DELETE SET NULL
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE game_rooms ADD CONSTRAINT fk_game_rooms_winner FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Update game_moves constraints
ALTER TABLE game_moves DROP CONSTRAINT fk_game_moves_user;
ALTER TABLE game_moves ADD CONSTRAINT fk_game_moves_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
