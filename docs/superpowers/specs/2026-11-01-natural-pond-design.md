# Natural pond wandering

User correction: fish and prawns must retain random independent movement; preventing overlap must not arrange them in a circle. The existing shared ellipse is explicitly rejected.

Replace the orbit with scene-local autonomous wandering. Each animal chooses its own random destinations and pace, turns gradually and slows occasionally. Only nearby animals influence one another with soft avoidance; occasional crossings remain acceptable. Preserve broad upper/middle/lower activity, detailed artwork, density, palette and performance budget. Positions survive resize and pause/resume without teleporting. No content, theme, route animation or storage changes.

Independent steering is the implementation choice: a common track or reserved lanes would repeat the rejected visual pattern. Randomness is seeded per scene for fresh visits and reproducible tests. No new dependency or physics library.