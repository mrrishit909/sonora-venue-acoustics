# Asset contract

`model/parts.json` is read by `build.py`, `validate.py` and the web app. Blender is Z-up, the GLB is Y-up (glTF z = minus Blender y): the stage is at z = -18, the rear wall at z = +18.

| Group | Names | Pivot |
|---|---|---|
| Shell | Hall_Floor, Hall_Ceiling, Wall_Left, Wall_Right, Wall_Rear, Wall_Stage | origin |
| Stage | Stage_Platform, Truss_Stage, Conductor_Podium, Conductor_Body, Conductor_Arm | the arm turns about the shoulder |
| Seating | Seats_Center, Seats_Left, Seats_Right, Seats_Balcony, Balcony_Deck, Balcony_Front, Balcony_Columns | origin |
| Wall panels | Panel_L_00..07, Panel_R_00..07, Panel_Rear_00..03 | inside the panel |
| Reflectors | Reflector_00..05 | inside the panel (the browser sets the height) |
| Speakers | SpeakerArray_L/R (6 elements each), Speaker_Fill_L/R (1 each) | the hang point; elements hang 0.25 m below it, 0.36 m apart |
| Lights | Light_00..05 | inside the lamp |
| Analysis | Proxy_Hall (never drawn) | origin |

Outputs: `hall.glb` (770 KB, 80 KB gzipped, 14,424 triangles), `analysis.json` (hall size, stage and balcony bounds, 1,063 seats in 4 blocks, reflector cloud, hang points), `poster.png`.

`validate.py` re-imports the GLB in a fresh scene and fails on: a missing part, an unparented node, a pivot outside its panel, reflector or light, an unapplied scale, a speaker element above its hang point, a wrongly placed conductor's shoulder, any part outside the hall envelope, an `analysis.json` that disagrees with the contract, seat counts that do not add up, or the triangle or byte budget being exceeded. It caught two panels that stuck out of the end wall and a missing set of lights during the build.
