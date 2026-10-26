export type MealType = 'BREAKFAST' | 'MID_MORNING' | 'LUNCH' | 'SNACK' | 'DINNER' | 'POST_WORKOUT';
export interface DietPlan { id:string; objective:string; content:string; kcalTarget:number|null; proteinG:number|null; carbsG:number|null; fatG:number|null; waterMlTarget:number|null; fiberGTarget:number|null; startsOn:string; endsOn:string|null; active:boolean }
export interface NutritionEntry { id:string; loggedOn:string; mealType:MealType|null; foodName:string; servingAmount:number; servingUnit:string; calories:number; proteinG:number; carbsG:number; fatG:number; fiberG:number; waterMl:number; source:'MANUAL'|'USDA'; sourceRef:string|null; notes:string|null; createdByUserId:string }
export interface NutritionTotals { calories:number; proteinG:number; carbsG:number; fatG:number; fiberG:number; waterMl:number }
export interface NutritionDay { date:string; plan: DietPlan|null; totals:NutritionTotals; entries:NutritionEntry[] }
export interface NutritionHistoryDay { date:string; totals:NutritionTotals }
export interface FoodSearchItem { sourceRef:string; name:string; brand:string|null; servingLabel:string; defaultServingGrams:number; calories:number; proteinG:number; carbsG:number; fatG:number; fiberG:number }
