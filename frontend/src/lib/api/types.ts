export type Role = "SUPER_ADMIN" | "GYM_OWNER" | "LOCATION_ADMIN" | "TRAINER" | "MEMBER";

export type GymState = "PENDING_VERIFICATION" | "VERIFIED" | "LIVE" | "SUSPENDED" | "REJECTED" | "CLOSED";
export type LocationApprovalState = "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
export type AccountState = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  correlationId?: string;
  fields?: Array<{ field: string; message: string }>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Array<{ field: string; message: string }>;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.fields = problem.fields;
  }
}

export interface GrantView {
  role: Role;
  gymId: string | null;
  locationIds: string[];
  gymWide: boolean;
}

export interface PendingGym {
  id: string;
  slug: string;
  legalName: string;
  state: GymState;
}

export interface MeResponse {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneE164?: string;
  state: AccountState;
  dateOfBirth?: string;
  gender?: string;
  heightCm?: number;
  experienceLevel?: string;
  primaryGoal?: string;
  profileComplete: boolean;
  grants: GrantView[];
  pendingGym?: PendingGym | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MeResponse;
}

export interface LocationInput {
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phoneE164?: string;
}

export interface LocationSummary extends LocationInput {
  id: string;
  gymId: string;
  checkinRadiusM: number;
  approvalState: LocationApprovalState;
  rejectionReason?: string | null;
}

/** The subset of a location embedded in GymSummary — no radius/geo/gymId. */
export interface LocationDetail {
  id: string;
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phoneE164?: string;
  approvalState: LocationApprovalState;
}

export interface GymRegistrantSummary {
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string;
}

export interface GymSummary {
  id: string;
  slug: string;
  legalName: string;
  tradingName?: string;
  gstin?: string;
  state: GymState;
  createdAt: string;
  registrant: GymRegistrantSummary;
  locations: LocationDetail[];
}

export interface GymRegistrationInput {
  slug: string;
  legalName: string;
  tradingName?: string;
  gstin?: string;
  location: LocationInput;
}

export interface SubscriptionOffering {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
}

/** MembershipInfo — the membership summary embedded in a roster PersonSummary. */
export interface MembershipRef {
  planId?: string;
  planName: string;
  expiresOn: string;
  state: string;
  currentlyActive: boolean;
}

export interface AssignedTrainerRef {
  trainerUserId: string;
  firstName: string;
  lastName: string;
  locationId?: string;
  assignedAt?: string;
}

export interface PersonSummary {
  userId: string;
  firstName: string;
  lastName: string;
  phoneE164?: string;
  email?: string;
  role: Role;
  gymWide: boolean;
  locationIds: string[];
  accountState: AccountState;
  grantedAt: string;
  membership?: MembershipRef | null;
  memberRecordId?: string | null;
  assignedTrainer?: AssignedTrainerRef | null;
  dateOfBirth?: string;
  gender?: string;
  heightCm?: number;
  experienceLevel?: string;
  primaryGoal?: string;
}

export interface TrainerSummary {
  userId: string;
  firstName: string;
  lastName: string;
  phoneE164?: string;
  email?: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  durationMonths: number;
  priceMinor: number;
  currency: string;
  assignedMemberCount: number;
}

export interface PlanInput {
  name: string;
  durationMonths: number;
  priceMinor: number;
}

export type FeedbackCategory = "FACILITY" | "TRAINER" | "BILLING" | "OTHER" | string;
export type FeedbackState = "OPEN" | "RESOLVED";

export interface FeedbackResponseView {
  id: string;
  body: string;
  createdAt: string;
  authorName?: string;
}

export interface FeedbackView {
  id: string;
  locationId: string;
  title: string;
  category: FeedbackCategory;
  body: string;
  state: FeedbackState;
  anonymous: boolean;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
  ownedByCaller: boolean;
  responses: FeedbackResponseView[];
}

export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membershipsExpiringSoon: number;
  totalTrainers: number;
  checkIns: number;
  uniqueMembersCheckedIn: number;
  workoutsCompleted: number;
  activeMemberRate: number;
}

export interface DailyActivityPoint {
  day: string;
  memberCheckIns: number;
  trainerCheckIns: number;
  totalCheckIns: number;
  uniqueMembers: number;
  completedWorkouts: number;
}

export interface RecentCheckIn {
  id: string;
  userId: string;
  memberName: string;
  role: string;
  locationId: string;
  locationName: string;
  occurredAt: string;
  method: string;
  purpose: string;
  distanceM?: number;
  flagged: boolean;
}

export interface TrainerActivity {
  userId: string;
  trainerName: string;
  accountState: string;
  assignedMembers: number;
  checkIns: number;
  completedWorkouts: number;
  lastSeenAt?: string;
}

export interface TrainerDailyActivity {
  day: string;
  trainerUserId: string;
  trainerName: string;
  checkIns: number;
  completedWorkouts: number;
}

export interface MemberActivity {
  userId: string;
  memberRecordId?: string;
  memberName: string;
  accountState: string;
  membershipState?: string;
  membershipExpiresOn?: string;
  membershipCurrentlyActive?: boolean;
  primaryLocationId?: string;
  checkIns: number;
  completedWorkouts: number;
  lastCheckInAt?: string;
  lastWorkoutAt?: string;
}

export interface DashboardResponse {
  range: { from: string; to: string };
  summary: DashboardSummary;
  dailyActivity: DailyActivityPoint[];
  recentCheckIns: RecentCheckIn[];
  trainers: TrainerActivity[];
}

export interface VerificationDecisionInput {
  approved: boolean;
  reason?: string;
  planId?: string;
}

export interface LocationQrToken {
  token: string;
  reusable: boolean;
}

export interface PublicGymListing {
  gymId: string;
  gymSlug: string;
  gymName: string;
  locationId: string;
  locationName: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
}

export interface MonthlyRevenuePoint {
  month: string;
  amountMinor: number;
}

export interface RevenueSummary {
  totalRevenueMinor: number;
  last30DaysRevenueMinor: number;
  monthly: MonthlyRevenuePoint[];
}

// --- Training: nutrition, progress, workouts (admin/trainer acting on a member's behalf) ---

export type MealType = "BREAKFAST" | "MID_MORNING" | "LUNCH" | "SNACK" | "DINNER" | "POST_WORKOUT";
export type MetricType =
  | "WEIGHT_KG"
  | "BODY_FAT_PCT"
  | "CHEST_CM"
  | "WAIST_CM"
  | "HIP_CM"
  | "ARM_CM"
  | "THIGH_CM"
  | "NECK_CM";

export interface DietPlanInput {
  objective: string;
  content: string;
  kcalTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberGTarget?: number;
  waterMlTarget?: number;
  startsOn: string;
  endsOn?: string;
}

export interface DietPlanView extends DietPlanInput {
  id: string;
  active: boolean;
}

export interface NutritionEntryInput {
  loggedOn: string;
  mealType?: MealType;
  foodName: string;
  servingAmount: number;
  servingUnit: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  waterMl?: number;
  source?: string;
  sourceRef?: string;
  notes?: string;
}

export interface NutritionEntryView extends NutritionEntryInput {
  id: string;
  createdByUserId: string;
}

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
}

export interface NutritionDayView {
  date: string;
  plan: DietPlanView | null;
  totals: NutritionTotals;
  entries: NutritionEntryView[];
}

export interface NutritionHistoryDay {
  date: string;
  totals: NutritionTotals;
}

export interface FoodSearchItem {
  sourceRef: string;
  name: string;
  brand?: string;
  servingLabel: string;
  defaultServingGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface MetricInput {
  metricType: MetricType;
  recordedOn: string;
  value: number;
  unit: string;
}

export interface MetricView extends MetricInput {
  id: string;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeightKg?: number;
  maxReps?: number;
  achievedAt: string;
}

export interface ProgressView {
  metrics: MetricView[];
  personalRecords: PersonalRecord[];
  workoutCount: number;
}

export type ExerciseDiscipline = "STRENGTH" | "CARDIO" | "FUNCTIONAL" | "YOGA" | "MOBILITY" | "MEDITATION" | "DANCE";
export type ExerciseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface ExerciseView {
  id: string;
  gymId?: string;
  name: string;
  discipline: ExerciseDiscipline;
  difficulty: ExerciseDifficulty;
  instructions?: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroup?: string;
  requiresWeight: boolean;
}

export interface ExerciseInput {
  name: string;
  discipline: ExerciseDiscipline;
  difficulty: ExerciseDifficulty;
  instructions: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroup?: string;
  requiresWeight: boolean;
}

export interface SetInput {
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  seconds?: number;
  rpe?: number;
  notes?: string;
}

export interface SetView extends SetInput {
  id: string;
  exerciseName: string;
  volume?: number;
  completed: boolean;
}

export interface WorkoutInput {
  title: string;
  description?: string;
  memberId?: string;
  targetMuscleGroups: string[];
  performedAt: string;
  durationMinutes: number;
  notes?: string;
  locationId?: string;
  idempotencyKey: string;
  sets: SetInput[];
}

export interface WorkoutView {
  id: string;
  memberId: string;
  trainerId?: string;
  title: string;
  description?: string;
  targetMuscleGroups: string[];
  performedAt: string;
  durationMinutes: number;
  notes?: string;
  locationId?: string;
  completed: boolean;
  completedAt?: string;
  sets: SetView[];
}
