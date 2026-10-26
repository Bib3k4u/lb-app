import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../../components/ui';
import { NutritionDashboard } from '../../../../../components/nutrition/NutritionDashboard';
import { spacing } from '../../../../../lib/theme';

export default function MemberNutritionScreen(){
  const router=useRouter(); const {userId,name}=useLocalSearchParams<{userId:string;name?:string}>();
  return <Screen scroll contentContainerStyle={{paddingTop:spacing.lg,paddingBottom:spacing.xxxl}}><NutritionDashboard userId={userId} memberName={name} canManageGoals onBack={()=>router.back()}/></Screen>;
}
