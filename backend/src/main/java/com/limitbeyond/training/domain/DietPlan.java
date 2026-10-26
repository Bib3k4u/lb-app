package com.limitbeyond.training.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity @Table(name="diet_plans")
public class DietPlan {
    @Id private UUID id;
    @Column(name="user_id",nullable=false) private UUID userId;
    @Column(name="gym_id",nullable=false) private UUID gymId;
    @Column(name="author_user_id",nullable=false) private UUID authorUserId;
    @Column(nullable=false) private String objective;
    @Column(nullable=false) private String content;
    @Column(name="kcal_target") private Integer kcalTarget;
    @Column(name="protein_g") private Integer proteinG;
    @Column(name="carbs_g") private Integer carbsG;
    @Column(name="fat_g") private Integer fatG;
    @Column(name="water_ml_target") private Integer waterMlTarget;
    @Column(name="fiber_g_target") private Integer fiberGTarget;
    @Column(name="starts_on",nullable=false) private LocalDate startsOn;
    @Column(name="ends_on") private LocalDate endsOn;
    @Column(nullable=false) private boolean active;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected DietPlan() {}
    public DietPlan(UUID userId,UUID gymId,UUID authorUserId,String objective,String content,Integer kcalTarget,Integer proteinG,Integer carbsG,Integer fatG,Integer waterMlTarget,Integer fiberGTarget,LocalDate startsOn,LocalDate endsOn){
        this.id=UUID.randomUUID();this.userId=userId;this.gymId=gymId;this.authorUserId=authorUserId;this.objective=objective.trim();this.content=content.trim();
        this.kcalTarget=kcalTarget;this.proteinG=proteinG;this.carbsG=carbsG;this.fatG=fatG;this.waterMlTarget=waterMlTarget;this.fiberGTarget=fiberGTarget;this.startsOn=startsOn;this.endsOn=endsOn;this.active=true;this.createdAt=Instant.now();
    }
    public void deactivate(){deactivateOn(LocalDate.now());} public void deactivateOn(LocalDate date){active=false;if(endsOn==null||endsOn.isAfter(date))endsOn=date;} public UUID getId(){return id;} public UUID getUserId(){return userId;} public UUID getGymId(){return gymId;} public String getObjective(){return objective;} public String getContent(){return content;}
    public Integer getKcalTarget(){return kcalTarget;} public Integer getProteinG(){return proteinG;} public Integer getCarbsG(){return carbsG;} public Integer getFatG(){return fatG;}
    public Integer getWaterMlTarget(){return waterMlTarget;} public Integer getFiberGTarget(){return fiberGTarget;}
    public LocalDate getStartsOn(){return startsOn;} public LocalDate getEndsOn(){return endsOn;} public boolean isActive(){return active;}
}
