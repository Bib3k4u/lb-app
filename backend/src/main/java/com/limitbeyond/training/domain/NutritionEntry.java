package com.limitbeyond.training.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name="nutrition_entries")
public class NutritionEntry {
    @Id private UUID id;
    @Column(name="user_id",nullable=false) private UUID userId;
    @Column(name="gym_id",nullable=false) private UUID gymId;
    @Column(name="logged_on",nullable=false) private LocalDate loggedOn;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(name="meal_type",columnDefinition="meal_type") private MealType mealType;
    @Column(name="food_name",nullable=false) private String foodName;
    @Column(name="serving_amount",nullable=false) private BigDecimal servingAmount;
    @Column(name="serving_unit",nullable=false) private String servingUnit;
    @Column(nullable=false) private BigDecimal calories;
    @Column(name="protein_g",nullable=false) private BigDecimal proteinG;
    @Column(name="carbs_g",nullable=false) private BigDecimal carbsG;
    @Column(name="fat_g",nullable=false) private BigDecimal fatG;
    @Column(name="fiber_g",nullable=false) private BigDecimal fiberG;
    @Column(name="water_ml",nullable=false) private int waterMl;
    @Column(nullable=false) private String source;
    @Column(name="source_ref") private String sourceRef;
    private String notes;
    @Column(name="created_by_user_id",nullable=false) private UUID createdByUserId;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected NutritionEntry() {}
    public NutritionEntry(UUID userId,UUID gymId,UUID authorId,LocalDate day,MealType meal,String name,BigDecimal amount,String unit,BigDecimal calories,BigDecimal protein,BigDecimal carbs,BigDecimal fat,BigDecimal fiber,int water,String source,String sourceRef,String notes){this.id=UUID.randomUUID();this.userId=userId;this.gymId=gymId;this.createdByUserId=authorId;this.createdAt=Instant.now();update(day,meal,name,amount,unit,calories,protein,carbs,fat,fiber,water,source,sourceRef,notes);}
    public void update(LocalDate day,MealType meal,String name,BigDecimal amount,String unit,BigDecimal calories,BigDecimal protein,BigDecimal carbs,BigDecimal fat,BigDecimal fiber,int water,String source,String sourceRef,String notes){this.loggedOn=day;this.mealType=meal;this.foodName=name.trim();this.servingAmount=amount;this.servingUnit=unit.trim();this.calories=nz(calories);this.proteinG=nz(protein);this.carbsG=nz(carbs);this.fatG=nz(fat);this.fiberG=nz(fiber);this.waterMl=water;this.source=source==null||!source.equals("USDA")?"MANUAL":"USDA";this.sourceRef=clean(sourceRef);this.notes=clean(notes);this.updatedAt=Instant.now();}
    private BigDecimal nz(BigDecimal value){return value==null?BigDecimal.ZERO:value;} private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
    public UUID getId(){return id;} public UUID getUserId(){return userId;} public LocalDate getLoggedOn(){return loggedOn;} public MealType getMealType(){return mealType;} public String getFoodName(){return foodName;} public BigDecimal getServingAmount(){return servingAmount;} public String getServingUnit(){return servingUnit;} public BigDecimal getCalories(){return calories;} public BigDecimal getProteinG(){return proteinG;} public BigDecimal getCarbsG(){return carbsG;} public BigDecimal getFatG(){return fatG;} public BigDecimal getFiberG(){return fiberG;} public int getWaterMl(){return waterMl;} public String getSource(){return source;} public String getSourceRef(){return sourceRef;} public String getNotes(){return notes;} public UUID getCreatedByUserId(){return createdByUserId;}
    public enum MealType { BREAKFAST, MID_MORNING, LUNCH, SNACK, DINNER, POST_WORKOUT }
}
