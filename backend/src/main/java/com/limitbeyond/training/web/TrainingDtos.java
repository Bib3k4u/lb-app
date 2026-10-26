package com.limitbeyond.training.web;

import com.limitbeyond.training.domain.BodyMetric.MetricType;
import com.limitbeyond.training.domain.Exercise.Difficulty;
import com.limitbeyond.training.domain.Exercise.Discipline;
import com.limitbeyond.training.domain.NutritionEntry.MealType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class TrainingDtos {
 private TrainingDtos() {}
 public record ExerciseView(UUID id,UUID gymId,String name,Discipline discipline,Difficulty difficulty,String instructions,String primaryMuscleGroup,String secondaryMuscleGroup,boolean requiresWeight) {}
 public record ExerciseRequest(@NotBlank @Size(max=100) String name,@NotNull Discipline discipline,@NotNull Difficulty difficulty,@NotBlank @Size(max=2000) String instructions,@NotBlank @Size(max=80) String primaryMuscleGroup,@Size(max=160) String secondaryMuscleGroup,boolean requiresWeight) {}
 public record SetInput(@NotNull UUID exerciseId,@Min(1) int setNumber,@Min(0) Integer reps,@DecimalMin("0") BigDecimal weightKg,@Min(0) Integer seconds,@DecimalMin("0") @DecimalMax("10") BigDecimal rpe,@Size(max=500) String notes) {}
 public record ExerciseSetInput(@Min(0) Integer reps,@DecimalMin("0") BigDecimal weightKg,@Min(0) Integer seconds,@DecimalMin("0") @DecimalMax("10") BigDecimal rpe,@Size(max=500) String notes) {}
 public record WorkoutExerciseRequest(UUID exerciseId,@Valid @NotEmpty List<ExerciseSetInput> sets) {}
 public record WorkoutRequest(@NotBlank @Size(max=120) String title,@Size(max=2000) String description,UUID memberId,List<@NotBlank @Size(max=80) String> targetMuscleGroups,@NotNull Instant performedAt,@Min(1) @Max(1440) int durationMinutes,@Size(max=2000) String notes,UUID locationId,@NotBlank @Size(max=120) String idempotencyKey,@Valid @NotEmpty List<SetInput> sets) {}
 public record UpdateWorkoutRequest(@NotBlank @Size(max=120) String title,@Size(max=2000) String description,List<@NotBlank @Size(max=80) String> targetMuscleGroups,@NotNull Instant performedAt,@Min(1) @Max(1440) int durationMinutes,@Size(max=2000) String notes,UUID locationId,@Valid @NotEmpty List<SetInput> sets) {}
 public record CopyWorkoutRequest(@NotNull Instant performedAt,@NotBlank @Size(max=120) String idempotencyKey) {}
 public record SetView(UUID id,UUID exerciseId,String exerciseName,int setNumber,Integer reps,BigDecimal weightKg,Integer seconds,BigDecimal rpe,String notes,BigDecimal volume,boolean completed) {}
 public record WorkoutView(UUID id,UUID memberId,UUID trainerId,String title,String description,List<String> targetMuscleGroups,Instant performedAt,int durationMinutes,String notes,UUID locationId,boolean completed,Instant completedAt,List<SetView> sets) {}
 public record PersonalRecord(UUID exerciseId,String exerciseName,BigDecimal maxWeightKg,Integer maxReps,Instant achievedAt) {}
 public record MetricRequest(@NotNull MetricType metricType,@NotNull LocalDate recordedOn,@NotNull @DecimalMin("0.01") @DecimalMax("999.99") BigDecimal value,@NotBlank @Size(max=20) String unit) {}
 public record MetricView(UUID id,MetricType metricType,LocalDate recordedOn,BigDecimal value,String unit) {}
 public record ProgressView(List<MetricView> metrics,List<PersonalRecord> personalRecords,int workoutCount) {}
 public record DietPlanRequest(@NotBlank @Size(max=160) String objective,@NotBlank @Size(max=10000) String content,@Min(1) Integer kcalTarget,@Min(0) Integer proteinG,@Min(0) Integer carbsG,@Min(0) Integer fatG,@Min(0) Integer waterMlTarget,@Min(0) Integer fiberGTarget,@NotNull LocalDate startsOn,LocalDate endsOn) {}
 public record DietPlanView(UUID id,String objective,String content,Integer kcalTarget,Integer proteinG,Integer carbsG,Integer fatG,Integer waterMlTarget,Integer fiberGTarget,LocalDate startsOn,LocalDate endsOn,boolean active) {}
 public record NutritionEntryRequest(@NotNull LocalDate loggedOn,MealType mealType,@NotBlank @Size(max=200) String foodName,@NotNull @DecimalMin("0.01") BigDecimal servingAmount,@NotBlank @Size(max=30) String servingUnit,@DecimalMin("0") BigDecimal calories,@DecimalMin("0") BigDecimal proteinG,@DecimalMin("0") BigDecimal carbsG,@DecimalMin("0") BigDecimal fatG,@DecimalMin("0") BigDecimal fiberG,@Min(-500) @Max(500) int waterMl,@Size(max=20) String source,@Size(max=100) String sourceRef,@Size(max=500) String notes) {}
 public record NutritionEntryView(UUID id,LocalDate loggedOn,MealType mealType,String foodName,BigDecimal servingAmount,String servingUnit,BigDecimal calories,BigDecimal proteinG,BigDecimal carbsG,BigDecimal fatG,BigDecimal fiberG,int waterMl,String source,String sourceRef,String notes,UUID createdByUserId) {}
 public record NutritionTotals(BigDecimal calories,BigDecimal proteinG,BigDecimal carbsG,BigDecimal fatG,BigDecimal fiberG,int waterMl) {}
 public record NutritionDayView(LocalDate date,DietPlanView plan,NutritionTotals totals,List<NutritionEntryView> entries) {}
 public record NutritionHistoryDay(LocalDate date,NutritionTotals totals) {}
 public record FoodSearchItem(String sourceRef,String name,String brand,String servingLabel,BigDecimal defaultServingGrams,BigDecimal calories,BigDecimal proteinG,BigDecimal carbsG,BigDecimal fatG,BigDecimal fiberG) {}
}
