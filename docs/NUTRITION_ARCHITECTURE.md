# Nutrition tracking architecture

## Product model

The nutrition area is a daily diary, not a static diet-plan document. A user or
authorized coach logs foods and water against a date. Each entry stores a
snapshot of its calories and macronutrients so historical totals do not change
when an external food database later corrects a product.

Goals are immutable versions. Saving an edit archives the old `diet_plans` row
and creates a new active row. This preserves who set the goal and what target
was active at the time. Intake records similarly retain `created_by_user_id`,
allowing member-entered and coach-entered data to be distinguished later.

## Authority

- Every signed-in gym user can create, update, and delete their own diary
  entries.
- Gym admins and trainers can CRUD diary entries for members in their gym.
- Only admins and trainers can set goals, including goals for their own
  personal fitness profile.
- Service-level checks and PostgreSQL row-level security both enforce tenant
  boundaries.

## Nutrient data

The backend optionally proxies USDA FoodData Central search. Configure
`USDA_FDC_API_KEY`; the key must never be shipped in the mobile application.
Selected foods are normalized to a 100 g basis and the mobile client calculates
the logged portion. Manual entry remains first-class for recipes, local foods,
and deployments without a USDA key.

Food entries track energy, protein, carbohydrate, fat, and fibre. Water entries
track millilitres. Daily summaries are calculated on the server from stored
snapshots rather than trusted client totals.

## Safety boundary

This feature supports tracking and professional coaching; it does not diagnose
conditions or automatically prescribe an energy deficit. Calorie needs depend
on personal and clinical context. The UI labels targets as guidance and shows
the energy implied by macros (protein and carbohydrate at 4 kcal/g; fat at
9 kcal/g) so inconsistent targets are visible. Pregnancy, eating disorders,
kidney disease, diabetes, and other clinical cases should be referred to an
appropriately licensed clinician or registered dietitian.

## Research basis

- USDA FoodData Central provides public-domain food composition data and a
  search/detail API: https://fdc.nal.usda.gov/api-guide/
- Cronometer's diary pattern combines foods, water, energy, macro targets, and
  nutrient contribution views: https://support.cronometer.com/hc/en-us/articles/360018171731-Diary-Overview
- MyFitnessPal similarly centres daily meals, macros, water, and healthy habits:
  https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Your-Today-tab
- NIDDK notes that calorie needs depend on age, weight, metabolism, sex, and
  activity, and limits its Body Weight Planner to appropriate adult contexts:
  https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner
- A resistance-training meta-analysis found diminishing additional lean-mass
  benefit beyond roughly 1.6 g protein/kg/day in the studied healthy adults;
  this informs coaching context but is deliberately not hard-coded as a
  prescription: https://doi.org/10.1136/bjsports-2017-097608

## API surface

- `GET /api/v1/me/nutrition?date=YYYY-MM-DD`
- `GET /api/v1/users/{userId}/nutrition?date=YYYY-MM-DD`
- `GET .../nutrition/history?days=14`
- `POST .../nutrition/entries`
- `PUT|DELETE /api/v1/nutrition/entries/{id}`
- `GET /api/v1/nutrition/foods/search?q=...`
- `POST /api/v1/me/diet-plans` and `POST /api/v1/users/{userId}/diet-plans`
- `GET .../diet-plans/history`
- `DELETE .../diet-plans/{id}`
