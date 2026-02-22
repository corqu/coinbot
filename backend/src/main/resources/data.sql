-- Strategy seed synchronized with python-server/app/strategy/applied_startegy
-- This seed is used for initial DB sync on backend startup.

INSERT INTO strategy (
    code,
    name,
    source,
    parameter_schema_json,
    is_active,
    version
) VALUES
    (
        'fibonacci_channel_v1',
        'Fibonacci Channel V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_channel_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_circles_v1',
        'Fibonacci Circles V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_circles_strategy',
        '{"type":"object","properties":{"center":{"type":"object"},"edge":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["center","edge"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_retracement_v1',
        'Fibonacci Retracement V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_retracement_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"target_ratio":{"type":"number","default":0.5},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_speed_resistance_arcs_v1',
        'Fibonacci Speed Resistance Arcs V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_speed_resistance_arcs_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_speed_resistance_fan_v1',
        'Fibonacci Speed Resistance Fan V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_speed_resistance_fan_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_spiral_v1',
        'Fibonacci Spiral V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_spiral_strategy',
        '{"type":"object","properties":{"center":{"type":"object"},"start":{"type":"object"},"theta_step":{"type":"number","default":0.39269908169872414},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["center","start"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_time_zones_v1',
        'Fibonacci Time Zones V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_time_zones_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"steps":{"type":"array","items":{"type":"integer"}}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'fibonacci_wedge_v1',
        'Fibonacci Wedge V1',
        'app.strategy.applied_startegy.fibonacci.fibonacci_wedge_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"narrow_ratio":{"type":"number","default":0.382},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'gann_box_breakout_v1',
        'Gann Box Breakout V1',
        'app.strategy.applied_startegy.gann.gann_box_breakout_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'gann_fan_breakout_v1',
        'Gann Fan Breakout V1',
        'app.strategy.applied_startegy.gann.gann_fan_breakout_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'gann_square_quarter_v1',
        'Gann Square Quarter V1',
        'app.strategy.applied_startegy.gann.gann_square_quarter_strategy',
        '{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}},"quarter_ratio":{"type":"number","default":0.25},"enforce_quarter_window":{"type":"boolean","default":true},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["start","end"]}',
        TRUE,
        'v1'
    ),
    (
        'inside_pitchfork_reentry_v1',
        'Inside Pitchfork Reentry V1',
        'app.strategy.applied_startegy.pitchfork.inside_pitchfork_reentry_strategy',
        '{"type":"object","properties":{"pivot_a":{"type":"object"},"pivot_b":{"type":"object"},"pivot_c":{"type":"object"},"reentry_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["pivot_a","pivot_b","pivot_c"]}',
        TRUE,
        'v1'
    ),
    (
        'ma_rsi_volume_v1',
        'MA RSI Volume V1',
        'app.strategy.applied_startegy.ma_rsi_volume_strategy',
        '{"type":"object","properties":{"short_window":{"type":"integer"},"long_window":{"type":"integer"}},"additionalProperties":false,"required":["short_window","long_window"]}',
        TRUE,
        'v1'
    ),
    (
        'modified_schiff_pitchfork_breakout_v1',
        'Modified Schiff Pitchfork Breakout V1',
        'app.strategy.applied_startegy.pitchfork.modified_schiff_pitchfork_breakout_strategy',
        '{"type":"object","properties":{"pivot_a":{"type":"object"},"pivot_b":{"type":"object"},"pivot_c":{"type":"object"},"breakout_buffer":{"type":"number","default":0.001}},"additionalProperties":false,"required":["pivot_a","pivot_b","pivot_c"]}',
        TRUE,
        'v1'
    ),
    (
        'pitchfork_breakout_v1',
        'Pitchfork Breakout V1',
        'app.strategy.applied_startegy.pitchfork.pitchfork_breakout_strategy',
        '{"type":"object","properties":{"pivot_a":{"type":"object"},"pivot_b":{"type":"object"},"pivot_c":{"type":"object"},"breakout_buffer":{"type":"number","default":0.001}},"additionalProperties":false,"required":["pivot_a","pivot_b","pivot_c"]}',
        TRUE,
        'v1'
    ),
    (
        'pitchfork_fan_breakout_v1',
        'Pitchfork Fan Breakout V1',
        'app.strategy.applied_startegy.pitchfork.pitchfork_fan_breakout_strategy',
        '{"type":"object","properties":{"pivot_a":{"type":"object"},"pivot_b":{"type":"object"},"pivot_c":{"type":"object"},"levels":{"type":"array","items":{"type":"number"}},"breakout_buffer":{"type":"number","default":0.001}},"additionalProperties":false,"required":["pivot_a","pivot_b","pivot_c"]}',
        TRUE,
        'v1'
    ),
    (
        'schiff_pitchfork_breakout_v1',
        'Schiff Pitchfork Breakout V1',
        'app.strategy.applied_startegy.pitchfork.schiff_pitchfork_breakout_strategy',
        '{"type":"object","properties":{"pivot_a":{"type":"object"},"pivot_b":{"type":"object"},"pivot_c":{"type":"object"},"breakout_buffer":{"type":"number","default":0.001}},"additionalProperties":false,"required":["pivot_a","pivot_b","pivot_c"]}',
        TRUE,
        'v1'
    ),
    (
        'trend_fibonacci_extension_v1',
        'Trend Fibonacci Extension V1',
        'app.strategy.applied_startegy.fibonacci.trend_fibonacci_extension_strategy',
        '{"type":"object","properties":{"a":{"type":"object"},"b":{"type":"object"},"c":{"type":"object"},"trigger_ratio":{"type":"number","default":1.0},"breakout_buffer":{"type":"number","default":0.0}},"additionalProperties":false,"required":["a","b","c"]}',
        TRUE,
        'v1'
    ),
    (
        'trend_fibonacci_time_v1',
        'Trend Fibonacci Time V1',
        'app.strategy.applied_startegy.fibonacci.trend_fibonacci_time_strategy',
        '{"type":"object","properties":{"a":{"type":"object"},"b":{"type":"object"},"c":{"type":"object"},"ratios":{"type":"array","items":{"type":"number"}}},"additionalProperties":false,"required":["a","b","c"]}',
        TRUE,
        'v1'
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    source = VALUES(source),
    parameter_schema_json = VALUES(parameter_schema_json),
    is_active = VALUES(is_active),
    version = VALUES(version);

-- Optional: deactivate removed strategies.
-- UPDATE strategy
-- SET is_active = FALSE
-- WHERE code NOT IN (
--     'fibonacci_channel_v1',
--     'fibonacci_circles_v1',
--     'fibonacci_retracement_v1',
--     'fibonacci_speed_resistance_arcs_v1',
--     'fibonacci_speed_resistance_fan_v1',
--     'fibonacci_spiral_v1',
--     'fibonacci_time_zones_v1',
--     'fibonacci_wedge_v1',
--     'gann_box_breakout_v1',
--     'gann_fan_breakout_v1',
--     'gann_square_quarter_v1',
--     'inside_pitchfork_reentry_v1',
--     'ma_rsi_volume_v1',
--     'modified_schiff_pitchfork_breakout_v1',
--     'pitchfork_breakout_v1',
--     'pitchfork_fan_breakout_v1',
--     'schiff_pitchfork_breakout_v1',
--     'trend_fibonacci_extension_v1',
--     'trend_fibonacci_time_v1'
-- );
