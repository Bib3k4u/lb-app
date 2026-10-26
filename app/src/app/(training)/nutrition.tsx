import { Screen } from '../../components/ui';
import { NutritionDashboard } from '../../components/nutrition/NutritionDashboard';
import { useAuth, visibleSections } from '../../lib/auth/store';
import { spacing } from '../../lib/theme';
export default function NutritionScreen() {
  const user=useAuth(state=>state.user); const sections=user?visibleSections(user):null;
  return <Screen scroll contentContainerStyle={{paddingTop:spacing.lg,paddingBottom:spacing.xxxl}}><NutritionDashboard canManageGoals={Boolean(sections?.admin||sections?.trainer)}/></Screen>;
}
