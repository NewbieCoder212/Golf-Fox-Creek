-- Club tournament format rules (scramble, best ball, head-to-head singles, etc.)

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES (
  'tournament_formats',
  '{
    "active_format_ids": ["scramble", "best_ball", "singles"],
    "formats": [
      {
        "id": "scramble",
        "label": "Scramble",
        "scoring_hint": "One team score per hole — lower net wins the hole",
        "how_it_works": "Everyone in the group tees off. The team decides which tee shot is the best. The other players pick up their balls and bring them to that spot. Everyone plays their second shot from within one club-length of that chosen spot (no closer to the hole). Repeat for every shot—including putts—until the ball is holed out. Can be played with 2-, 3-, or 4-person teams.",
        "the_score": "The team records one team score per hole.",
        "scoring_mode": "team_single_score",
        "enabled": true,
        "default_players_per_match": 2,
        "team_scorecard": true
      },
      {
        "id": "best_ball",
        "label": "Best Ball (Four-Ball)",
        "scoring_hint": "Lowest partner net per side wins the hole",
        "how_it_works": "You and your partner both play the hole normally from tee to cup. If you score a 5 and your partner scores a 4, your team score for that hole is 4. Throw out the worse score and only record the best ball. Most commonly played as a 2-person team event.",
        "the_score": "One team score per hole (the lowest individual score of the partners).",
        "scoring_mode": "team_best_ball",
        "enabled": true,
        "default_players_per_match": 2,
        "team_scorecard": false
      },
      {
        "id": "singles",
        "label": "Head-to-Head Singles (Match Play)",
        "scoring_hint": "1v1 hole-by-hole — Up, Down, or All Square",
        "how_it_works": "Ryder Cup style: you play a direct game against exactly one opponent, hole by hole. You and your opponent play your own balls. The player with the lowest score on a hole wins that hole and goes \"1 Up.\" Tied holes are halved. The match ends when one player is up by more holes than remain (e.g. 3 Up with 2 to play is \"3 & 2\").",
        "the_score": "Scores are tracked as Up, Down, or All Square (tied), rather than total strokes.",
        "scoring_mode": "head_to_head_match_play",
        "enabled": true,
        "default_players_per_match": 1,
        "team_scorecard": false
      }
    ]
  }'::jsonb,
  'Tournament format rules and instructions for match setup and scoring'
)
ON CONFLICT (setting_key) DO NOTHING;
