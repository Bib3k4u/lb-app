package com.limitbeyond.training.internal;

import com.limitbeyond.training.web.TrainingDtos;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Server-side USDA FoodData Central adapter. The key never leaves the backend. */
@Service
public class FoodDataService {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String apiKey;
    public FoodDataService(@Value("${limitbeyond.nutrition.usda-api-key:}") String apiKey){this.apiKey=apiKey;}
    public List<TrainingDtos.FoodSearchItem> search(String query){
        if(apiKey.isBlank()||query==null||query.isBlank())return List.of();
        try {
            String endpoint = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key="
                    + URLEncoder.encode(apiKey, StandardCharsets.UTF_8)
                    + "&query=" + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8)
                    + "&pageSize=15";
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint)).GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return List.of();
            JsonNode root = mapper.readTree(response.body());
        if(root==null)return List.of();List<TrainingDtos.FoodSearchItem> result=new ArrayList<>();
        for(JsonNode food:root.path("foods")){JsonNode serving=food.path("servingSize");String unit=food.path("servingSizeUnit").asText("g");String label=serving.isNumber()?serving.asText()+" "+unit:"per 100 g";BigDecimal grams=serving.isNumber()&&unit.equalsIgnoreCase("g")?serving.decimalValue():new BigDecimal("100");result.add(new TrainingDtos.FoodSearchItem(food.path("fdcId").asText(),food.path("description").asText("Food"),food.path("brandOwner").asText(null),label,grams,nutrient(food,1008,2047,2048),nutrient(food,1003),nutrient(food,1005),nutrient(food,1004),nutrient(food,1079)));}
        return result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }
    private BigDecimal nutrient(JsonNode food,int... ids){for(JsonNode item:food.path("foodNutrients"))for(int id:ids)if(item.path("nutrientId").asInt()==id)return item.path("value").decimalValue();return BigDecimal.ZERO;}
}
