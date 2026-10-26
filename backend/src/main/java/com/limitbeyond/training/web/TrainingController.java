package com.limitbeyond.training.web;

import com.limitbeyond.training.internal.TrainingService;
import com.limitbeyond.training.internal.FoodDataService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.time.LocalDate; import java.util.List; import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
class TrainingController {
 private final TrainingService service; private final FoodDataService foodData; TrainingController(TrainingService service,FoodDataService foodData){this.service=service;this.foodData=foodData;}
 @GetMapping("/api/v1/exercises") List<TrainingDtos.ExerciseView> exercises(){return service.exercises();}
 @GetMapping("/api/v1/exercises/{id}") TrainingDtos.ExerciseView exercise(@PathVariable UUID id){return service.exercise(id);}
 @PostMapping("/api/v1/exercises") TrainingDtos.ExerciseView createExercise(@Valid @RequestBody TrainingDtos.ExerciseRequest r){return service.createExercise(r);}
 @PatchMapping("/api/v1/exercises/{id}") TrainingDtos.ExerciseView updateExercise(@PathVariable UUID id,@Valid @RequestBody TrainingDtos.ExerciseRequest r){return service.updateExercise(id,r);}
 @DeleteMapping("/api/v1/exercises/{id}") ResponseEntity<Void> deleteExercise(@PathVariable UUID id){service.deleteExercise(id);return ResponseEntity.noContent().build();}
 @GetMapping("/api/v1/me/workouts") List<TrainingDtos.WorkoutView> workouts(@RequestParam(required=false) UUID memberId){return service.myWorkouts(memberId);}
 @GetMapping("/api/v1/me/workouts/by-date-range") List<TrainingDtos.WorkoutView> workoutsByDate(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate,@RequestParam(required=false) UUID memberId){return service.workoutsBetween(memberId,startDate,endDate);}
 @GetMapping("/api/v1/me/workouts/by-muscle-group/{muscle}") List<TrainingDtos.WorkoutView> workoutsByMuscle(@PathVariable String muscle,@RequestParam(required=false) UUID memberId){return service.workoutsByMuscle(memberId,muscle);}
 @GetMapping("/api/v1/me/workouts/{id}") TrainingDtos.WorkoutView workout(@PathVariable UUID id){return service.myWorkout(id);}
 @PostMapping("/api/v1/me/workouts") TrainingDtos.WorkoutView createWorkout(@Valid @RequestBody TrainingDtos.WorkoutRequest r){return service.createWorkout(r);}
 @PatchMapping("/api/v1/me/workouts/{id}") TrainingDtos.WorkoutView updateWorkout(@PathVariable UUID id,@Valid @RequestBody TrainingDtos.UpdateWorkoutRequest r){return service.updateWorkout(id,r);}
 @DeleteMapping("/api/v1/me/workouts/{id}") ResponseEntity<Void> deleteWorkout(@PathVariable UUID id){service.deleteWorkout(id);return ResponseEntity.noContent().build();}
 @PostMapping("/api/v1/me/workouts/{id}/complete") TrainingDtos.WorkoutView completeWorkout(@PathVariable UUID id){return service.completeWorkout(id);}
 @PostMapping("/api/v1/me/workouts/{id}/reopen") TrainingDtos.WorkoutView reopenWorkout(@PathVariable UUID id){return service.reopenWorkout(id);}
 @PostMapping("/api/v1/me/workouts/{id}/copy") TrainingDtos.WorkoutView copyWorkout(@PathVariable UUID id,@Valid @RequestBody TrainingDtos.CopyWorkoutRequest r){return service.copyWorkout(id,r);}
 @PostMapping("/api/v1/me/workouts/{workoutId}/sets/{setId}/complete") TrainingDtos.WorkoutView completeSet(@PathVariable UUID workoutId,@PathVariable UUID setId){return service.markSet(workoutId,setId,true);}
 @PostMapping("/api/v1/me/workouts/{workoutId}/sets/{setId}/uncomplete") TrainingDtos.WorkoutView uncompleteSet(@PathVariable UUID workoutId,@PathVariable UUID setId){return service.markSet(workoutId,setId,false);}
 @PostMapping("/api/v1/me/workouts/{workoutId}/exercises/{exerciseId}/complete") TrainingDtos.WorkoutView completeExercise(@PathVariable UUID workoutId,@PathVariable UUID exerciseId){return service.completeExercise(workoutId,exerciseId);}
 @PostMapping("/api/v1/me/workouts/{id}/exercises") TrainingDtos.WorkoutView addWorkoutExercise(@PathVariable UUID id,@Valid @RequestBody TrainingDtos.WorkoutExerciseRequest r){return service.addWorkoutExercise(id,r);}
 @PutMapping("/api/v1/me/workouts/{id}/exercises/{exerciseId}") TrainingDtos.WorkoutView replaceWorkoutExercise(@PathVariable UUID id,@PathVariable UUID exerciseId,@Valid @RequestBody TrainingDtos.WorkoutExerciseRequest r){return service.replaceWorkoutExercise(id,exerciseId,r);}
 @DeleteMapping("/api/v1/me/workouts/{id}/exercises/{exerciseId}") TrainingDtos.WorkoutView removeWorkoutExercise(@PathVariable UUID id,@PathVariable UUID exerciseId){return service.removeWorkoutExercise(id,exerciseId);}
 @GetMapping("/api/v1/me/personal-records") List<TrainingDtos.PersonalRecord> records(){return service.myProgress().personalRecords();}
 @GetMapping("/api/v1/me/progress") TrainingDtos.ProgressView progress(){return service.myProgress();}
 @PostMapping("/api/v1/me/progress/metrics") TrainingDtos.MetricView metric(@Valid @RequestBody TrainingDtos.MetricRequest r){return service.addMyMetric(r);}
 @GetMapping("/api/v1/users/{userId}/progress") TrainingDtos.ProgressView memberProgress(@PathVariable UUID userId){return service.userProgress(userId);}
 @PostMapping("/api/v1/users/{userId}/progress/metrics") TrainingDtos.MetricView memberMetric(@PathVariable UUID userId,@Valid @RequestBody TrainingDtos.MetricRequest r){return service.addUserMetric(userId,r);}
 @GetMapping("/api/v1/me/diet-plan") TrainingDtos.DietPlanView diet(){return service.myDiet();}
 @GetMapping("/api/v1/users/{userId}/diet-plan") TrainingDtos.DietPlanView memberDiet(@PathVariable UUID userId){return service.userDiet(userId);}
 @PostMapping("/api/v1/users/{userId}/diet-plans") TrainingDtos.DietPlanView diet(@PathVariable UUID userId,@Valid @RequestBody TrainingDtos.DietPlanRequest r){return service.assignDiet(userId,r);}
 @PostMapping("/api/v1/me/diet-plans") TrainingDtos.DietPlanView myDiet(@Valid @RequestBody TrainingDtos.DietPlanRequest r){return service.assignMyDiet(r);}
 @GetMapping("/api/v1/me/diet-plans/history") List<TrainingDtos.DietPlanView> myDietHistory(){return service.myDietHistory();}
 @GetMapping("/api/v1/users/{userId}/diet-plans/history") List<TrainingDtos.DietPlanView> dietHistory(@PathVariable UUID userId){return service.userDietHistory(userId);}
 @DeleteMapping("/api/v1/me/diet-plans/{id}") ResponseEntity<Void> deactivateMyDiet(@PathVariable UUID id){service.deactivateMyDiet(id);return ResponseEntity.noContent().build();}
 @DeleteMapping("/api/v1/users/{userId}/diet-plans/{id}") ResponseEntity<Void> deactivateDiet(@PathVariable UUID userId,@PathVariable UUID id){service.deactivateUserDiet(userId,id);return ResponseEntity.noContent().build();}
 @GetMapping("/api/v1/me/nutrition") TrainingDtos.NutritionDayView myNutrition(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date){return service.myNutrition(date);}
 @GetMapping("/api/v1/users/{userId}/nutrition") TrainingDtos.NutritionDayView nutrition(@PathVariable UUID userId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date){return service.userNutrition(userId,date);}
 @GetMapping("/api/v1/me/nutrition/history") List<TrainingDtos.NutritionHistoryDay> myNutritionHistory(@RequestParam(defaultValue="14") int days){return service.myNutritionHistory(days);}
 @GetMapping("/api/v1/users/{userId}/nutrition/history") List<TrainingDtos.NutritionHistoryDay> nutritionHistory(@PathVariable UUID userId,@RequestParam(defaultValue="14") int days){return service.userNutritionHistory(userId,days);}
 @PostMapping("/api/v1/me/nutrition/entries") TrainingDtos.NutritionEntryView addMyNutrition(@Valid @RequestBody TrainingDtos.NutritionEntryRequest r){return service.addMyNutrition(r);}
 @PostMapping("/api/v1/users/{userId}/nutrition/entries") TrainingDtos.NutritionEntryView addNutrition(@PathVariable UUID userId,@Valid @RequestBody TrainingDtos.NutritionEntryRequest r){return service.addUserNutrition(userId,r);}
 @PostMapping("/api/v1/me/nutrition/entries/batch") List<TrainingDtos.NutritionEntryView> addMyNutritionBatch(@Valid @NotEmpty @RequestBody List<TrainingDtos.@Valid NutritionEntryRequest> requests){return service.addMyNutritionBatch(requests);}
 @PostMapping("/api/v1/users/{userId}/nutrition/entries/batch") List<TrainingDtos.NutritionEntryView> addNutritionBatch(@PathVariable UUID userId,@Valid @NotEmpty @RequestBody List<TrainingDtos.@Valid NutritionEntryRequest> requests){return service.addUserNutritionBatch(userId,requests);}
 @PutMapping("/api/v1/nutrition/entries/{id}") TrainingDtos.NutritionEntryView updateNutrition(@PathVariable UUID id,@Valid @RequestBody TrainingDtos.NutritionEntryRequest r){return service.updateNutrition(id,r);}
 @DeleteMapping("/api/v1/nutrition/entries/{id}") ResponseEntity<Void> deleteNutrition(@PathVariable UUID id){service.deleteNutrition(id);return ResponseEntity.noContent().build();}
 @GetMapping("/api/v1/nutrition/foods/search") List<TrainingDtos.FoodSearchItem> foods(@RequestParam String q){return foodData.search(q);}
}
